"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { Check, X, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { useRouter } from "next/navigation";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

interface ReviewActionsProps {
  submissionId: string;
  status: string;
}

export default function ReviewActions({
  submissionId,
  status,
}: ReviewActionsProps) {
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const router = useRouter();

  const isDisabled =
    status === "approved" || status === "rejected" || status === "withdrawn";

  const handleApprove = async () => {
    setIsLoading("approve");
    try {
      const res = await fetch(
        `/api/super-admin/submissions/${submissionId}/approve`,
        {
          method: "POST",
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Submission approved and published to marketplace");
      router.push("/super-admin/templates?tab=submissions");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to approve");
    } finally {
      setIsLoading(null);
    }
  };

  const handleReject = async () => {
    if (!feedback.trim()) {
      toast.error("Please provide feedback before rejecting");
      return;
    }
    setIsLoading("reject");
    try {
      const res = await fetch(
        `/api/super-admin/submissions/${submissionId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback: feedback.trim() }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Submission rejected");
      router.push("/super-admin/templates?tab=submissions");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to reject");
    } finally {
      setIsLoading(null);
    }
  };

  const handleRequestChanges = async () => {
    if (!feedback.trim()) {
      toast.error("Please provide feedback before requesting changes");
      return;
    }
    setIsLoading("changes");
    try {
      const res = await fetch(
        `/api/super-admin/submissions/${submissionId}/request-changes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback: feedback.trim() }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Changes requested");
      router.push("/super-admin/templates?tab=submissions");
      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to request changes");
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="feedback" className="text-bs-fg">
          Reviewer Feedback
        </Label>
        <Textarea
          id="feedback"
          placeholder="Provide feedback for the template author..."
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
          disabled={isDisabled || isLoading !== null}
        />
        <p className="text-xs text-bs-fg-muted">
          Required for Reject and Request Changes actions.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleRequestChanges}
          disabled={isDisabled || isLoading !== null}
          className="bs-btn bs-btn-ghost"
        >
          {isLoading === "changes" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <MessageSquare className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          Request Changes
        </button>

        <button
          type="button"
          onClick={handleReject}
          disabled={isDisabled || isLoading !== null}
          className="bs-btn bs-btn-danger"
        >
          {isLoading === "reject" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <X className="mr-2 h-4 w-4" aria-hidden="true" />
          )}
          Reject
        </button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              disabled={isDisabled || isLoading !== null}
              className="bs-btn bs-btn-green"
            >
              {isLoading === "approve" ? (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Check className="mr-2 h-4 w-4" aria-hidden="true" />
              )}
              Approve
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bs-dialog-content">
            <AlertDialogHeader>
              <AlertDialogTitle
                className="text-[22px] leading-tight"
                style={sectionTitleStyle}
              >
                Approve this submission?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-bs-fg-muted">
                This will publish the template to the marketplace. All tenants
                will be able to clone it.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bs-btn bs-btn-ghost">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleApprove}
                className="bs-btn bs-btn-green"
              >
                Approve &amp; Publish
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
