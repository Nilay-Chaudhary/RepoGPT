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

const GROQ_MODELS = [
    "qwen/qwen3-32b",
    "llama-3.3-70b-versatile",
    "openai/gpt-oss-120b",
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "openai/gpt-oss-20b",
] as const;

type GroqModel = (typeof GROQ_MODELS)[number];

// Keep a small safety buffer under each model's RPM limit.
const MODEL_MIN_INTERVAL_MS: Record<GroqModel, number> = {
    "qwen/qwen3-32b": 1200,
    "llama-3.3-70b-versatile": 2200,
    "openai/gpt-oss-120b": 2200,
    "meta-llama/llama-4-scout-17b-16e-instruct": 2200,
    "openai/gpt-oss-20b": 2200,
};

const modelLastRequestAt = new Map<GroqModel, number>();
let modelStartIndex = 0;

function getErrorStatus(err: unknown): number | undefined {
    if (!err || typeof err !== "object") return undefined;
    const maybeStatus = (err as { status?: unknown }).status;
    return typeof maybeStatus === "number" ? maybeStatus : undefined;
}

function isRetryableGroqError(err: unknown): boolean {
    const status = getErrorStatus(err);
    return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

async function waitForModelWindow(model: GroqModel) {
    const minInterval = MODEL_MIN_INTERVAL_MS[model];
    const lastTs = modelLastRequestAt.get(model) ?? 0;
    const waitMs = Math.max(0, minInterval - (Date.now() - lastTs));
    if (waitMs > 0) await groqDelay(waitMs);
}

function markModelUsed(model: GroqModel) {
    modelLastRequestAt.set(model, Date.now());
}

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

        const maxAttempts = GROQ_MODELS.length * 2;
        let lastError: unknown;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const model = GROQ_MODELS[(modelStartIndex + attempt) % GROQ_MODELS.length]!;
            try {
                await waitForModelWindow(model);
                const response = await client.responses.create({
                    input: prompt,
                    model,
                });
                markModelUsed(model);
                modelStartIndex = (GROQ_MODELS.indexOf(model) + 1) % GROQ_MODELS.length;
                console.log(`Summary model used: ${model} | file: ${doc.metadata.source}`);
                return (response.output_text || "").trim();
            } catch (err) {
                lastError = err;
                markModelUsed(model);

                if (!isRetryableGroqError(err)) {
                    console.error(`Non-retryable summarization error on ${model}:`, err);
                    break;
                }

                const backoffMs = Math.min(6000, 600 + attempt * 500);
                console.warn(`Retryable summarization error on ${model}. Backing off ${backoffMs}ms.`);
                await groqDelay(backoffMs);
            }
        }

        console.error("All model attempts failed for summarisation:", lastError);
        return "";
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
            model: 'gemini-embedding-2',
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
            console.log(`Sending file ${i + 1} out of ${docs.length}: ${doc.metadata.source}`)
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
