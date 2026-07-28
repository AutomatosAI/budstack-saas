/**
 * Resolves a tenant's published legal documents.
 *
 * A storefront with no published document serves an explicit fallback — never
 * the BudStacks platform document. Showing the platform's terms or notice on an
 * operator's domain is the defect this exists to fix, so falling back to it
 * would reinstate the bug at the moment it matters most.
 *
 * See docs/PRDS/prd-data-protection-remediation.md.
 */

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { renderMarkdown } from "./markdown";
import { getLegalDocument, type LegalDocumentSlug } from "./documents";
import { MissingLegalTokenError, renderTemplate } from "./render-policy";

export type TenantLegalDocument =
  | {
      status: "published";
      slug: LegalDocumentSlug;
      title: string;
      html: string;
      publishedAt: Date;
      templateVersion: string;
      controllerLegalName: string;
    }
  | {
      status: "unpublished";
      slug: LegalDocumentSlug;
      title: string;
      reason: "no-profile" | "not-published" | "incomplete";
    };

export interface LegalProfileValues {
  controllerLegalName: string;
  registeredAddress: string;
  privacyContactEmail: string;
  icoRegistrationNumber?: string | null;
  dpoName?: string | null;
  dpoContact?: string | null;
  ukRepresentative?: string | null;
  tradingName?: string | null;
  supportContactEmail?: string | null;
  governingLaw?: string | null;
  deliveryTerms?: string | null;
  returnsPolicy?: string | null;
  licenceNumber?: string | null;
  regulatorName?: string | null;
}

/**
 * Fields where an operator legitimately writes a paragraph. They keep their line
 * breaks, but a leading `#` is stripped from each line so a heading cannot be
 * forged mid-document. Every other field is collapsed to one line.
 */
const MULTILINE_FIELDS = new Set(["deliveryTerms", "returnsPolicy"]);

/**
 * Collapse a merge value to a single line.
 *
 * Values are HTML-escaped downstream by the renderer, so this is not an XSS
 * guard — it stops an operator injecting block-level Markdown into the middle of
 * a legal document through a free-text field.
 */
function singleLine(value: string): string {
  return value.replace(/\s*\n+\s*/g, ", ").trim();
}

function safeMultiline(value: string): string {
  return value
    .split("\n")
    .map((line) => line.replace(/^\s*#+\s*/, ""))
    .join("\n")
    .trim();
}

function toTemplateValues(profile: LegalProfileValues): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, raw] of Object.entries(profile)) {
    if (typeof raw === "string" && raw.trim() !== "") {
      values[key] = MULTILINE_FIELDS.has(key) ? safeMultiline(raw) : singleLine(raw);
    }
  }
  return values;
}

/** Render one document from a profile without touching the database. */
export function renderDocumentHtml(
  slug: LegalDocumentSlug,
  profile: LegalProfileValues,
): string {
  const doc = getLegalDocument(slug);
  const merged = renderTemplate(
    doc.template,
    toTemplateValues(profile),
    doc.requiredTokens,
  );
  return renderMarkdown(merged);
}

/** The privacy notice was the first document; kept for existing callers. */
export function renderPolicyHtml(profile: LegalProfileValues): string {
  return renderDocumentHtml("privacy", profile);
}

/** Which documents this profile currently has the fields to publish. */
export function renderableDocuments(
  profile: LegalProfileValues,
): LegalDocumentSlug[] {
  const slugs: LegalDocumentSlug[] = ["privacy", "terms", "cookies", "regulatory"];
  return slugs.filter((slug) => {
    try {
      renderDocumentHtml(slug, profile);
      return true;
    } catch {
      return false;
    }
  });
}

/** The document to serve on a tenant's storefront domain. */
export async function getTenantLegalDocument(
  tenantId: string,
  slug: LegalDocumentSlug,
): Promise<TenantLegalDocument> {
  const doc = getLegalDocument(slug);

  // findFirst with a flat field: the tenant-scoping $extends rewrites findUnique
  // to findFirst without flattening compound keys, which 500s on `Unknown
  // argument`. Flat findFirst is the safe form.
  const profile = await prisma.tenant_legal_profiles.findFirst({
    where: { tenantId },
  });

  if (!profile) {
    return { status: "unpublished", slug, title: doc.title, reason: "no-profile" };
  }
  if (!profile.publishedAt) {
    return { status: "unpublished", slug, title: doc.title, reason: "not-published" };
  }

  try {
    return {
      status: "published",
      slug,
      title: doc.title,
      html: renderDocumentHtml(slug, profile),
      publishedAt: profile.publishedAt,
      templateVersion: profile.templateVersion ?? doc.version,
      controllerLegalName: singleLine(profile.controllerLegalName),
    };
  } catch (error) {
    if (error instanceof MissingLegalTokenError) {
      // Published overall, but THIS document's required fields are absent — e.g.
      // terms published before a governing law was set. Serving the fallback is
      // correct: half a contract is worse than an honest gap.
      logger.warn("[Legal] Document not renderable for tenant", {
        tenantId,
        slug,
        tokens: error.tokens,
      });
      return { status: "unpublished", slug, title: doc.title, reason: "incomplete" };
    }
    throw error;
  }
}

/** The privacy notice; kept for existing callers. */
export async function getTenantPrivacyPolicy(
  tenantId: string,
): Promise<TenantLegalDocument> {
  return getTenantLegalDocument(tenantId, "privacy");
}
