import { AssemblyAI } from "assemblyai";

const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY!,
});

function msToTime(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export const processMeeting = async (meetingUrl: string) => {
  // console.log("HEHEHEHHEHEHEHE");
  const transcript = await client.transcripts.transcribe({
    audio: meetingUrl,
    auto_chapters: true,
  });

  const summaries =
    transcript.chapters?.map((chapter) => ({
      start: msToTime(chapter.start),
      end: msToTime(chapter.end),
      gist: chapter.gist,
      headline: chapter.headline,
      summary: chapter.summary,
    })) || [];

    console.log(summaries);

  if (!transcript.text) throw new Error("No transcript text found");

  return {
    summaries
  };
};

