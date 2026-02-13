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
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl text-orange-600 border-orange-200 hover:bg-orange-50"
          disabled={isProcessing}
        >
          {isProcessing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Update & Re-submit
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Update & Re-submit?</AlertDialogTitle>
          <AlertDialogDescription>
            This will update &ldquo;{templateName}&rdquo; from GitHub with the latest
            version and re-submit it for marketplace review.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleResubmit}
            className="rounded-full bg-orange-600 hover:bg-orange-700"
          >
            Update & Re-submit
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
