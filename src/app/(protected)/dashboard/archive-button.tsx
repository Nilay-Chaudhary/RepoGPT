"use client";

import { Button } from "@/components/ui/button";
import useProject from "@/hooks/use-project";
import useRefetch from "@/hooks/use-refetch";
import { api } from "@/trpc/react";
import React from "react";
import { toast } from "sonner";

const ArchiveButton = () => {
  const archiveProject = api.project.archiveProject.useMutation();
  const { projectId, setProjectId } = useProject();
  const refetch = useRefetch();

  const handleArchive = () => {
    const confirmed = window.confirm(
      "Are you sure you want to archive this project? This action cannot be undone."
    );
    if (!confirmed) return;

    archiveProject.mutate(
      { projectId },
      {
        onSuccess: () => {
          toast.success("Project archived");
          setProjectId("");
          refetch();
        },
        onError: () => {
          toast.error("Failed to archive project");
        },
      }
    );
  };

  return (
    <Button
      disabled={archiveProject.isPending}
      variant="destructive"
      size="sm"
      onClick={handleArchive}
      className="hover:cursor-pointer active:scale-95 active:brightness-90 transition-all duration-150"
    >
      Archive
    </Button>
  );
};

export default ArchiveButton;
