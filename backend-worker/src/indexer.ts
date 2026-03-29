import { GoogleGenAI } from '@google/genai';
const geminiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
    vertexai: false,
});
import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import { Document } from "@langchain/core/documents";
import { db } from './lib/prisma.js';
import { Octokit } from "octokit";

import { OpenAI } from "openai";

const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
});

const groqDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function summariseCode(doc: Document): Promise<string> {
    try {
        const code = doc.pageContent.slice(0, 8000);
        if (!code.trim()) return "";

        const prompt = `
You are a senior software engineer.

Explain the purpose of the following file in clear, concise plain text.

Focus on:
- what the code does
- key components or logic
- any important behaviors

Avoid:
- unnecessary details
- formatting, markdown, or bullet points

Keep the response short and to the point.

File: ${doc.metadata.source}

Code:
${code}
`;

        await groqDelay(500);
        const response = await client.responses.create({
            input: prompt,
            model: "qwen/qwen3-32b",
        });
        return (response.output_text || "").trim();
    } catch (error) {
        console.error("Error while summarising:", error);
        return "";
    }
}

async function generateEmbedding(text: string): Promise<number[]> {
    try {
        if (!text || !text.trim()) {
            throw new Error("Empty text for embedding")
        }

        const resp = await geminiClient.models.embedContent({
            model: 'gemini-embedding-001',
            contents: [text],
            config: {
                outputDimensionality: 768,
            },
        })

        console.log("Embedding API response:", resp)

        const embeddings = (resp as any).embeddings
        const vector: number[] = embeddings?.[0]?.values ?? []
        console.log("Embedding vector length:", vector.length)
        return vector

    } catch (error) {
        console.error("Error while embedding:", error)
        return []
    }
}

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
export const generateEmbeddings = async (docs: Document[]) => {
    const results = [];
    for (let i = 0; i < docs.length; i++) {
        const doc = docs[i];
        if (!doc) continue;
        try {
            console.log("Sending a file...")
            const summary = await summariseCode(doc);
            const embedding = await generateEmbedding(summary);
            results.push({
                summary,
                embedding,
                sourceCode: JSON.parse(JSON.stringify(doc.pageContent)),
                fileName: doc.metadata.source,
            });
        } catch (err) {
            console.log(`Failed for ${doc.metadata.source}:`, err);
        }

        await delay(210);
    }

    return results;
};
