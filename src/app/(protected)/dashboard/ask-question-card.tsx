"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import useProject from "@/hooks/use-project";
import Image from "next/image";
import React, { useState } from "react";
import { askQuestion } from "./actions";
import { readStreamableValue } from "ai/rsc";
import MDEditor from "@uiw/react-md-editor";
import CodeReferences from "./code-references";
import { api } from "@/trpc/react";
import { toast } from "sonner";
import useRefetch from "@/hooks/use-refetch";
import { Download, Loader2 } from "lucide-react";


const AskQuestionCard = () => {
  const { project } = useProject();
  const [question, setQuestion] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filesReferences, setFilesReferences] = useState<
    { fileName: string; sourceCode: string; summary: string }[]
  >([]);
  const [answer, setAnswer] = useState("");
  const saveAnswer = api.project.saveAnswer.useMutation();

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!project?.id) return;
    setAnswer("");
    setFilesReferences([]);
    setLoading(true);
    const { output, filesReferences } = await askQuestion(question, project.id);
    setOpen(true);
    setFilesReferences(filesReferences);
    for await (const delta of readStreamableValue(output)) {
      if (delta) {
        setAnswer((ans) => ans + delta);
      }
    }
    setLoading(false);
  };

  const refetch = useRefetch();

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[80vw] scrollbar-none">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <DialogTitle>
                <Image
                  src="/logo.png"
                  alt="logo"
                  width={40}
                  height={40}
                  className="rounded-full"
                />
              </DialogTitle>
              <Button
                disabled={saveAnswer.isPending}
                variant={"outline"}
                onClick={() =>
                  saveAnswer.mutate({
                    projectId: project!.id,
                    question,
                    answer,
                    filesReferences
                  }, {
                    onSuccess: () => {
                      toast.success("Answer saved successfully!");
                      refetch();
                    },
                    onError: (error) => {
                      toast.error("Failed to save answer:");
                    }
                  })
                }
              >
                {" "}
                <Download />
                Save Answer
              </Button>
            </div>
          </DialogHeader>
          <MDEditor.Markdown
            source={answer}
            className="md-editor-white scrollbar-none max-h-[40vh] max-w-[75vw] scrollbar-none"
          />
          <div className="h-4"></div>
          <CodeReferences filesReferences={filesReferences} />
          <Button
            type="button"
            onClick={() => {
              setOpen(false);
            }}
            className="max-w-[75vw]"
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>
      <Card className="relative col-span-3">
        <CardHeader>
          <CardTitle>Ask a question</CardTitle>
          <p className="text-sm opacity-70">RepoGPT has knowledge of the codebase.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit}>
            <Textarea
              placeholder="Which file should I edit to change the home page?"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <div className="h-4"></div>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading && <Loader2 className="animate-spin" />}
              <span>Ask RepoGPT!</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
};

export default AskQuestionCard;
