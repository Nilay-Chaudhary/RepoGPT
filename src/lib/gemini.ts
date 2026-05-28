import { GoogleGenAI } from '@google/genai'
import { Document } from '@langchain/core/documents'

const DEFAULT_GEMINI_TEXT_MODELS = [
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-3-flash",
    "gemini-3.5-flash",
] as const

const DEFAULT_GEMINI_EMBED_MODELS = [
    "gemini-embedding-2",
    "gemini-embedding-001",
] as const

const GEMINI_TEXT_MODEL_MIN_INTERVAL_MS: Record<string, number> = {
    "gemini-3.1-flash-lite": 4500,
    "gemini-2.5-flash-lite": 6500,
    "gemini-2.5-flash": 12000,
    "gemini-3-flash": 12000,
    "gemini-3.5-flash": 12000,
}

const DEFAULT_MIN_INTERVAL_MS = 5000
const geminiDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const configuredTextModels = (process.env.GEMINI_TEXT_MODELS ?? "")
    .split(",")
    .map(m => m.trim())
    .filter(Boolean)

const GEMINI_TEXT_MODELS = configuredTextModels.length > 0
    ? configuredTextModels
    : [...DEFAULT_GEMINI_TEXT_MODELS]

const geminiEmbedModelsConfigured = (process.env.GEMINI_EMBED_MODELS ?? "")
    .split(",")
    .map(m => m.trim())
    .filter(Boolean)

const GEMINI_EMBED_MODELS = geminiEmbedModelsConfigured.length > 0
    ? geminiEmbedModelsConfigured
    : [...DEFAULT_GEMINI_EMBED_MODELS]

function getGeminiApiKeys(): string[] {
    const fromEnv = Object.entries(process.env)
        .filter(([k, v]) => k.startsWith("GEMINI_API_KEY") && typeof v === "string" && v.trim().length > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => v!.trim())

    if (fromEnv.length === 0) {
        return process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY] : []
    }

    return [...new Set(fromEnv)]
}

const geminiApiKeys = getGeminiApiKeys()
const geminiClients = geminiApiKeys.map(
    apiKey => new GoogleGenAI({ apiKey, vertexai: false })
)

const defaultClient = geminiClients[0] ?? new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
    vertexai: false,
})

const requestLastSentAt = new Map<string, number>()
let nextGeminiClientStartIndex = 0

function getErrorStatus(err: unknown): number | undefined {
    if (!err || typeof err !== "object") return undefined
    const maybeStatus = (err as { status?: unknown }).status
    return typeof maybeStatus === "number" ? maybeStatus : undefined
}

function isRetryableGeminiError(err: unknown): boolean {
    const status = getErrorStatus(err)
    return status === 429 || status === 500 || status === 502 || status === 503 || status === 504
}

function getOrderedClients(overrideClient?: GoogleGenAI): GoogleGenAI[] {
    if (overrideClient) return [overrideClient]
    if (geminiClients.length <= 1) return [defaultClient]

    const start = nextGeminiClientStartIndex % geminiClients.length
    const ordered = [...geminiClients.slice(start), ...geminiClients.slice(0, start)]
    nextGeminiClientStartIndex = (start + 1) % geminiClients.length
    return ordered
}

async function waitForGeminiWindow(clientIndex: number, model: string) {
    const minInterval = GEMINI_TEXT_MODEL_MIN_INTERVAL_MS[model] ?? DEFAULT_MIN_INTERVAL_MS
    const key = `${clientIndex}:${model}`
    const last = requestLastSentAt.get(key) ?? 0
    const waitMs = Math.max(0, minInterval - (Date.now() - last))
    if (waitMs > 0) await geminiDelay(waitMs)
}

function markGeminiRequest(clientIndex: number, model: string) {
    requestLastSentAt.set(`${clientIndex}:${model}`, Date.now())
}

async function generateTextWithFallback(
    prompt: string,
    overrideClient?: GoogleGenAI,
): Promise<string> {
    const clients = getOrderedClients(overrideClient)
    let lastError: unknown

    for (let clientIndex = 0; clientIndex < clients.length; clientIndex++) {
        const candidateClient = clients[clientIndex]!
        for (const model of GEMINI_TEXT_MODELS) {
            try {
                await waitForGeminiWindow(clientIndex, model)
                const response = await candidateClient.models.generateContent({
                    model,
                    contents: prompt,
                })
                markGeminiRequest(clientIndex, model)
                return (response.text ?? "").trim()
            } catch (err) {
                lastError = err
                markGeminiRequest(clientIndex, model)

                if (isRetryableGeminiError(err)) {
                    await geminiDelay(700)
                }

                console.warn(`Gemini text fallback failed on model ${model} (client #${clientIndex + 1}).`)
            }
        }
    }

    console.error("All Gemini text fallback attempts failed:", lastError)
    return ""
}

async function generateEmbeddingWithFallback(
    summary: string,
    overrideClient?: GoogleGenAI,
): Promise<number[]> {
    const clients = getOrderedClients(overrideClient)
    let lastError: unknown

    for (let clientIndex = 0; clientIndex < clients.length; clientIndex++) {
        const candidateClient = clients[clientIndex]!
        for (const model of GEMINI_EMBED_MODELS) {
            try {
                await waitForGeminiWindow(clientIndex, model)
                const resp = await candidateClient.models.embedContent({
                    model,
                    contents: [summary],
                    config: {
                        outputDimensionality: 768,
                    },
                })
                markGeminiRequest(clientIndex, model)

                const embeddings = (resp as any).embeddings
                const vector: number[] = embeddings?.[0]?.values ?? []
                return vector
            } catch (err) {
                lastError = err
                markGeminiRequest(clientIndex, model)

                if (isRetryableGeminiError(err)) {
                    await geminiDelay(700)
                }

                console.warn(`Gemini embedding fallback failed on model ${model} (client #${clientIndex + 1}).`)
            }
        }
    }

    console.error("All Gemini embedding fallback attempts failed:", lastError)
    return []
}


export const aiSummariseCommit = async (
    diff: string,
    client?: GoogleGenAI
) => {
    const prompt = `
                You are an expert programmer. Summarize the following git diff as a simple bullet list of changes. For each change, include:
                - A short action description (e.g. “Changed useEffect to setTimeout”, “Added Home component”, Replace fetch with axios”)
                - The file path in square brackets
                Only include actual additions (+) or deletions (–). Ignore context lines.  
                Format each bullet like:
                * <Action> [<file path>]
                EXAMPLE SUMMARY COMMENTS:
                \n
                * Raised the amount of returned recordings from \'10\' to \'100\' [packages/server/recordings_api.ts] 
                * Fixed a typo in the github action name [.github/workflows/summariser.yml]
                * Moved the octokit initialization to a separate file [src/octolit.ts], [src/index.ts]
                * Lowered numeric tolerance for test files
                \n
                Here’s the diff:
                ${diff}`
    if (diff.length == 0) return "";
    try {
        return await generateTextWithFallback(prompt, client)
    } catch (err) {
        console.error("Error while summarising commit:", err)
        return ""
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
        return await generateTextWithFallback(prompt, client)
    } catch (error) {
        console.error("Error while summarising:", error)
        return ""
    }
}


export async function generateEmbedding(
    summary: string,
    client: GoogleGenAI = defaultClient
): Promise<number[]> {
    try {
        if (!summary || !summary.trim()) return []
        return await generateEmbeddingWithFallback(summary, client)
    } catch (error) {
        console.log("Error while embedding:", error)
        return []
    }
}

