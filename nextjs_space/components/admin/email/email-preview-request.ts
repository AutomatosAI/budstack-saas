/**
 * US-015 — what the preview pane asks the server for, and at what width.
 *
 * Pure, and separate from the pane, for the same reason `email-editor-mode.ts`
 * is separate from the editor: the interesting part is not the fetch, it is that
 * the request describes the SAME content the save would send. Simple mode
 * previews the document and advanced mode previews the raw HTML, decided by
 * `payloadContentJson` — the one function the save path already uses — so the
 * two cannot disagree about which representation is authoritative.
 */

import type { EmailContentJson } from "@/lib/email/email-content-json";

import { payloadContentJson, type EmailEditorMode } from "./email-editor-mode";

/** The two widths the toggle offers: a phone, and a desktop mail client. */
export const EMAIL_PREVIEW_WIDTHS = [
  { value: 375, label: "Mobile" },
  { value: 800, label: "Desktop" },
] as const;

export type EmailPreviewWidth = (typeof EMAIL_PREVIEW_WIDTHS)[number]["value"];

export const DEFAULT_EMAIL_PREVIEW_WIDTH: EmailPreviewWidth = 800;

/**
 * Long enough that continuous typing stays well under the endpoint's cap, short
 * enough that a pause reads as live. Every render is a full shell + inline +
 * sanitize pass on the server, so this is a cost control, not a nicety.
 */
export const EMAIL_PREVIEW_DEBOUNCE_MS = 800;

/** Shown when the response carried nothing an author could act on. */
export const EMAIL_PREVIEW_FAILED_MESSAGE =
  "The preview could not be rendered.";

/**
 * What to put in the pane's banner for a failed response.
 *
 * `message` FIRST, for the same reason `EmailEditor.handleSendTest` reads it
 * first: the rate limiter is the one thing here that answers with a retryable
 * condition, and it puts "try again in N seconds" in `message` while `error` is
 * the bare "Too many requests". Everything else is the standard `apiError`
 * envelope, which has no `message` at all — so this never changes what a
 * render failure says, it only stops the one recoverable case from arriving
 * without the part that makes it recoverable.
 */
export function emailPreviewErrorMessage(payload: unknown): string {
  const body = (payload ?? {}) as { message?: unknown; error?: unknown };
  const detail = [body.message, body.error].find(
    (value): value is string => typeof value === "string" && value.length > 0,
  );
  return detail ?? EMAIL_PREVIEW_FAILED_MESSAGE;
}

/** The POST body both preview routes accept. */
export interface EmailPreviewRequest {
  readonly templateId?: string;
  readonly contentHtml?: string;
  readonly contentJson: EmailContentJson | null;
  readonly category?: string;
  readonly eventType?: string | null;
}

export interface EmailPreviewRequestInput {
  readonly mode: EmailEditorMode;
  readonly contentHtml: string;
  readonly contentJson: EmailContentJson | null;
  readonly category?: string;
  readonly eventType?: string | null;
  /** Absent on the create screens, where no row exists yet. */
  readonly templateId?: string;
}

/**
 * Build the preview request for the mode the author is in.
 *
 * Advanced mode sends its HTML AND an explicit null document, which is what
 * tells the server to preview the raw HTML rather than re-deriving it. Simple
 * mode sends the document and no HTML: sending both would preview whichever the
 * server preferred, which is precisely the ambiguity the save path resolves.
 */
export function emailPreviewRequest({
  mode,
  contentHtml,
  contentJson,
  category,
  eventType,
  templateId,
}: EmailPreviewRequestInput): EmailPreviewRequest {
  return {
    ...(templateId ? { templateId } : {}),
    ...(mode === "advanced" ? { contentHtml } : {}),
    contentJson: payloadContentJson(mode, contentJson),
    ...(category ? { category } : {}),
    ...(eventType ? { eventType } : {}),
  };
}
