"use client";

import { useState } from "react";
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

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

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
        `/api/tenant-admin/templates/${templateId}/update-from-github`,
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
        <button
          type="button"
          className="bs-btn bs-btn-ghost bs-btn-sm"
          disabled={isUpdating}
          title="Update from GitHub"
        >
          {isUpdating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bs-dialog-content">
        <AlertDialogHeader>
          <AlertDialogTitle
            className="text-[22px] leading-tight"
            style={sectionTitleStyle}
          >
            Update from GitHub?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-bs-fg-muted">
            Update &ldquo;{templateName}&rdquo; from GitHub? This will overwrite
            the template files with the latest version from the repo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bs-btn bs-btn-ghost">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleUpdate}
            className="bs-btn bs-btn-green"
          >
            Update
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
