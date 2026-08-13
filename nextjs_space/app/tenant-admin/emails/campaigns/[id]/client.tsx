"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";

import {
  CampaignEditor,
  type CampaignDraft,
} from "@/components/admin/email/CampaignEditor";
import { saveCampaign } from "@/components/admin/email/campaign-save";
import { CAMPAIGN_LOCKED_MESSAGE } from "@/lib/email/campaign-rules";
import type { CampaignStatus } from "@prisma/client";
import type { EmailContentJson } from "@/lib/email/email-content-json";

interface EditCampaignClientProps {
  readonly campaign: {
    readonly id: string;
    readonly name: string;
    readonly subject: string;
    readonly status: CampaignStatus;
    readonly contentJson: EmailContentJson | null;
  };
  /** DRAFT or SCHEDULED. Anything else is history and opens read-only. */
  readonly isEditable: boolean;
}

export function EditCampaignClient({
  campaign,
  isEditable,
}: EditCampaignClientProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (draft: CampaignDraft) => {
    setIsSaving(true);
    try {
      await saveCampaign(draft, campaign.id);
      toast.success("Draft saved");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save campaign",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col">
      <div className="bs-page-header-centered border-b border-bs-border-100 pb-6">
        <h1
          className="bs-page-title"
          style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
        >
          {isEditable ? "Edit Campaign" : "Campaign"}
        </h1>
        <p className="bs-page-subtitle">
          {campaign.name} · <span className="font-mono">{campaign.status}</span>
        </p>
      </div>

      {isEditable ? (
        <div className="flex-1 overflow-hidden pt-6">
          <CampaignEditor
            initialData={campaign}
            onSave={handleSave}
            isSaving={isSaving}
            previewUrl="/api/tenant-admin/email-templates/preview"
          />
        </div>
      ) : (
        // The server refuses this edit with a 409 either way; showing the
        // composer first would let an author retype a sent campaign and only
        // then be told none of it could be kept.
        <div className="pt-6">
          <div className="bs-card bs-card-pad flex items-start gap-3 text-sm text-bs-fg-muted">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{CAMPAIGN_LOCKED_MESSAGE}</p>
          </div>
        </div>
      )}
    </div>
  );
}
