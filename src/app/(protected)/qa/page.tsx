"use client";

import useProject from "@/hooks/use-project";
import { api } from "@/trpc/react";
import React, { useState } from "react";
import AskQuestionCard from "../dashboard/ask-question-card";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  SheetHeader,
} from "@/components/ui/sheet";
import MDEditor from "@uiw/react-md-editor";
import CodeReferences from "../dashboard/code-references";

const QAPage = () => {
  const { projectId } = useProject();
  const { data: questions } = api.project.getQuestions.useQuery({ projectId });

  return (
    <>
      <AskQuestionCard />
      <div className="h-4" />
      <h1 className="text-xl font-semibold">Saved Questions</h1>
      <div className="h-2" />

      <div className="flex flex-col gap-2">
        {questions?.map((question) => (
          <Sheet key={question.id}>
            <SheetTrigger asChild>
              <div className="shadow-border flex cursor-pointer items-center gap-4 rounded-lg bg-white p-4">
                <img
                  className="rounded-full"
                  height={30}
                  width={30}
                  src={question.user.imageUrl ?? ""}
                  alt="User"
                />
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-2">
                    <p className="line-clamp-1 text-lg font-medium text-gray-700">
                      {question.question}
                    </p>
                    <span className="text-xs whitespace-nowrap text-gray-500">
                      {new Date(question.createdAt).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </span>
                  </div>
                  <p className="line-clamp-1 text-sm text-gray-500">
                    {question.answer}
                  </p>
                </div>
              </div>
            </SheetTrigger>

            <SheetContent className="sm:max-w-3xl p-6 bg-white rounded-xl shadow-lg">
              <SheetHeader className="pb-4 border-b">
                <SheetTitle className="text-2xl font-bold text-gray-800">
                  {question.question}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-6 max-h-[70vh] overflow-y-auto space-y-6 prose prose-slate dark:prose-invert scrollbar-none">
                <MDEditor.Markdown className="md-editor-white scrollbar-none max-h-[40vh] max-w-[75vw] scrollbar-none"
                  source={question.answer ?? ""}
                />
                <CodeReferences
                  filesReferences={(question.filesReferences ?? []) as any}
                />
              </div>
            </SheetContent>

          </Sheet>
        ))}
      </div>
    </>
  );
};

export default QAPage;