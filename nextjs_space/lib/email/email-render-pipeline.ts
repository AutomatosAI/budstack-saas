/**
 * US-011 — the save-path render pipeline: authored TipTap JSON in, stored
 * `email_templates.contentHtml` out.
 *
 * THE ORDER IS THE CONTRACT:
 *
 *   contentJson
 *     -> normalise      absolute image URLs, inline-image size cap
 *     -> generateHTML   server-side, against the SHARED extension set
 *     -> EmailShell     US-010's branded chrome (header, footer, unsubscribe)
 *     -> juice          CSS inlined onto the elements
 *     -> sanitizeEmailHtml   <-- ALWAYS LAST
 *
 * Sanitize is last because juice's whole job is to WRITE `style` attributes.
 * Sanitizing first and inlining after would put CSS into the stored document
 * that the allow-list never saw — the exact hole `lib/security/email-sanitize.ts`
 * exists to close. When something does not survive the sanitizer, this pipeline
 * changes; the allow-list does not.
 *
 * THE WORKER IS UNTOUCHED. `scripts/email-worker.ts` still does
 * `Handlebars.compile(contentHtml)` exactly as before. Every step above treats
 * `{{tag}}` as ordinary text — TipTap serialises it, react-email interpolates it
 * as a text child, juice never looks at text nodes, and the sanitizer decodes
 * entities rather than introducing them — so merge tags come out the far end
 * verbatim and the worker fills them the way it always has.
 */

import { generateHTML } from "@tiptap/html/server";
import juice from "juice";

import { ApiError } from "@/lib/api-error";
import { emailEditorExtensions } from "@/lib/email/editor-extensions";
import { EMAIL_BODY_CLASS, EMAIL_BODY_CSS } from "@/lib/email/email-body-css";
import {
  normaliseEmailContentJson,
  parseEmailContentJson,
} from "@/lib/email/email-content-json";
import { renderEmailBody, type EmailShellTenant } from "@/lib/email/email-shell";
import { logger } from "@/lib/logger";
import { resolveEmailCategory, type EmailCategory } from "@/lib/email/suppression";
import {
  EMAIL_HTML_MAX_LENGTH,
  sanitizeEmailHtml,
} from "@/lib/security/email-sanitize";
import { getTenantBaseUrl } from "@/lib/tenant/tenant-utils";

// US-012 moved the body stylesheet to `lib/email/email-body-css.ts` so the
// composer can style the author's screen with the same rules this inlines into
// their email. Re-exported because this module is where every consumer of the
// pipeline already looks for it.
export { EMAIL_BODY_CLASS, EMAIL_BODY_CSS };

/**
 * The slot a SYSTEM template's shell carries where a tenant's name would go.
 *
 * A system template belongs to no tenant and is mailed on behalf of whichever
 * tenant the worker resolves it for, so its chrome cannot be baked with one
 * business name. It carries the Handlebars slot instead — the same device
 * US-010's footer uses for `{{unsubscribeUrl}}` — and the worker's existing
 * compile step fills it from the `variables` bag every send site already passes
 * (`businessName` is one of the globals documented in
 * `lib/email/sample-variables.ts`).
 */
export const BUSINESS_NAME_SLOT = "{{businessName}}";

/**
 * The shell inputs for a system template: the name slot, and nothing else.
 *
 * No logo and no postal address on purpose — neither is a Handlebars variable
 * the send sites populate, and a broken `<img>` or another tenant's registered
 * office is worse than an absent one. `subdomain` is empty because the shell
 * only derives a base URL to resolve a logo, and there is no logo to resolve.
 */
const SYSTEM_SHELL_TENANT: EmailShellTenant = {
  businessName: BUSINESS_NAME_SLOT,
  subdomain: "",
  customDomain: null,
};

const RENDER_FAILED_MESSAGE =
  "This email's content could not be rendered. Remove the last thing you added and try again.";
const TOO_LARGE_MESSAGE = `This email is too large to save (limit ${
  EMAIL_HTML_MAX_LENGTH / 1000
}k characters). Shorten it, or replace embedded images with uploaded ones.`;

export interface RenderEmailTemplateOptions {
  /** Untrusted `contentJson` from the request, or any stored document. */
  readonly contentJson: unknown;
  /** The owning tenant, or null for a system template (see the slot above). */
  readonly tenant: EmailShellTenant | null;
  /** Drives the unsubscribe footer. Absent means transactional (US-010). */
  readonly category?: EmailCategory;
  /** A resolved per-recipient unsubscribe link, once fan-out has one. */
  readonly unsubscribeUrl?: string | null;
}

/**
 * Serialise the document against the shared schema.
 *
 * `Node.fromJSON` is the authoritative validator — it knows every node,
 * attribute and mark the composer can produce — and it throws on anything else.
 * That failure is the author's to fix, so it becomes a 400 rather than a 500,
 * with the underlying ProseMirror message kept out of the response.
 */
function renderBodyHtml(doc: unknown): string {
  try {
    return generateHTML(doc as never, emailEditorExtensions());
  } catch (error) {
    // The client gets an actionable sentence and nothing else, but an operator
    // needs the real reason: a schema drift between the composer's extension
    // set and this one reads exactly like malformed authoring from the outside.
    // No document content is logged — it is the author's copy.
    logger.error("email template render failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    throw new ApiError(RENDER_FAILED_MESSAGE, 400);
  }
}

/** Map a template's free-text `category` column onto an email category. */
export function emailCategoryOfTemplate(
  category: string | null | undefined,
): EmailCategory {
  return resolveEmailCategory(category?.trim().toLowerCase());
}

/**
 * Run the full pipeline. The returned string is already sanitized and within
 * `EMAIL_HTML_MAX_LENGTH` — callers persist it as `contentHtml` without a
 * second pass.
 */
export async function renderEmailTemplateHtml({
  contentJson,
  tenant,
  category,
  unsubscribeUrl,
}: RenderEmailTemplateOptions): Promise<string> {
  const doc = parseEmailContentJson(contentJson);
  const baseUrl = tenant ? getTenantBaseUrl(tenant) : null;

  const bodyHtml = renderBodyHtml(normaliseEmailContentJson(doc, baseUrl));
  const document = await renderEmailBody(
    `<div class="${EMAIL_BODY_CLASS}">${bodyHtml}</div>`,
    tenant ?? SYSTEM_SHELL_TENANT,
    { category, unsubscribeUrl },
  );

  // `applyHeightAttributes: false` — juice mirrors an inlined `height` onto the
  // HTML attribute for images and table cells, which turns the `height: auto`
  // above into `height="auto"`: not a valid attribute value, and Outlook is
  // entitled to do anything with it. Width mirroring stays on, because that one
  // is what makes Outlook respect an image's size.
  const contentHtml = sanitizeEmailHtml(
    juice(document, { extraCss: EMAIL_BODY_CSS, applyHeightAttributes: false }),
  );

  if (contentHtml.length > EMAIL_HTML_MAX_LENGTH) {
    throw new ApiError(TOO_LARGE_MESSAGE, 400);
  }
  return contentHtml;
}
