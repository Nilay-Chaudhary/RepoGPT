"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import useProject from "@/hooks/use-project";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

const InviteButton = () => {
  const { projectId } = useProject();
  const [open, setOpen] = useState(false);
  const [inviteLink, setInviteLink] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setInviteLink(`${window.location.origin}/join/${projectId}`);
    }
  }, [projectId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    toast.success("Copied to clipboard!");
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a team member!</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            Ask them to copy and paste this link
          </p>
          <Input
            className="mt-4 cursor-pointer"
            readOnly
            onClick={handleCopy}
            value={inviteLink}
          />
        </DialogContent>
      </Dialog>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="transition hover:cursor-pointer active:scale-95 bg-gray-50 text-black shadow-md ring-1 ring-gray-200 hover:bg-gray-100"
      >
        Invite a team member!
      </Button>
    </>
  );
};

export default InviteButton;
