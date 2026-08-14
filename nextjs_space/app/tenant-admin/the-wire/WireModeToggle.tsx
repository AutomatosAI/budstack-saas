"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Sparkles } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";

/**
 * MANUAL ↔ ASSISTED switch for The Wire (US-013). ASSISTED lets Automatos
 * agents deliver draft posts for review; the entitlement gate is enforced
 * server-side — this control is presentation.
 */
export function WireModeToggle({
  mode,
  entitled,
}: {
  mode: string;
  entitled: boolean;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const assisted = mode === "ASSISTED";

  const handleChange = async (checked: boolean) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/tenant-admin/wire-mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wireMode: checked ? "ASSISTED" : "MANUAL" }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to change Wire mode");
      }
      toast.success(
        checked
          ? "Assisted mode on — Automatos drafts will appear here for review."
          : "Manual mode — only your own posts.",
      );
      router.refresh();
    } catch (error: any) {
      toast.error(error?.message || "Failed to change Wire mode");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-bs-md border border-bs-border-100 bg-bs-card-2 px-4 py-2.5">
      <Sparkles className="h-4 w-4 text-bs-green-soft" aria-hidden="true" />
      <div className="text-sm">
        <span className="font-medium text-bs-fg flex items-center gap-2">
          Assisted drafts
          {!entitled && (
            <span className="inline-flex items-center gap-1 rounded-full border border-bs-border-100 px-2 py-0.5 text-xs text-bs-fg-muted">
              <Lock className="h-3 w-3" aria-hidden="true" /> Pro
            </span>
          )}
        </span>
        <span className="text-bs-fg-muted">
          {entitled
            ? "Automatos writes drafts; you review and publish."
            : "Included in the Pro plan."}
        </span>
      </div>
      <Switch
        checked={assisted}
        disabled={!entitled || isSaving}
        onCheckedChange={handleChange}
        aria-label="Toggle assisted Wire drafts"
      />
    </div>
  );
}
