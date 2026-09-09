"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { ArrowRight, UploadCloud } from "lucide-react";
import { ReUploadIdDocument } from "@/components/shop/ReUploadIdDocument";

/**
 * Legacy AML → ID-upload self-service switch (dashboard card).
 *
 * Shown to customers whose Dr Green client is still on the old First-AML KYC
 * path (verificationType === "KYC") on an ID-upload store. One explicit
 * consent click calls /api/store/[slug]/verify/switch-to-id (Dr Green
 * enforces eligibility server-side), then the existing ID upload form takes
 * over in place. The switch itself stores nothing locally — the dashboard
 * re-reads the live Dr Green client via onDone after the upload lands.
 */
export function SwitchToIdVerification({
  slug,
  onDone,
  rejectionReason,
}: {
  slug: string;
  onDone?: () => void;
  // Set when this legacy client was previously admin-rejected — acknowledge
  // it in the offer copy instead of hiding the switch behind the plain
  // re-upload card (which would leave their First-AML caseId live).
  rejectionReason?: string;
}) {
  const [switching, setSwitching] = useState(false);
  const [switched, setSwitched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doSwitch = async () => {
    setError(null);
    setSwitching(true);
    try {
      const res = await fetch(`/api/store/${slug}/verify/switch-to-id`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(
          body?.error || "Failed to switch your verification method",
        );
      }
      setSwitched(true);
      toast.success("You're on ID verification now — upload your ID below.");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to switch your verification method";
      setError(message);
      toast.error(message);
    } finally {
      setSwitching(false);
    }
  };

  if (switched) {
    return (
      <CompleteIdUpload
        slug={slug}
        onUploaded={onDone}
        heading="Upload your ID"
        body="One last step: upload a clear photo of a valid government ID (not a selfie). We'll review it and email you once your account is approved."
      />
    );
  }

  return (
    <div className="mb-8 rounded-2xl border border-sky-200 bg-sky-50/70 p-5">
      <div className="flex items-start gap-3">
        <UploadCloud className="mt-0.5 h-6 w-6 flex-shrink-0 text-sky-600" />
        <div className="flex-1">
          <h3 className="font-semibold text-sky-900">
            A faster way to get verified
          </h3>
          {rejectionReason && (
            <p className="mt-1 text-sm text-sky-800">
              <span className="font-medium">
                Your earlier verification wasn&apos;t approved:
              </span>{" "}
              {rejectionReason}
            </p>
          )}
          <p className="mt-1 text-sm text-sky-800">
            Your account is waiting on our older KYC process. South African
            customers can now verify with a simple ID upload instead — switch
            below, upload a photo of your government ID, and we&apos;ll review
            it. No new account needed.
          </p>
          {error && (
            <p className="mt-2 text-sm font-medium text-rose-700">{error}</p>
          )}
          <Button
            onClick={doSwitch}
            disabled={switching}
            className="mt-3"
          >
            {switching ? "Switching…" : "Switch to ID verification"}
            {!switching && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Card for a customer already on the ID path with no recorded upload —
 * a switcher who left before uploading, or an ID registrant whose inline
 * upload never completed. Wraps the existing upload form with neutral
 * "finish your verification" copy (the amber "being reviewed" banner would
 * be false here: there is nothing to review yet).
 */
export function CompleteIdUpload({
  slug,
  onUploaded,
  heading = "Finish your verification",
  body = "We still need your ID to verify your account. Upload a clear photo of a valid government ID (not a selfie) and we'll review it.",
}: {
  slug: string;
  onUploaded?: () => void;
  heading?: string;
  body?: string;
}) {
  return (
    <div className="mb-8 rounded-2xl border border-sky-200 bg-sky-50/70 p-5">
      <div className="flex items-start gap-3">
        <UploadCloud className="mt-0.5 h-6 w-6 flex-shrink-0 text-sky-600" />
        <div className="flex-1">
          <h3 className="font-semibold text-sky-900">{heading}</h3>
          <p className="mt-1 text-sm text-sky-800">{body}</p>
          <ReUploadIdDocument slug={slug} onUploaded={onUploaded} />
        </div>
      </div>
    </div>
  );
}
