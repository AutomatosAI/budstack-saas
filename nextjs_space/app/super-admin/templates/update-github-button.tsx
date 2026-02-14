"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RefreshCw, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useRouter } from "next/navigation";

interface UpdateGitHubButtonProps {
  templateId: string;
  templateName: string;
}

export default function UpdateGitHubButton({
  templateId,
  templateName,
}: UpdateGitHubButtonProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const router = useRouter();

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch(
        `/api/super-admin/templates/${templateId}/update-from-github`,
        { method: "POST" },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update template");
      }

      toast.success("Template updated from GitHub");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to update template");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={isUpdating}
          title="Update from GitHub"
        >
          {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Update from GitHub?</AlertDialogTitle>
          <AlertDialogDescription>
            Update &ldquo;{templateName}&rdquo; from GitHub? This will overwrite
            the template files with the latest version from the repo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleUpdate}
            className="rounded-full bg-blue-600 hover:bg-blue-700"
          >
            Update
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
