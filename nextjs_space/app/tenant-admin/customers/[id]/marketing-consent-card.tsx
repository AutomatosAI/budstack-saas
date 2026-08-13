"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";

/**
 * US-023: shows a customer's marketing-consent state and lets an admin with
 * canEditCustomers record or withdraw it manually (the API writes the audit
 * trail). Consent is a timestamp, not a flag: the date shown is the date it
 * was given — by the customer's own tick, or by this toggle.
 */
interface MarketingConsentCardProps {
  customerId: string;
  /** ISO timestamp of the current consent, or null for no consent. */
  marketingConsentAt: string | null;
}

export default function MarketingConsentCard({
  customerId,
  marketingConsentAt,
}: MarketingConsentCardProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const hasConsent = marketingConsentAt !== null;

  const setConsent = async (consent: boolean) => {
    if (
      consent &&
      !window.confirm(
        "Record marketing consent for this customer?\n\nOnly do this for an opt-in the customer actually gave (e.g. in writing or in person). This action is audit-logged.",
      )
    ) {
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/tenant-admin/customers/${customerId}/marketing-consent`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ consent }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to update marketing consent");
      }

      toast.success(
        consent ? "Marketing consent recorded" : "Marketing consent withdrawn",
      );
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update marketing consent",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-bs-fg-muted">
        {hasConsent ? (
          <>
            Consented on{" "}
            <span className="font-mono tabular-nums font-semibold text-bs-fg">
              {format(new Date(marketingConsentAt), "d MMM yyyy, HH:mm")}
            </span>
          </>
        ) : (
          "No consent"
        )}
      </p>
      <p className="text-xs text-bs-fg-muted">
        Set by the customer&apos;s own opt-in at signup or checkout, or recorded
        here. Cleared by unsubscribe or withdrawal. Changes are audit-logged.
      </p>
      <button
        type="button"
        onClick={() => setConsent(!hasConsent)}
        disabled={isSaving}
        className={`bs-btn w-full disabled:opacity-50 ${
          hasConsent ? "bs-btn-ghost" : "bs-btn-green"
        }`}
      >
        {isSaving
          ? "Saving..."
          : hasConsent
            ? "Withdraw consent"
            : "Record consent"}
      </button>
    </div>
  );
}
