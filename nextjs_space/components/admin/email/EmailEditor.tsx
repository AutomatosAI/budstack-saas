"use client";

/**
 * The template editing screen, shared by the tenant-admin and super-admin pages.
 *
 * US-012 gave it two modes over one piece of content:
 *
 *   Simple   — `EmailComposer` writes `contentJson`; the server derives the
 *              stored `contentHtml` from it (`lib/email/email-render-pipeline.ts`).
 *   Advanced — the pre-US-012 HTML source pane, writing `contentHtml` directly.
 *
 * The two representations cannot both be authoritative, and the save pipeline
 * resolves that by always preferring the document. So the mode is not a view
 * toggle: it decides which representation a save keeps and which one it
 * overwrites. Every lossy switch goes through a confirm dialog, and the rules
 * for when that is live in `email-editor-mode.ts` where they can be asserted.
 */

import React, { useCallback, useMemo, useState } from "react";
import { Info, Loader2, Save, Send } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EmailContentJson } from "@/lib/email/email-content-json";

import { EmailComposer } from "./EmailComposer";
import { EmailEditorPanes } from "./EmailEditorPanes";
import { EmailHtmlPane } from "./EmailHtmlPane";
import { emailPreviewRequest } from "./email-preview-request";
import {
  asEmailContentJson,
  DEFAULT_TEMPLATE_HTML,
  initialEmailEditorMode,
  isLegacyHtmlTemplate,
  modeSwitchWarning,
  payloadContentJson,
  type EmailEditorMode,
} from "./email-editor-mode";

export interface EmailTemplateData {
  name: string;
  subject: string;
  category: string;
  description?: string;
  contentHtml: string;
  /**
   * US-011/US-012 — the composer document. A document means the stored HTML is
   * derived from it; an explicit null means the author is editing raw HTML.
   */
  contentJson?: EmailContentJson | null;
}

interface EmailEditorProps {
  initialData?: Partial<EmailTemplateData>;
  onSave: (data: EmailTemplateData) => Promise<void>;
  isSaving?: boolean;
  /**
   * US-006 — POST endpoint that queues this template to the signed-in admin.
   * Omitted on the create screens, where there is no saved template yet.
   */
  testSendUrl?: string;
  /**
   * US-013 — the event this template is mapped to, when it is mapped to one.
   * Both editors offer that event's merge tags on top of the common set, the
   * same way US-006 picks that event's sample values for a test send. Absent on
   * the create screens: a template cannot be mapped before it exists.
   */
  eventType?: string | null;
  /**
   * US-014 — endpoint the visual editor uploads images to.
   *
   * Supplied only by the tenant-admin screens. `/api/tenant-admin/upload`
   * derives its tenant from the signed-in user, so a super-admin editing a
   * SYSTEM template has none to upload for — and a system template is rendered
   * with no base URL, so an origin-relative image path could not be
   * absolutised for it anyway. Omitting it there leaves the image tool on its
   * "paste a web address" behaviour rather than offering an upload that 403s.
   */
  uploadUrl?: string;
  /**
   * US-015 — POST endpoint that renders the content being edited through the
   * save pipeline. Omitted leaves the screen without a preview pane.
   */
  previewUrl?: string;
  /**
   * US-015 — the row being edited, when it exists. The preview reads the stored
   * category (and, for a super-admin, the owning tenant) off it so the chrome it
   * shows is the chrome the save would write. Absent on the create screens.
   */
  templateId?: string;
}

const LEGACY_BANNER =
  "This email was written in HTML before the visual editor existed, so it opens here. Switching to the visual editor starts from a blank page and replaces this HTML when you save.";

