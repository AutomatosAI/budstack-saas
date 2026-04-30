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

interface ResubmitButtonProps {
  templateId: string;
  templateName: string;
}

export default function ResubmitButton({
  templateId,
  templateName,
}: ResubmitButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const router = useRouter();

  const handleResubmit = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch(
        `/api/tenant-admin/templates/${templateId}/resubmit`,
        { method: "POST" },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to re-submit template");
      }

      toast.success("Template updated and re-submitted for review");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to re-submit template");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="bs-btn bs-btn-ghost bs-btn-sm text-bs-warn"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2
              className="mr-2 h-4 w-4 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          Update & Re-submit
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bs-dialog-content">
        <AlertDialogHeader>
          <AlertDialogTitle
            className="text-[22px] leading-tight"
            style={sectionTitleStyle}
          >
            Update & Re-submit?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-bs-fg-muted">
            This will update &ldquo;{templateName}&rdquo; from GitHub with the
            latest version and re-submit it for marketplace review.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bs-btn bs-btn-ghost">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleResubmit}
            className="bs-btn bs-btn-green"
          >
            Update & Re-submit
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
