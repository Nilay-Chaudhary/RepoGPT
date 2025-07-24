'use server'
import { streamText } from 'ai'
import { createStreamableValue } from 'ai/rsc'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateEmbedding } from '@/lib/gemini'
import { db } from '@/server/db'


const google = createGoogleGenerativeAI({
    apiKey: process.env.GEMINI_API_KEY
})


export async function askQuestion(question: string, projectId: string) {
    const queryVector = await generateEmbedding(question)
    const vectorQuery = `[${queryVector.join(',')}]`

    const result = await db.$queryRaw`
    SELECT "fileName", "sourceCode", "summary",
                    1 - ("summaryEmbedding" <=> ${vectorQuery}::vector) as similarity
                    FROM "SourceCodeEmbedding"
                    WHERE 1 - ("summaryEmbedding" <=> ${vectorQuery}::vector) > 0.4
                    AND "projectId" = ${projectId}
                    ORDER BY similarity DESC
                    LIMIT 5
                    ` as { fileName: string; sourceCode: string; summary: string }[]
    let context = ""
    for (const doc of result) {
        context += `source: ${doc.fileName}\ncode content: ${doc.sourceCode}\nsummary of file: ${doc.summary}\n\n`
    }

    const prompt = `You are an AI code assistant who answers questions about the codebase. Assume all queries
                are somehow related to the codebase. Your target
                audience is a technical intern who is looking to understand the codebase.
                AI assistant is a brand new, powerful, humanlike AI. THe traits of AI include expert knowledge,
                helpfulness, cleverness and articulateness.
                AI is well behaved and always friendly, kind and inspiring. He is eager to provide thoughful responses
                to the user.
                AI has the sum of all knowledge in their brain and is able to accurately answer nearly any questions about
                any topic in coversation.
                If the question is asking about code or a specific file, AI will provide the detailed answer, giving step by step
                instructions including code snippets

                START CONTEXT BLOCK:\n
                ${context}
                \n--END CONTEXT BLOCK--\n

                START QUESTION BLOCK:
                ${question}
                \n--END QUESTION BLOCK--\n

                AI assistant will take into account any CONTEXT BLOCK that is provided in a conversation.
                The CONTEXT BLOCK contains code content and summary. AI assistant will use these answers the queries
                posed by the user.
                If the context does not provide the answer to the question, AI assistant will say,
                "I'm sorry, but I don't know the answer to your query. Please provide more context to allow me
                to help you."
                AI assistant will not apologise for previous responses but instead will say new information was gained.
                AI assistant will not invent anything that is not drawn directly from the context.
                Answer in markdown syntax, with code snippets if needed. Be as detailed as possible when answering.
                `
    const stream = createStreamableValue('');
    stream.update('');
    (async () => {
        try {
            const { textStream } = streamText({
                model: google('gemini-1.5-flash'),
                prompt: prompt
            })
            for await (const delta of textStream) {
                stream.update(delta)
            }
        }
        finally {
            stream.done();
        }
    })()
    return { output: stream.value, filesReferences: result }
}
