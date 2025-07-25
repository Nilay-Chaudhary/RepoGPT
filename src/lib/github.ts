import { db } from '@/server/db';
import { Octokit } from 'octokit'
import axios from 'axios'
import { aiSummariseCommit } from './gemini';
import { GoogleGenerativeAI } from '@google/generative-ai';


export const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN!
});


type Response = {
    commitHash: string;
    commitMessage: string;
    commitAuthorName: string;
    commitAuthorAvatar: string;
    commitDate: string;
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


const MAX_COMMITS = 10;
const DELAY_MS = 200;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const genAIClients = API_KEYS.map((key) => new GoogleGenerativeAI(key));

export const pollCommits = async (projectId: string, githubToken?: string) => {
    const { project, githubUrl } = await fetchProjectGithubUrl(projectId);
    const commitHashes = await getCommitHashes(githubUrl, githubToken);
    const unprocessedCommits = await filterCommits(projectId, commitHashes);
    const toProcess = unprocessedCommits.slice(0, MAX_COMMITS);
    const summaries: string[] = [];
    for (let i = 0; i < toProcess.length; i++) {
        const commit = toProcess[i];
        const client = genAIClients[i % genAIClients.length];
        if (!commit || !client) continue;
        try {
            console.log(`Summarizing commit`);
            const summary = await summariseCommit(githubUrl, commit.commitHash, client, githubToken);
            summaries.push(summary);
        } catch (err) {
            console.error(`Failed to summarise`, err);
            summaries.push("");
        }
        await delay(DELAY_MS);
    }

    const commitRecords = toProcess.map((c, i) => ({
        projectId,
        commitHash: c.commitHash,
        commitMessage: c.commitMessage,
        commitAuthorName: c.commitAuthorName,
        commitAuthorAvatar: c.commitAuthorAvatar,
        commitDate: c.commitDate,
        summary: summaries[i] ?? ""
    }));

    const result = await db.commit.createMany({ data: commitRecords });
    return result;
};

async function summariseCommit(
    githubUrl: string,
    commitHash: string,
    client: GoogleGenerativeAI,
    githubToken?: string
): Promise<string> {
    const [owner, repo] = githubUrl.split("/").slice(-2);
    if (!owner || !repo) {
        throw new Error("Invalid GitHub URL");
    }

    const newOckokit = githubToken
        ? new Octokit({ auth: githubToken })
        : octokit;
    const { data: commit } = await newOckokit.rest.repos.getCommit({
        owner,
        repo,
        ref: commitHash
    });

    const fullDiff = commit.files
        ?.map(file => file.patch)
        .filter(Boolean)
        .join("\n") ?? "";

    const safeDiff = fullDiff.slice(0, 500_000);
    return (await aiSummariseCommit(safeDiff, client)) || "";
}

async function fetchProjectGithubUrl(projectId: string) {
    const project = await db.project.findUnique({
        where: { id: projectId },
        select: {
            githubUrl: true
        }
    })
    if (!project?.githubUrl) {
        throw new Error("Invalid GitHub URL");
    }
    return { project, githubUrl: project?.githubUrl }
}

export const getCommitHashes = async (
    githubUrl: string,
    githubToken?: string
): Promise<Response[]> => {
    const [owner, repo] = githubUrl.split("/").slice(-2);
    if (!owner || !repo) {
        throw new Error("Invalid GitHub URL");
    }

    const newOckokit = githubToken
        ? new Octokit({ auth: githubToken })
        : octokit;

    const { data } = await newOckokit.rest.repos.listCommits({
        owner,
        repo,
    });

    const sortedCommits = data
        .sort(
            (a: any, b: any) =>
                new Date(b.commit.author.date).getTime() -
                new Date(a.commit.author.date).getTime()
        ) as any[];

    return sortedCommits.slice(0, 10).map((commit: any) => ({
        commitHash: commit.sha as string,
        commitMessage: commit?.commit?.message ?? "",
        commitAuthorName: commit?.commit?.author?.name ?? "",
        commitAuthorAvatar: commit?.author?.avatar_url ?? "",
        commitDate: commit?.commit?.author?.date ?? "",
    }));
};


async function filterCommits(projectId: string, commitHashes: Response[]) {
    const processedCommits = await db.commit.findMany({
        where: { projectId }
    })
    const unprocessedCommits = commitHashes.filter((commit) =>
        !processedCommits.some((processedCommit) => processedCommit.commitHash == commit.commitHash)
    )
    return unprocessedCommits;
}