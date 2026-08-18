"use client";

/**
 * US-017 — the campaign compose screen.
 *
 * Deliberately NOT `EmailEditor` with extra props. That component's whole job is
 * arbitrating between two representations of one email (a document and raw
 * HTML) and warning the author before a switch throws one of them away. A
 * campaign has no such conflict: it is composed visually, always, because the
 * unsubscribe footer comes from the shell the pipeline wraps the document in
 * (`lib/email/campaign-content.ts`). Giving campaigns an HTML mode would mean
 * accepting marketing email whose only compliance guarantee is that the author
 * remembered to type a link.
 *
 * So this screen reuses the PARTS instead: the same `EmailComposer`, the same
 * `EmailEditorPanes` split, and the same server-rendered preview — asking it
 * for the marketing category, which is what puts the unsubscribe line in the
 * preview the author approves.
 */

import React, { useCallback, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import type { CampaignAudience } from "@/lib/email/campaign-audience";
import {
  CAMPAIGN_NAME_MAX,
  CAMPAIGN_SUBJECT_MAX,
} from "@/lib/email/campaign-fields";
import { CAMPAIGN_EMAIL_CATEGORY } from "@/lib/email/campaign-rules";
import type { EmailContentJson } from "@/lib/email/email-content-json";

import { CampaignAudiencePicker } from "./CampaignAudiencePicker";
import { EmailComposer } from "./EmailComposer";
import { EmailEditorPanes } from "./EmailEditorPanes";
import { emailPreviewRequest } from "./email-preview-request";
import { EMPTY_EMAIL_DOC } from "./email-editor-mode";

/** What the compose screen hands back to a save. */
export interface CampaignDraft {
  name: string;
  subject: string;
  contentJson: EmailContentJson;
  /**
   * US-018's rule, omitted while the author has not chosen one. A draft
   * without an audience is legitimate — it simply has nobody to go to yet, and
   * US-019's send is where that becomes a refusal.
   */
  audience?: CampaignAudience;
}

export interface CampaignEditorProps {
  readonly initialData?: {
    readonly name?: string;
    readonly subject?: string;
    /** Straight off the Json column, so genuinely unknown until narrowed. */
    readonly contentJson?: EmailContentJson | null;
    /** Likewise narrowed by the page, from the `audience` Json column. */
    readonly audience?: CampaignAudience | null;
  };
  readonly onSave: (draft: CampaignDraft) => Promise<void>;
  readonly isSaving?: boolean;
  /** US-015's render endpoint. Omitted leaves the screen without a preview. */
  readonly previewUrl?: string;
  /** Absent until the draft exists, which is when a count can be asked for. */
  readonly campaignId?: string;
}

export function CampaignEditor({
  initialData,
  onSave,
  isSaving = false,
  previewUrl,
  campaignId,
}: CampaignEditorProps) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [subject, setSubject] = useState(initialData?.subject ?? "");
  const [contentJson, setContentJson] = useState<EmailContentJson | null>(
    initialData?.contentJson ?? null,
  );
  const [audience, setAudience] = useState<CampaignAudience | null>(
    initialData?.audience ?? null,
  );

  // Stable identity, and it must stay stable: the composer's onUpdate closure
  // is created once inside the editor instance, so a handler rebuilt on every
  // render would leave the editor calling a stale one. The whole document
  // arrives each time, so nothing here reads the previous state.
  const handleDocumentChange = useCallback((doc: EmailContentJson) => {
    setContentJson(doc);
  }, []);

  const handleSave = async () => {
    if (!name.trim() || !subject.trim()) {
      toast.error("Name and subject are required");
      return;
    }
    await onSave({
      name: name.trim(),
      subject: subject.trim(),
      // Never null: the stored HTML is DERIVED from this document server-side,
      // so an untouched composer has to send an empty document rather than
      // nothing at all. Same substitution `payloadContentJson` makes for a
      // template save in Simple mode, and the same one the preview request
      // below makes, so all three describe one email.
      contentJson: contentJson ?? EMPTY_EMAIL_DOC,
      // Omitted rather than sent as null: the schema has no "clear it" state,
      // and an unset audience is the column's default anyway.
      ...(audience ? { audience } : {}),
    });
  };

  // h-full, not a viewport calc — same fix as EmailEditor: both hosts wrap
  // this in a sized `flex-1 overflow-hidden` box, and overshooting it let
  // caret-reveal scrolling push the header card (Save/Send) out of reach.
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="bs-card bs-card-pad shrink-0">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <label htmlFor="campaign-name" className="bs-eyebrow">
              Campaign Name
            </label>
            <input
              id="campaign-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. October newsletter"
              // The server's cap, applied at the keyboard: over it, the schema
              // rejects the whole save as a bare "Invalid request", which is
              // not a sentence anybody can act on.
              maxLength={CAMPAIGN_NAME_MAX}
              className="bs-input w-full"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="campaign-subject" className="bs-eyebrow">
              Subject Line
            </label>
            <input
              id="campaign-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="What's new this month"
              maxLength={CAMPAIGN_SUBJECT_MAX}
              className="bs-input w-full"
            />
          </div>
          <div className="flex justify-end pb-0.5">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="bs-btn bs-btn-green"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />{" "}
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> <span>Save draft</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <CampaignAudiencePicker
        value={audience}
        onChange={setAudience}
        campaignId={campaignId}
      />

      <div className="flex-1 overflow-hidden rounded-bs-md border border-bs-border-100 bg-bs-canvas">
        <EmailEditorPanes
          previewUrl={previewUrl}
          previewRequest={emailPreviewRequest({
            mode: "simple",
            contentHtml: "",
            contentJson,
            // Marketing, so the preview carries the unsubscribe footer the save
            // enforces. No templateId: a campaign is not a template row, and
            // sending one would point the preview at somebody's template.
            category: CAMPAIGN_EMAIL_CATEGORY,
          })}
          editor={
            <EmailComposer
              value={contentJson}
              onChange={handleDocumentChange}
              uploadUrl="/api/tenant-admin/upload"
            />
          }
        />
      </div>
    </div>
  );
}
