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
import { XCircle, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useRouter } from "next/navigation";

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
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl text-red-600 border-red-200 hover:bg-red-50"
          disabled={isWithdrawing}
        >
          {isWithdrawing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="mr-2 h-4 w-4" />
          )}
          Withdraw
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Withdraw Submission?</AlertDialogTitle>
          <AlertDialogDescription>
            Withdraw the marketplace submission for &ldquo;{templateName}&rdquo;?
            You can re-submit later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleWithdraw}
            className="rounded-full bg-red-600 hover:bg-red-700"
          >
            Withdraw
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
