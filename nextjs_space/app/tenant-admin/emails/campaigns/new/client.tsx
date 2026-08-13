"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  CampaignEditor,
  type CampaignDraft,
} from "@/components/admin/email/CampaignEditor";
import { saveCampaign } from "@/components/admin/email/campaign-save";

export function NewCampaignClient() {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (draft: CampaignDraft) => {
    setIsSaving(true);
    try {
      const campaign = await saveCampaign(draft);
      toast.success("Draft saved");
      router.refresh();
      router.push(`/tenant-admin/emails/campaigns/${campaign.id}`);
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
          New Campaign
        </h1>
        <p className="bs-page-subtitle">
          Write a newsletter and save it as a draft.
        </p>
      </div>
      <div className="flex-1 overflow-hidden pt-6">
        <CampaignEditor
          onSave={handleSave}
          isSaving={isSaving}
          previewUrl="/api/tenant-admin/email-templates/preview"
        />
      </div>
    </div>
  );
}
