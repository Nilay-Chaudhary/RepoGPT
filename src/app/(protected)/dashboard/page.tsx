"use client";
import useProject from "@/hooks/use-project";
import { ExternalLink, Github, FolderOpen, FilePlus, Plus } from "lucide-react";
import Link from "next/link";
import React from "react";
import CommitLog from "./commit-log";
import AskQuestionCard from "./ask-question-card";
import MeetingCard from "./meeting-card";
import ArchiveButton from "./archive-button";
import InviteButton from "./invite-button";
import TeamMembers from "./team-members";

const DashboardPage = () => {
  const { project } = useProject();
  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
        <FolderOpen className="w-12 h-12" />
        <p className="text-lg">No project selected</p>
        <p className="text-sm text-gray-400">
          Select or create a project to get started.
        </p>
        <Link href="/create">
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md shadow hover:bg-blue-600 transition cursor-pointer">
            <Plus className="w-4 h-4" />
            Create Project
          </div>
        </Link>
      </div>
    );
  }
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-y-4">
        <div className="bg-primary w-fit rounded-md px-3 py-4">
          <div className="flex items-center">
            <Github className="size5 text-white" />
            <div className="ml-2 space-y-2">
              <p className="text-sm font-medium text-white">
                This project is linked to:{" "}
                <Link
                  href={project?.githubUrl ?? ""}
                  className="inline-flex items-center text-white/80 hover:underline"
                >
                  {project?.githubUrl}
                  <ExternalLink className="ml-1 size-4" />
                </Link>
              </p>

            </div>

          </div>
        </div>


        <div className="h-4"></div>

        <div className="flex items-center gap-4">
          <TeamMembers />
          <InviteButton />
          <ArchiveButton />
        </div>
      </div>

      <div className="mt-4">
        {project?.indexingStatus === "IN_PROGRESS" && (
          <div className="flex items-center gap-2 rounded-md bg-blue-100 px-3 py-2 text-sm font-medium text-blue-800 ring-1 ring-blue-300">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            <span>File processing in progress...</span>
          </div>
        )}
      </div>
      <div className="mt-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
          <AskQuestionCard />
          <MeetingCard />
        </div>
      </div>

      <div className="mt-8">
        <CommitLog />
      </div>
    </div>
  );
};

export default DashboardPage;
