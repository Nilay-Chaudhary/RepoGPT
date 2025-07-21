import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import { Document } from "@langchain/core/documents";
import { db } from './lib/prisma.js';
import { Octokit } from "octokit";
import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_API_KEY = process.env.GEMINI_API_KEY!;
const defaultClient = new GoogleGenerativeAI(DEFAULT_API_KEY);

export async function summariseCode(doc: Document, client?: GoogleGenerativeAI) {
    try {
        const usedClient = client ?? defaultClient;
        const model = usedClient.getGenerativeModel({ model: "gemini-2.0-flash-lite" });
        const code = doc.pageContent.slice(0, 10000);
        const prompt =
            `
            You are an intelligent senior software developer who speacializes in onboarding junior software
            engineers onto projects. You are explaining the purpose of the 
            ${doc.metadata.source} file. Here is the code \n\n ${code} \n \n
            Give a to-the-point summary of no more than 200 words of the code above.
        `;
        const response = await model.generateContent([prompt]);
        return response.response.text();
    } catch (error) {
        console.error("Error while summarising:", error);
        return "";
    }
}

export async function generateEmbedding(summary: string, client?: GoogleGenerativeAI) {
    try {
        const usedClient = client ?? defaultClient;
        const model = usedClient.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(summary);
        return result.embedding.values;
    } catch (error) {
        console.error("Error while embedding:", error);
        return [];
    }
}


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

async function getDefaultBranch(owner: string, repo: string, githubToken?: string) {
    const octokit = new Octokit({
        auth: githubToken || process.env.GITHUB_TOKEN,
    });
    const { data } = await octokit.rest.repos.get({ owner, repo });
    return data.default_branch;
}

export const loadGithubRepo = async (
    githubUrl: string,
    githubToken?: string,
) => {
    const parts = githubUrl.split("/");
    const githubOwner = parts[3];
    const githubRepo = parts[4];
    if (!githubOwner || !githubRepo) throw new Error("Invalid URL");

    const defaultBranch = await getDefaultBranch(githubOwner, githubRepo, githubToken);
    const loader = new GithubRepoLoader(githubUrl, {
        accessToken: githubToken || process.env.GITHUB_TOKEN || "",
        branch: defaultBranch,
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
    console.log("Total files: ", docs.length);
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
const genAIClients = API_KEYS.map((key) => new GoogleGenerativeAI(key));

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
