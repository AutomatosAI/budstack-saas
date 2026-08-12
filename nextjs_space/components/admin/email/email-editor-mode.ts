/**
 * US-012 — which editor a template opens in, and what a switch costs.
 *
 * Pure decisions, kept out of the component so they can be asserted directly.
 * Every one of them is about the same hazard: `contentHtml` and `contentJson`
 * are two representations of one email, and `lib/email/email-template-content.ts`
 * resolves the conflict by always preferring the document. So whichever
 * representation the author is NOT editing is the one a save will overwrite —
 * and that has to be said out loud before it happens, never discovered
 * afterwards.
 */

import type { EmailContentJson } from "@/lib/email/email-content-json";

export type EmailEditorMode = "simple" | "advanced";

/** What Simple mode saves when the author has typed nothing at all. */
export const EMPTY_EMAIL_DOC: EmailContentJson = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

/**
 * The starter HTML a brand-new template opens with in Advanced mode.
 *
 * Also load-bearing for `modeSwitchWarning`: HTML the author has not touched is
 * not work, so leaving it behind warrants no warning.
 */
export const DEFAULT_TEMPLATE_HTML = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: sans-serif; line-height: 1.5; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Hello {{name}},</h1>
    <p>This is a sample email template.</p>
    <br/>
    <a href="{{link}}" class="button">Click Me</a>
  </div>
</body>
</html>`;

/** The fields of a loaded template these decisions depend on. */
export interface EmailEditorInitialData {
  readonly contentHtml?: string;
  /** Straight off the Prisma Json column, so genuinely unknown. */
  readonly contentJson?: unknown;
}

/**
 * Narrow a stored `contentJson` to a document.
 *
 * Structural only — the authoritative check is `Node.fromJSON` against the
 * shared schema, which runs server-side in the render pipeline. This one keeps
 * a null column, a JSON `null`, or anything that is not a ProseMirror document
 * from being handed to the editor as content.
 */
export function asEmailContentJson(value: unknown): EmailContentJson | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as { type?: unknown; content?: unknown };
  if (candidate.type !== "doc") return null;
  if (candidate.content !== undefined && !Array.isArray(candidate.content)) {
    return null;
  }
  return candidate as EmailContentJson;
}

/**
 * Simple is the default: a new template has nothing to lose, and a template
 * with a document was authored in the composer and round-trips through it.
 * Anything else is a template whose HTML is the only copy of the author's work
 * — opening it in the composer would show an empty page and a save would
 * replace the HTML with it.
 */
export function initialEmailEditorMode(
  initialData?: EmailEditorInitialData,
): EmailEditorMode {
  if (!initialData) return "simple";
  return asEmailContentJson(initialData.contentJson) ? "simple" : "advanced";
}

/** A saved template whose only content is hand-written HTML. Earns the banner. */
export function isLegacyHtmlTemplate(
  initialData?: EmailEditorInitialData,
): boolean {
  return Boolean(initialData) && initialEmailEditorMode(initialData) === "advanced";
}

/** Copy for the confirm dialog a lossy switch has to pass through. */
export interface ModeSwitchWarning {
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
}

export interface ModeSwitchInput {
  readonly from: EmailEditorMode;
  readonly to: EmailEditorMode;
  readonly contentJson: EmailContentJson | null;
  readonly contentHtml: string;
}

const TO_ADVANCED: ModeSwitchWarning = {
  title: "Switch to the HTML editor?",
  body:
    "Your visual layout will be removed and you will edit the raw HTML instead. The HTML editor starts from the last saved version of this email, so anything you have changed since saving is not carried over. This cannot be undone.",
  confirmLabel: "Switch to HTML",
};

const TO_SIMPLE: ModeSwitchWarning = {
  title: "Switch to the visual editor?",
  body:
    "This email was written in HTML. The visual editor starts from a blank page, and saving from it replaces the existing HTML. This cannot be undone.",
  confirmLabel: "Switch to visual",
};

/**
 * The warning a switch needs, or null when nothing is lost.
 *
 * Simple -> Advanced discards the document, so it is gated whenever one exists
 * (a brand-new template the author has not typed into has none, and gating that
 * would be noise). Advanced -> Simple discards nothing immediately, but the
 * next save re-derives `contentHtml` from the document and throws the
 * hand-written HTML away — the same loss, one step later, so it is gated the
 * same way.
 */
export function modeSwitchWarning({
  from,
  to,
  contentJson,
  contentHtml,
}: ModeSwitchInput): ModeSwitchWarning | null {
  if (from === to) return null;

  if (to === "advanced") {
    return contentJson ? TO_ADVANCED : null;
  }

  const authoredHtml =
    contentHtml.trim() !== "" && contentHtml !== DEFAULT_TEMPLATE_HTML;
  return !contentJson && authoredHtml ? TO_SIMPLE : null;
}

/**
 * The `contentJson` a save sends.
 *
 * Simple mode ALWAYS sends a document, even an empty one: the stored
 * `contentHtml` is derived from it server-side, so sending nothing would leave
 * whatever raw HTML the form still carries — for a new template, the starter
 * sample — to be saved as the author's email. Advanced mode always sends an
 * explicit null, which is what tells the save pipeline the author moved to raw
 * HTML on purpose.
 */
export function payloadContentJson(
  mode: EmailEditorMode,
  contentJson: EmailContentJson | null,
): EmailContentJson | null {
  return mode === "simple" ? contentJson ?? EMPTY_EMAIL_DOC : null;
}
