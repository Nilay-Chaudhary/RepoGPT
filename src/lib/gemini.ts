import { GoogleGenAI } from '@google/genai'
import { Document } from '@langchain/core/documents'

const defaultClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
    vertexai: false,
})


export const aiSummariseCommit = async (
    diff: string,
    client?: GoogleGenAI
) => {
    const usedClient = client ?? defaultClient;
    const prompt = `
                You are an expert programmer. Summarize the following git diff as a simple bullet list of changes. For each change, include:
                - A very short action description (e.g. “Remove X”, “Add Y”, “Rename Z to W”)
                - The file path in square brackets
                Only include actual additions (+) or deletions (–). Ignore context lines.  
                Format each bullet like:
                * <Action> [<file path>]
                EXAMPLE SUMMARY COMMENTS:
                \n
                * Raised the amount of returned recordings from \'10\' to \'100\' [packages/server/recordings_api.ts] 
                * Fixed a typo in teh github action name [.github/workflows/summariser.yml]
                * Moves the octokit initialization to a separate file [src/octolit.ts], [src/index.ts]
                * Lowered numeric tolerance for test files
                \n
                Here’s the diff:
                ${diff}`
    if (diff.length == 0) return "";
    // console.log("diff", diff);
    try {
        const response = await usedClient.models.generateContent({
            model: "gemini-2.0-flash-lite",
            contents: prompt,
        })
        const text = response.text ?? ""
        return text.trim();
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
        const response = await client.models.generateContent({
            model: "gemini-2.0-flash-lite",
            contents: prompt
        })

        return response?.text?.trim() ? response?.text?.trim() : "";
    } catch (error) {
        console.error("Error while summarising:", error)
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

