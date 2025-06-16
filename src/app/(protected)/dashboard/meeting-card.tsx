"use client";
import React, { useState } from 'react';
import { CircularProgressbarWithChildren, buildStyles } from 'react-circular-progressbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Presentation, Upload } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { api } from '@/trpc/react';
import useProject from '@/hooks/use-project';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useMutation } from '@tanstack/react-query';

const MeetingCard = () => {
  const { project } = useProject();
  const processMeeting = useMutation({
    mutationFn: async (data: { meetingUrl: string; meetingId: string; projectId: string; }) => {
      const response = await axios.post('/api/process-meeting', data);
      return response.data;
    },
  });
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const router = useRouter();
  const uploadMeeting = api.project.uploadMeeting.useMutation();

  const { getRootProps, getInputProps } = useDropzone({
    accept: { 'audio/*': ['.mp3', '.wav', '.ogg'] },
    multiple: false,
    maxSize: 50_000_000,
    onDrop: async (acceptedFiles) => {
      if (!project) return;
      setIsUploading(true);
      const file = acceptedFiles[0];
      if (!file) return;

      try {
        const downloadURL = await uploadToCloudinary(file, setProgress);

        uploadMeeting.mutate(
          { projectId: project.id, meetingUrl: downloadURL, name: file.name },
          {
            onSuccess: async (meeting) => {
              toast.success('Meeting uploaded successfully');
              await processMeeting.mutateAsync({ meetingUrl: downloadURL, meetingId: meeting.id, projectId: project.id });
              router.push('/meetings');
            },
            onError: () => toast.error('Error uploading meeting'),
            onSettled: () => setIsUploading(false),
          }
        );
      } catch (error) {
        console.error(error);
        toast.error('Upload to Cloudinary failed');
        setIsUploading(false);
      }
    },
  });

  return (
    <Card className="items-center col-span-2 flex flex-col justify-center p-10" {...getRootProps()}>
      {!isUploading ? (
        <>
          <Presentation className="h-10 w-10 animate-bounce" />
          <h3 className="mt-1 text-sm font-semibold">Create a new meeting</h3>
          <p className="mt-1 text-center text-sm text-gray-500">Analyse your meeting with RepoGPT.<br />Powered by AI.</p>
          <div className="mt-1">
            <Button disabled={isUploading}>
              <Upload className="mr-1.5 -ml-0.5 h-5 w-5" aria-hidden="true" />
              Upload Meeting
              <input className="hidden" {...getInputProps()} />
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center">
          <div className="w-28 h-28 relative">
            <CircularProgressbarWithChildren
              value={progress}
              styles={buildStyles({
                pathColor: "#2563eb",
                trailColor: "#e5e7eb",
              })}
            >
              <div className="absolute inset-0 flex items-center justify-center text-[#2563eb] text-2xl font-medium">
                {progress}%
              </div>
            </CircularProgressbarWithChildren>
          </div>
          <p className="mt-2 text-center text-sm text-gray-500">
            Uploading your Meeting...
          </p>
        </div>

      )}
    </Card>
  );
};

export default MeetingCard;