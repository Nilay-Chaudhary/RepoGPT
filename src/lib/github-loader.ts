import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import { Document } from "@langchain/core/documents";
import { generateEmbedding, summariseCode } from "./gemini";
import { db } from "@/server/db";
import { Octokit } from "octokit";
import { GoogleGenAI } from '@google/genai'

const API_KEYS = [
  process.env.GEMINI_API_KEY!,
  process.env.GEMINI_API_KEY_2!,
  process.env.GEMINI_API_KEY_3!,
  process.env.GEMINI_API_KEY_4!,
  process.env.GEMINI_API_KEY_5!,
  process.env.GEMINI_API_KEY_6!,
  process.env.GEMINI_API_KEY_7!,
  process.env.GEMINI_API_KEY_8!,
  process.env.GEMINI_API_KEY_9!,
  process.env.GEMINI_API_KEY_10!,
];

export async function getFileCount(
  githubOwner: string,
  githubRepo: string,
  octokit: Octokit
): Promise<number> {
  const { data: repo } = await octokit.rest.repos.get({
    owner: githubOwner,
    repo: githubRepo,
  });
  const defaultBranch = repo.default_branch;

  const {
    data: {
      commit: { sha: treeSha },
    },
  } = await octokit.rest.repos.getBranch({
    owner: githubOwner,
    repo: githubRepo,
    branch: defaultBranch,
  });

  const { data: treeData } = await octokit.rest.git.getTree({
    owner: githubOwner,
    repo: githubRepo,
    tree_sha: treeSha,
    recursive: "true",
  });

  const fileCount = treeData.tree
    .filter(item => item.type === "blob")
    .filter(item => !item.path.includes("node_modules/"))
    .length;
  return fileCount;
}

export const checkCredits = async (
  githubUrl: string,
  githubToken?: string
): Promise<number> => {
  if (!githubUrl) throw new Error("GitHub URL is required");

  const octokit = new Octokit({
    auth: githubToken || process.env.GITHUB_TOKEN,
  });

  const parts = githubUrl.split("/");
  const githubOwner = parts[3];
  const githubRepo = parts[4];

  if (!githubOwner || !githubRepo) {
    throw new Error("Invalid GitHub URL format");
  }

  try {
    const fileCount = await getFileCount(githubOwner, githubRepo, octokit);
    return fileCount;
  } catch (err: any) {
    throw new Error(`Could not check credits`);
  }
};

export const loadGithubRepo = async (
  githubUrl: string,
  githubToken?: string,
) => {
  const loader = new GithubRepoLoader(githubUrl, {
    accessToken: githubToken || process.env.GITHUB_TOKEN || "",
    branch: "main",
    ignoreFiles: [
      "package-lock.json",
      "yarn-lock",
      "pnpm-lock.yaml",
      "bun.lockb",
    ],
    ignorePaths: ["**/node_modules/**"],
    recursive: true,
    unknown: "warn",
    maxConcurrency: 5,
  });
  const docs = await loader.load();
  return docs;
};

export const indexGithubRepo = async (
  projectId: string,
  githubUrl: string,
  githubToken?: string,
) => {
  const docs = await loadGithubRepo(githubUrl, githubToken);
  const allEmbeddings = await generateEmbeddings(docs);
  await Promise.allSettled(
    allEmbeddings.map(async (embedding, index) => {
      if (!embedding) return;
      const sourceCodeEmbedding = await db.sourceCodeEmbedding.create({
        data: {
          summary: embedding.summary,
          sourceCode: embedding.sourceCode,
          fileName: embedding.fileName,
          projectId,
        },
      });
      await db.$executeRaw`
        UPDATE "SourceCodeEmbedding"
        SET "summaryEmbedding" = ${embedding.embedding}::vector
        WHERE "id" = ${sourceCodeEmbedding.id}
        `;
    }),
  );
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const genAIClients = API_KEYS.map(key =>
  new GoogleGenAI({
    apiKey: key,
    vertexai: false
  })
)
export const generateEmbeddings = async (docs: Document[]) => {
  const results = [];

  for (let i = 0; i < docs.length; i++) {
    const client = genAIClients[i % genAIClients.length];
    const doc = docs[i];
    if (!doc) continue;
    try {
      console.log("Sending a file...")
      const summary = await summariseCode(doc, client);
      const embedding = await generateEmbedding(summary, client);

      results.push({
        summary,
        embedding,
        sourceCode: JSON.parse(JSON.stringify(doc.pageContent)),
        fileName: doc.metadata.source,
      });
    } catch (err) {
      console.error(`Failed for ${doc.metadata.source}:`, err);
    }

    await delay(210);
  }

  return results;
};
