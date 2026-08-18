/**
 * US-011 — the one place that decides what a template save writes to
 * `contentHtml` / `contentJson`.
 *
 * Four handlers persist email content (tenant-admin create/update, super-admin
 * create/update) and every one of them has to make the same three-way decision.
 * Duplicating it would let the levels drift apart, which in this pipeline means
 * one of them quietly storing HTML that never went through the sanitizer.
 *
 * THE THREE CASES:
 *
 *  - a composer document (`contentJson`)  — `contentHtml` is DERIVED from it by
 *    the pipeline and overrides whatever raw HTML the request also carried. The
 *    document is the source of truth; the HTML is a build artefact of it.
 *  - an explicit `contentJson: null`      — the author moved to the raw-HTML
 *    editor (US-012's Advanced tab, behind a confirm). The document is dropped
 *    so it cannot silently overwrite their HTML on the next save.
 *  - neither                              — the pre-US-011 path, unchanged:
 *    `sanitizeEmailHtml` over the submitted HTML, `contentJson` untouched.
 */

import { Prisma } from "@prisma/client";

import type { EmailContentJson } from "@/lib/email/email-content-json";
import {
  emailCategoryOfTemplate,
  renderEmailTemplateHtml,
} from "@/lib/email/email-render-pipeline";
import { requireEmailShellTenant } from "@/lib/email/email-shell-tenant";
import { sanitizeEmailHtml } from "@/lib/security/email-sanitize";

export interface TemplateContentInput {
  /** Raw HTML from the request, if any. */
  readonly contentHtml?: string;
  /** Composer document; `null` means "clear it", `undefined` means "leave it". */
  readonly contentJson?: EmailContentJson | null;
  /** Owner of the row being written — null for a system template. */
  readonly tenantId: string | null;
  /** The row's category column; decides whether the shell gets an unsubscribe line. */
  readonly category?: string | null;
  /**
   * US-027 — this is a campaign, so its links MAY be tracked if the tenant has
   * asked for it. Absent (every template save, every preview) means never: a
   * transactional receipt has nothing to measure, and a template is rendered
   * once for many tenants' events.
   */
  readonly trackable?: boolean;
  /** PREVIEW ONLY — see {@link RenderEmailTemplateOptions.baseUrlOverride}. */
  readonly baseUrlOverride?: string;
}

/** Prisma `data` fragment — spread into a create/update. */
export interface TemplateContentFields {
  contentHtml?: string;
  contentJson?: Prisma.InputJsonValue | typeof Prisma.DbNull;
}

/**
 * Plain-JSON copy of a validated document, for the Json column.
 *
 * A round trip rather than a cast: Prisma's `InputJsonValue` is a recursive
 * union that TypeScript cannot check a ProseMirror document against at any
 * depth — it gives up and reports the array branch as an object — so the choice
 * is between silencing the compiler and actually producing the plain value it is
 * asking for. This produces it, and guarantees on the way that what lands in the
 * column is exactly what a `JSON.parse` of the row will hand back.
 */
function toJsonColumnValue(doc: EmailContentJson): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(doc));
}

export async function resolveTemplateContent({
  contentHtml,
  contentJson,
  tenantId,
  category,
  trackable,
  baseUrlOverride,
}: TemplateContentInput): Promise<TemplateContentFields> {
  if (contentJson) {
    return {
      contentHtml: await renderEmailTemplateHtml({
        contentJson,
        tenant: tenantId ? await requireEmailShellTenant(tenantId) : null,
        category: emailCategoryOfTemplate(category),
        tracking: trackable && tenantId ? { tenantId } : null,
        baseUrlOverride,
      }),
      contentJson: toJsonColumnValue(contentJson),
    };
  }

  // Writing raw HTML IS the divergence, so the document goes with it, whether
  // or not the client remembered to say `contentJson: null`. Leaving it would
  // put the two columns out of step — and because a composer save re-DERIVES
  // contentHtml from the document, the next one would silently throw the raw
  // HTML away. DbNull writes SQL NULL; a bare `null` is not accepted for a
  // nullable Json column and JsonNull would store the JSON literal `null`.
  if (typeof contentHtml === "string") {
    return {
      contentHtml: sanitizeEmailHtml(contentHtml),
      contentJson: Prisma.DbNull,
    };
  }

  // No HTML and no document: the request is not about content at all (a rename,
  // an isActive flip), so neither column is touched — unless it explicitly asked
  // for the document to be dropped.
  return contentJson === null ? { contentJson: Prisma.DbNull } : {};
}
