"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import {
  PLANS,
  parsePlan,
  type Plan,
  type PlanMirrorFailureReason,
  type PlanUpdateResponse,
} from "@/lib/entitlements/plan";

/**
 * The operator's plan selector (SEO Supercharge US-012).
 *
 * Saves on its own — deliberately NOT part of the surrounding form's Edit /
 * Save Changes flow, because that flow PATCHes the whole tenant and provisions
 * Railway domains as a side effect. A plan change should cost one small write.
 *
 * Its own file rather than more lines in tenant-edit-form.tsx, which is already
 * past the repo's file-size guidance.
 */

const PLAN_COPY: Readonly<Record<Plan, { label: string; description: string }>> = {
  trial: {
    label: "Trial",
    description:
      "Launch window — every feature unlocked, Pro included, so the tenant sees what they would be buying.",
  },
  basic: {
    label: "Basic — $99/mo",
    description:
      "SEO essentials: page metadata, sitemaps, canonicals. Pro features are locked in the UI and 403 at the API.",
  },
  pro: {
    label: "Pro — $169/mo",
    description:
      "Adds structured data, the OG image studio, redirects, indexing controls, the audit panel and AI assist.",
  },
  custom: {
    label: "Custom",
    description: "Bespoke tier — everything unlocked, negotiated off-platform.",
  },
};

const MIRROR_WARNING: Readonly<Record<PlanMirrorFailureReason, string>> = {
  no_clerk_org:
    "This tenant has no Clerk organisation, so there was nothing to mirror to. Entitlements are unaffected.",
  clerk_write_failed:
    "Clerk rejected the metadata write. Entitlements are unaffected — save again once Clerk is healthy.",
};

interface TenantPlanControlProps {
  tenantId: string;
  /** Raw `tenants.plan`. Parsed fail-closed so the control always shows the plan that is actually in force. */
  plan: string;
}

export default function TenantPlanControl({
  tenantId,
  plan,
}: TenantPlanControlProps) {
  const router = useRouter();
  const savedPlan = parsePlan(plan);
  const [selected, setSelected] = useState<Plan>(savedPlan);
  const [isSaving, setIsSaving] = useState(false);

  const isDirty = selected !== savedPlan;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/plan`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selected }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.error || "Failed to update plan");
      }

      const result = (await res.json()) as Partial<PlanUpdateResponse>;
      const appliedPlan = parsePlan(result.plan);

      toast.success(
        result.changed
          ? `Plan set to ${PLAN_COPY[appliedPlan].label}`
          : `Already on ${PLAN_COPY[appliedPlan].label} — Clerk re-synced`,
      );

      // The column committed before this call returned; a failed mirror is a
      // warning about Clerk visibility only, never about what the tenant gets.
      if (result.mirrored === false) {
        const reason = result.mirrorReason;
        toast.warning("Plan saved — Clerk mirror did not sync", {
          description:
            reason && reason in MIRROR_WARNING
              ? MIRROR_WARNING[reason]
              : "Entitlements are unaffected; the plan column is authoritative.",
        });
      }

      router.refresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to update plan");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="col-span-2 space-y-2 rounded-bs-md border border-bs-border-100 bg-bs-card-2/50 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Label htmlFor="tenant-plan" className="text-bs-fg">
          Plan
        </Label>
        <span className="text-xs text-bs-fg-muted">Saved separately</span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <select
          id="tenant-plan"
          className="bs-select w-full sm:w-[240px]"
          value={selected}
          disabled={isSaving}
          onChange={(e) => setSelected(parsePlan(e.target.value))}
        >
          {PLANS.map((p) => (
            <option key={p} value={p}>
              {PLAN_COPY[p].label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="bs-btn bs-btn-green bs-btn-sm"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Saving...
            </>
          ) : (
            "Save plan"
          )}
        </button>
        {isDirty && (
          <span className="text-xs text-bs-warning">Unsaved change</span>
        )}
      </div>

      <p className="text-sm text-bs-fg-muted">{PLAN_COPY[selected].description}</p>
      <p className="text-xs text-bs-fg-muted">
        Entitlements read this column and nothing else. The Clerk organisation&apos;s{" "}
        <code>publicMetadata.plan</code> is a write-only mirror for visibility —
        saving an unchanged plan re-syncs it.
      </p>
    </div>
  );
}
