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
import { XCircle, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useRouter } from "next/navigation";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

interface WithdrawButtonProps {
  templateId: string;
  templateName: string;
}

export default function WithdrawButton({
  templateId,
  templateName,
}: WithdrawButtonProps) {
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const router = useRouter();

  const handleWithdraw = async () => {
    setIsWithdrawing(true);
    try {
      const response = await fetch(
        `/api/tenant-admin/templates/${templateId}/withdraw-submission`,
        { method: "POST" },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to withdraw submission");
      }

      toast.success("Submission withdrawn");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to withdraw submission");
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="bs-btn bs-btn-ghost bs-btn-sm text-bs-danger"
          disabled={isWithdrawing}
        >
          {isWithdrawing ? (
            <Loader2
              className="mr-2 h-4 w-4 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          Withdraw
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bs-dialog-content">
        <AlertDialogHeader>
          <AlertDialogTitle
            className="text-[22px] leading-tight"
            style={sectionTitleStyle}
          >
            Withdraw Submission?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-bs-fg-muted">
            Withdraw the marketplace submission for &ldquo;{templateName}&rdquo;?
            You can re-submit later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bs-btn bs-btn-ghost">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleWithdraw}
            className="bs-btn bs-btn-danger"
          >
            Withdraw
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
