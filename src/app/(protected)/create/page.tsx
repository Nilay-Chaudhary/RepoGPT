"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useRefetch from "@/hooks/use-refetch";
import { api } from "@/trpc/react";
import { ChevronRight, ChevronRightIcon, Info } from "lucide-react";
import React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

type FormInput = {
  repoUrl: string;
  projectName: string;
  githubToken?: string;
};

const CreatePage = () => {
  const { register, handleSubmit, reset } = useForm<FormInput>();
  const refetch = useRefetch();
  const [creditChecked, setCreditChecked] = useState(false);

  const checkCredits = api.project.checkCredites.useMutation({
    onSuccess: (data) => {
      setCreditChecked(true);
    },
    onError: () => {
      toast.error("Failed to check credits");
    },
  });

  const createProject = api.project.createProject.useMutation({
    onSuccess: () => {
      toast.success("Project created successfully!");
      refetch();
      reset();
      setCreditChecked(false); // reset flow
    },
    onError: () => {
      toast.error("Failed to create project");
    },
  });

  const onSubmit = (data: FormInput) => {
    if (!creditChecked) {
      checkCredits.mutate({
        githubUrl: data.repoUrl,
        githubToken: data.githubToken,
      });
    } else {
      createProject.mutate({
        name: data.projectName,
        githubUrl: data.repoUrl,
        githubToken: data.githubToken,
      });
    }
  };

  const isLoading = checkCredits.isPending || createProject.isPending;
  const hasEnoughCredits =
    checkCredits.data?.userCredits != null
      ? checkCredits.data.fileCount <= checkCredits.data.userCredits
      : true;

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center rounded-4xl bg-[#191B1E] p-4 md:flex-row">
      <img
        src="/repoGPT.png"
        alt="RepoGPT Logo"
        className="animate-small-bounce max-w-[180px] rounded-full sm:max-w-[250px] md:max-w-[300px] lg:max-w-[324px] xl:max-w-[486px]"
      />

      <div className="mt-8 w-full max-w-md rounded-2xl bg-white p-6 md:mt-0 md:p-10">
        <div className="flex flex-col justify-center gap-1">
          <h1 className="text-2xl font-bold">Link your GitHub Repository</h1>
          <p className="text-muted-foreground text-sm font-semibold">
            Enter your repository&apos;s URL to analyse it with RepoGPT
          </p>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-6 flex flex-col gap-4"
        >
          <Input
            {...register("projectName", { required: true })}
            required
            placeholder="Project Name"
          />
          <Input
            {...register("repoUrl", { required: true })}
            required
            placeholder="GitHub URL"
            type="url"
          />
          <Input
            {...register("githubToken")}
            placeholder="GitHub Token (Optional)"
          />

          {creditChecked && checkCredits.data && (
            <div className="mt-4 rounded-md border border-orange-200 bg-orange-50 px-4 py-2 text-orange-700 transition-all duration-300">
              <div className="flex items-center gap-2">
                <Info className="size-4" />
                <p className="text-sm">
                  You will be charged{" "}
                  <strong>{checkCredits.data.fileCount}</strong> credits for
                  this repository
                </p>
              </div>
              <p className="ml-6 text-sm text-blue-600">
                You have <strong>{checkCredits.data.userCredits}</strong>{" "}
                credits remaining
              </p>
            </div>
          )}

          <Button
            type="submit"
            className="mt-4 flex items-center justify-center"
            disabled={isLoading || !hasEnoughCredits}
          >
            {isLoading ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading…</span>
              </div>
            ) : creditChecked ? (
              <>
                <div className="flex items-center space-x-2">
                  Create Project
                <ChevronRightIcon />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center space-x-2">
                  Check Credits
                  <ChevronRightIcon />
                </div>
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default CreatePage;