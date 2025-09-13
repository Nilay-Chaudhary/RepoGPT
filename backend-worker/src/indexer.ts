import { GithubRepoLoader } from "@langchain/community/document_loaders/web/github";
import { Document } from "@langchain/core/documents";
import { db } from './lib/prisma.js';
import { Octokit } from "octokit";
import { GoogleGenAI } from '@google/genai'

const defaultClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
    vertexai: false,
})

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

const RATE_LIMIT = 30;
const WINDOW = 60 * 1000;

const requestsMap = new Map<string, number[]>();

function isAllowed(apiKey: string): boolean {
    const now = Date.now();
    const windowStart = now - WINDOW;
    let timestamps = requestsMap.get(apiKey) || [];
    timestamps = timestamps.filter(ts => ts > windowStart);
    if (timestamps.length >= RATE_LIMIT) {
        requestsMap.set(apiKey, timestamps);
        return false;
    }
    timestamps.push(now);
    requestsMap.set(apiKey, timestamps);
    return true;
}

async function waitForSlot(apiKey: string) {
    while (!isAllowed(apiKey)) {
        await new Promise(res => setTimeout(res, 500));
    }
}


export async function summariseCode(
    doc: Document,
    client: GoogleGenAI = defaultClient
): Promise<string> {
    try {
        const code = doc.pageContent.slice(0, 10000)
        const prompt = `
            You are an intelligent senior software developer who speacializes in onboarding junior software
            engineers onto projects.You are explaining the purpose of the 
            ${doc.metadata.source} file.Here is the code \n\n ${code} \n \n
            Give a to - the - point summary in under 5000 individual characters of the code above.
            Make sure the output is under 2000 tokens or 5000 characters
            `
        const response = await client.models.generateContent({
            model: "gemini-2.0-flash-lite",
            contents: prompt
        })

        return response?.text?.trim() ? response?.text?.trim() : "";
    } catch (error) {
        console.log("Error while summarising:", error)
        return ""
    }
}

export async function generateEmbedding(
    summary: string,
    client: GoogleGenAI = defaultClient
): Promise<number[]> {
    // console.log("embedding...")
    try {
        const resp = await client.models.embedContent({
            model: 'gemini-embedding-001',
            contents: [summary],

            config: {
                outputDimensionality: 768
            }
        })

        const embeddings = (resp as any).embeddings
        const vector: number[] = embeddings?.[0]?.values ?? []
        // console.log(`Expected 768 dims but got ${vector.length}`)
        return vector;
    } catch (error) {
        console.log("Error while embedding:", error)
        return [];
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
        const apiKey = API_KEYS[i % API_KEYS.length];
        const doc = docs[i];
        if (!doc) continue;
        try {
            await waitForSlot(apiKey);
            console.log("Sending a file...")
            const summary = await summariseCode(doc, client);
            // console.log("embedding now...")
            const embedding = await generateEmbedding(summary, client);
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