export const EmailEditor = ({
  initialData,
  onSave,
  isSaving = false,
  testSendUrl,
  eventType,
  uploadUrl,
  previewUrl,
  templateId,
}: EmailEditorProps) => {
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [mode, setMode] = useState<EmailEditorMode>(() =>
    initialEmailEditorMode(initialData),
  );
  const [pendingMode, setPendingMode] = useState<EmailEditorMode | null>(null);
  const [formData, setFormData] = useState<EmailTemplateData>({
    name: initialData?.name || "",
    subject: initialData?.subject || "",
    category: initialData?.category || "transactional",
    description: initialData?.description || "",
    contentHtml: initialData?.contentHtml || DEFAULT_TEMPLATE_HTML,
    contentJson: asEmailContentJson(initialData?.contentJson),
  });

  const showLegacyBanner = useMemo(
    () => isLegacyHtmlTemplate(initialData) && mode === "advanced",
    [initialData, mode],
  );

  const handleChange = (field: keyof EmailTemplateData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Functional updates throughout: the composer's onUpdate closure lives inside
  // the editor instance, so it must never depend on the state it captured.
  const handleHtmlChange = useCallback((contentHtml: string) => {
    setFormData((prev) => ({ ...prev, contentHtml }));
  }, []);

  const handleDocumentChange = useCallback((contentJson: EmailContentJson) => {
    setFormData((prev) => ({ ...prev, contentJson }));
  }, []);

  const applyMode = (next: EmailEditorMode) => {
    // Leaving Simple drops the document, so the next save cannot re-derive
    // contentHtml over HTML the author has since hand-written.
    setFormData((prev) => ({
      ...prev,
      contentJson: next === "advanced" ? null : prev.contentJson,
    }));
    setMode(next);
    setPendingMode(null);
  };

  const warning = useMemo(
    () =>
      pendingMode
        ? modeSwitchWarning({
            from: mode,
            to: pendingMode,
            contentJson: formData.contentJson ?? null,
            contentHtml: formData.contentHtml,
          })
        : null,
    [pendingMode, mode, formData.contentJson, formData.contentHtml],
  );

  const requestMode = (next: string) => {
    if (next !== "simple" && next !== "advanced") return;
    if (next === mode) return;
    const lossy = modeSwitchWarning({
      from: mode,
      to: next,
      contentJson: formData.contentJson ?? null,
      contentHtml: formData.contentHtml,
    });
    if (lossy) {
      setPendingMode(next);
      return;
    }
    applyMode(next);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.subject) {
      toast.error("Name and Subject are required");
      return;
    }
    await onSave({
      ...formData,
      contentJson: payloadContentJson(mode, formData.contentJson ?? null),
    });
  };

  // Sends the SAVED template — the server renders it with sample variables so
  // the inbox copy matches what the worker would produce for a real event.
  const handleSendTest = async () => {
    if (!testSendUrl) return;
    setIsSendingTest(true);
    try {
      const res = await fetch(testSendUrl, { method: "POST" });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        // Rate-limit replies carry the useful detail in `message`;
        // the standard apiError envelope only has `error`.
        throw new Error(
          payload?.message || payload?.error || "Failed to queue test email",
        );
      }
      toast.success(
        payload?.sentTo
          ? `Test email queued to ${payload.sentTo}`
          : "Test email queued",
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send test email",
      );
    } finally {
      setIsSendingTest(false);
    }
  };

  // h-full, not a viewport calc: every host wraps this editor in a sized
  // `flex-1 overflow-hidden` box. The old `h-[calc(100vh-100px)]` overshot
  // that box, and caret-reveal scrolling on the first edit then pushed the
  // header card — Save button included — out of the clipped area with no way
  // to scroll back.
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="bs-card bs-card-pad shrink-0">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <label htmlFor="name" className="bs-eyebrow">Template Name</label>
            <input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="e.g. Welcome Email v1"
              className="bs-input w-full"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label htmlFor="subject" className="bs-eyebrow">Subject Line</label>
            <input
              id="subject"
              value={formData.subject}
              onChange={(e) => handleChange("subject", e.target.value)}
              placeholder="Welcome to BudStacks, {{name}}!"
              className="bs-input w-full"
            />
          </div>
          <div className="flex justify-end gap-2 pb-0.5">
            {testSendUrl && (
              <button
                type="button"
                onClick={handleSendTest}
                disabled={isSendingTest}
                title="Sends the saved version of this template to your admin email address"
                className="bs-btn bs-btn-ghost"
              >
                {isSendingTest ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" /> <span>Send test</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="bs-btn bs-btn-green"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> <span>Save Template</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {showLegacyBanner && (
        <div className="flex shrink-0 items-start gap-2 rounded-bs-md border border-bs-border-100 bg-bs-card-2 p-3 text-sm text-bs-fg-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{LEGACY_BANNER}</p>
        </div>
      )}

      <Tabs value={mode} onValueChange={requestMode} className="shrink-0">
        <TabsList>
          <TabsTrigger value="simple">Visual</TabsTrigger>
          <TabsTrigger value="advanced">HTML</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex-1 overflow-hidden rounded-bs-md border border-bs-border-100 bg-bs-canvas">
        <EmailEditorPanes
          previewUrl={previewUrl}
          // Derived state, rebuilt as the author types; the pane debounces it
          // and refetches only when the serialised body actually changes.
          previewRequest={emailPreviewRequest({
            mode,
            contentHtml: formData.contentHtml,
            contentJson: formData.contentJson ?? null,
            category: formData.category,
            eventType,
            templateId,
          })}
          editor={
            mode === "simple" ? (
              <EmailComposer
                value={formData.contentJson ?? null}
                onChange={handleDocumentChange}
                eventType={eventType}
                uploadUrl={uploadUrl}
                onSendTest={testSendUrl ? handleSendTest : undefined}
                isSendingTest={isSendingTest}
              />
            ) : (
              <EmailHtmlPane
                value={formData.contentHtml}
                onChange={handleHtmlChange}
                eventType={eventType}
              />
            )
          }
        />
      </div>

      <AlertDialog
        open={Boolean(warning)}
        onOpenChange={(open) => {
          if (!open) setPendingMode(null);
        }}
      >
        <AlertDialogContent className="bs-dialog-content">
          <AlertDialogHeader>
            <AlertDialogTitle
              className="text-[22px] text-bs-fg"
              style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
            >
              {warning?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-bs-fg-muted">
              {warning?.body}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bs-btn bs-btn-ghost">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingMode && applyMode(pendingMode)}
              className="bs-btn bs-btn-green"
            >
              {warning?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
