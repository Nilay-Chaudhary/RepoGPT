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
    await delay(500);
    const response = await client.responses.create({
      input: prompt,
      model: "qwen/qwen3-32b",
    });
    return (response.output_text || '').trim();
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

    const resp = await geminiClient.models.embedContent({
      model: 'gemini-embedding-001',
      contents: [text],
      config: {
        outputDimensionality: 768,
      },
    });

    const embeddings = (resp as any).embeddings;
    const vector: number[] = embeddings?.[0]?.values ?? [];
    return vector;
  } catch (error) {
    console.error("Error while embedding:", error);
    return [];
  }
}
