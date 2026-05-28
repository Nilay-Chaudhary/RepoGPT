const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
import { GoogleGenAI } from '@google/genai';
const geminiClient = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
  vertexai: false,
});
import { Document } from '@langchain/core/documents'

import { OpenAI } from "openai";

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

export async function generateCompletion(prompt: string, maxTokens = 512): Promise<string> {
  try {
    const GROQ_MODELS = [
      "qwen/qwen3-32b",
      "llama-3.3-70b-versatile",
      "openai/gpt-oss-120b",
      "meta-llama/llama-4-scout-17b-16e-instruct",
      "openai/gpt-oss-20b",
    ] as const;

    type GroqModel = (typeof GROQ_MODELS)[number];

    const MODEL_MIN_INTERVAL_MS: Record<GroqModel, number> = {
      "qwen/qwen3-32b": 1200,
      "llama-3.3-70b-versatile": 2200,
      "openai/gpt-oss-120b": 2200,
      "meta-llama/llama-4-scout-17b-16e-instruct": 2200,
      "openai/gpt-oss-20b": 2200,
    };

    const modelLastRequestAt = new Map<GroqModel, number>();

    function getErrorStatus(err: unknown): number | undefined {
      if (!err || typeof err !== 'object') return undefined;
      const maybeStatus = (err as { status?: unknown }).status;
      return typeof maybeStatus === 'number' ? maybeStatus : undefined;
    }

    function isRetryableGroqError(err: unknown): boolean {
      const status = getErrorStatus(err);
      return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
    }

    async function waitForModelWindow(model: GroqModel) {
      const minInterval = MODEL_MIN_INTERVAL_MS[model];
      const lastTs = modelLastRequestAt.get(model) ?? 0;
      const waitMs = Math.max(0, minInterval - (Date.now() - lastTs));
      if (waitMs > 0) await delay(waitMs);
    }

    function markModelUsed(model: GroqModel) {
      modelLastRequestAt.set(model, Date.now());
    }

    const maxAttempts = GROQ_MODELS.length * 2;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const model = GROQ_MODELS[attempt % GROQ_MODELS.length] as GroqModel;
      try {
        await waitForModelWindow(model);
        const response = await client.responses.create({ input: prompt, model });
        markModelUsed(model);
        return (response.output_text || '').trim();
      } catch (err) {
        lastError = err;
        markModelUsed(model);
        if (!isRetryableGroqError(err)) break;
        const backoffMs = Math.min(6000, 600 + attempt * 500);
        await delay(backoffMs);
      }
    }

    console.error('All Groq model attempts failed:', lastError);
    return '';
  } catch (err) {
    console.error('Error in generateCompletion', err);
    return '';
  }
}

export const aiSummariseCommit = async (diff: string): Promise<string> => {
  if (!diff || diff.length === 0) return ''
  const prompt = `
                You are an expert programmer. Summarize the following git diff as a simple bullet list of changes. For each change, include:
                - A short action description (e.g. “Changed useEffect to setTimeout”, “Added Home component”, Replace fetch with axios”)
                - The file path in square brackets
                Only include actual additions (+) or deletions (–). Ignore context lines.  
                Format each bullet like:
                * <Action> [<file path>]
                EXAMPLE SUMMARY COMMENTS:
                \n
                * Raised the amount of returned recordings from '10' to '100' [packages/server/recordings_api.ts] 
                * Fixed a typo in the github action name [.github/workflows/summariser.yml]
                * Moved the octokit initialization to a separate file [src/octolit.ts], [src/index.ts]
                * Lowered numeric tolerance for test files
                \n
                Here’s the diff:
                ${diff}`

  return await generateCompletion(prompt, 1024)
}

export async function summariseCode(doc: Document): Promise<string> {
  try {
    const code = doc.pageContent.slice(0, 10000)
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
            `
    const resp = await generateCompletion(prompt, 512)
    return resp.trim()
  } catch (error) {
    console.error('Error while summarising in llm adapter:', error)
    return ''
  }
}

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    if (!text || !text.trim()) {
      throw new Error("Empty text for embedding");
    }

    const EMBED_MODELS = ['gemini-embedding-2', 'gemini-embedding-001'];

    function getErrorStatus(err: unknown): number | undefined {
      if (!err || typeof err !== 'object') return undefined;
      const maybeStatus = (err as { status?: unknown }).status;
      return typeof maybeStatus === 'number' ? maybeStatus : undefined;
    }

    function isRetryableGeminiError(err: unknown): boolean {
      const status = getErrorStatus(err);
      return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
    }

    for (let i = 0; i < EMBED_MODELS.length; i++) {
      const model = EMBED_MODELS[i]!;
      try {
        const resp = await geminiClient.models.embedContent({
          model,
          contents: [text],
          config: { outputDimensionality: 768 },
        });
        const embeddings = (resp as any).embeddings;
        const vector: number[] = embeddings?.[0]?.values ?? [];
        return vector;
      } catch (err) {
        if (!isRetryableGeminiError(err)) break;
        await delay(700 + i * 300);
      }
    }

    console.error('All Gemini embed attempts failed');
    return [];
  } catch (error) {
    console.error("Error while embedding:", error);
    return [];
  }
}
