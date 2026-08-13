/**
 * US-015 — what the preview pane shows.
 *
 * ONE pipeline, two consumers. This runs the SAME `resolveTemplateContent`
 * decision a save runs (`lib/email/email-template-content.ts`) — document ->
 * shell -> inline -> sanitize for the composer, allow-list sanitize for raw
 * HTML — so the preview an author approves is what the save would store, not an
 * approximation of it. It then fills the merge tags with US-006's canned sample
 * set, the way `Handlebars.compile(contentHtml)` will in the worker at send
 * time. A preview that renders and a save that then fails is a bug in one of
 * them; sharing the step is what keeps that from happening quietly.
 *
 * SERVER ONLY, deliberately. The shell needs react-email, inlining needs juice,
 * and sanitizing is the security boundary — a browser-side approximation would
 * be a second pipeline nobody tests, showing an email that was never rendered.
 */

import { z } from "zod";

import { ApiError } from "@/lib/api-error";
import {
  emailContentJsonSchema,
  type EmailContentJson,
} from "@/lib/email/email-content-json";
import { resolveTemplateContent } from "@/lib/email/email-template-content";
import { renderTemplateField } from "@/lib/email/render-template-field";
import { sampleVariablesForEvent } from "@/lib/email/sample-variables";
import { EMAIL_HTML_MAX_LENGTH } from "@/lib/security/email-sanitize";

/**
 * The POST body both preview routes accept.
 *
 * ONE schema, not one per route, because there is one producer: the pane's
 * `emailPreviewRequest` builder serves both screens, so two schemas would be two
 * descriptions of a single request shape kept in step by hand. They differ only
 * in what they do with `templateId` — the tenant route scopes it to the session,
 * the super-admin route reads the row's owner — and that is handler logic, not
 * validation.
 *
 * `templateId` never names a tenant. It only selects a row the caller already
 * has access to, so the shell and category the preview shows are the ones the
 * save would use.
 */
export const emailPreviewBodySchema = z.object({
  templateId: z.string().uuid().optional(),
  contentHtml: z.string().max(EMAIL_HTML_MAX_LENGTH).optional(),
  contentJson: emailContentJsonSchema.nullish(),
  category: z.string().max(100).optional(),
  eventType: z.string().max(200).nullish(),
});

/**
 * Metered per admin, not per tenant: the cost tracks the person typing, and two
 * colleagues editing at once must not starve each other. The cap sits above
 * what the pane's debounce can produce from continuous typing, so it only bites
 * on something that is not a person editing an email.
 *
 * Fails OPEN, unlike the send routes. Nothing leaves the building here — no
 * mail, no write, one tenant read — so a Redis outage taking the preview pane
 * down with it would cost more than the metering it enforces.
 */
export const EMAIL_PREVIEW_RATE_LIMIT = {
  maxRequests: 90,
  windowMs: 60_000,
  failMode: "open",
} as const;

/** Namespaced so a preview never shares a counter with another endpoint. */
export function emailPreviewRateLimitKey(scope: string): string {
  return `email-preview:${scope}`;
}

const NOTHING_TO_PREVIEW =
  "There is nothing to preview yet — add some content first.";

export interface RenderEmailPreviewInput {
  /** The composer document being edited, if the author is in visual mode. */
  readonly contentJson?: EmailContentJson | null;
  /** Raw HTML from the source pane, for an author in HTML mode. */
  readonly contentHtml?: string;
  /** Decides whether the shell carries an unsubscribe footer (US-010). */
  readonly category?: string | null;
  /** The mapped event, which selects the sample variable set (US-006). */
  readonly eventType?: string | null;
  /** Owner of the template being previewed; null for a system template. */
  readonly tenantId: string | null;
  /** Live tenant name, so the preview reads like the real thing. */
  readonly businessName?: string | null;
}

/**
 * Render one preview document: the save pipeline's output with sample values
 * substituted. Returns a complete HTML document for a sandboxed iframe.
 */
export async function renderEmailPreview({
  contentJson,
  contentHtml,
  category,
  eventType,
  tenantId,
  businessName,
}: RenderEmailPreviewInput): Promise<string> {
  const stored = await resolveTemplateContent({
    contentHtml,
    contentJson,
    tenantId,
    category,
  });

  // `resolveTemplateContent` returns no HTML when the request carried neither
  // representation — a save would leave the column alone, but there is nothing
  // to put in an iframe, and an empty pane with no explanation reads as a bug.
  if (typeof stored.contentHtml !== "string") {
    throw new ApiError(NOTHING_TO_PREVIEW, 400);
  }

  return renderTemplateField(
    stored.contentHtml,
    sampleVariablesForEvent(eventType, { businessName }),
  );
}
