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
import { isEmailTrackingEnabled } from "@/lib/email/email-tracking";
import { logger } from "@/lib/logger";
import { PRIVACY_EMAIL_TRACKING_TOKEN } from "./privacy-template";
import { renderMarkdown } from "./markdown";
import { getLegalDocument, type LegalDocumentSlug } from "./documents";
import { resolveDocumentSource } from "./document-resolution";
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

/**
 * Values that come from somewhere other than the legal profile.
 *
 * US-027's email-tracking disclosure is the first: the switch it reflects lives
 * in `tenants.settings` with the email surface that acts on it, not in the
 * operator's legal profile. Kept as a separate argument rather than widened
 * into `LegalProfileValues` so the profile type keeps meaning "the columns an
 * operator filled in", and so a caller that has no tenant (the preview in
 * `renderableDocuments`) simply passes nothing.
 */
export type LegalDocumentContext = Readonly<
  Record<string, string | null | undefined>
>;

/** Render one document from a profile without touching the database. */
export function renderDocumentHtml(
  slug: LegalDocumentSlug,
  profile: LegalProfileValues,
  context: LegalDocumentContext = {},
): string {
  const doc = getLegalDocument(slug);
  const merged = renderTemplate(
    // The profile wins: a context key can only ever ADD a value, never
    // overwrite one an operator set. Nothing today collides, and this is what
    // keeps that true when something does.
    doc.template,
    { ...context, ...toTemplateValues(profile) },
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

/**
 * Merge values that live outside the legal profile.
 *
 * Today that is one flag: US-027's email tracking. Any non-blank string keeps
 * the conditional block (`render-policy.ts` branches on blankness, not on a
 * boolean), and the key is OMITTED rather than set to "false" when tracking is
 * off — a store that does not track must not publish a clause saying it does.
 *
 * Failure is silent and reads as OFF. `tenants` is not a tenant-scoped model,
 * so this is a plain keyed read, but a legal page must render even if it
 * cannot: a privacy notice missing an optional clause is a smaller wrong than
 * a 500 on the page an operator is legally required to serve.
 */
async function loadDocumentContext(
  tenantId: string,
): Promise<LegalDocumentContext> {
  try {
    const tenant: { settings: unknown } | null = await prisma.tenants.findFirst({
      where: { id: tenantId },
      select: { settings: true },
    });
    return isEmailTrackingEnabled(tenant?.settings, tenantId)
      ? { [PRIVACY_EMAIL_TRACKING_TOKEN]: "yes" }
      : {};
  } catch (error) {
    logger.warn("[Legal] Could not read tenant settings for document context", {
      tenantId,
      message: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}

/** The document to serve on a tenant's storefront domain. */
export async function getTenantLegalDocument(
  tenantId: string,
  slug: LegalDocumentSlug,
): Promise<TenantLegalDocument> {
  const shipped = getLegalDocument(slug);

  // findFirst with flat fields: the tenant-scoping $extends rewrites findUnique
  // to findFirst without flattening compound keys, which 500s on `Unknown
  // argument`. Flat findFirst is the safe form.
  const [profile, doc, platform, context] = await Promise.all([
    prisma.tenant_legal_profiles.findFirst({ where: { tenantId } }),
    prisma.tenant_legal_documents.findFirst({ where: { tenantId, slug } }),
    prisma.platform_legal_templates.findFirst({ where: { slug } }),
    loadDocumentContext(tenantId),
  ]);

  const source = resolveDocumentSource(
    slug,
    doc,
    platform,
    Boolean(profile?.publishedAt),
  );

  if (source.kind === "unpublished") {
    return {
      status: "unpublished",
      slug,
      title: shipped.title,
      reason:
        source.reason === "no-profile" || source.reason === "no-document"
          ? "no-profile"
          : "not-published",
    };
  }

  // The tenant's own wording. Rendered through the same escaping markdown
  // pipeline as everything else — it is their text, but it is still untrusted
  // input being written into a page.
  if (source.kind === "custom") {
    return {
      status: "published",
      slug,
      title: shipped.title,
      html: renderMarkdown(source.body),
      publishedAt: source.publishedAt,
      templateVersion: "custom",
      controllerLegalName: profile
        ? singleLine(profile.controllerLegalName)
        : "",
    };
  }

  if (source.fromCodeFallback) {
    // Degrading to the shipped wording rather than to nothing, but this means
    // the platform template table is unseeded for this document.
    logger.warn("[Legal] No platform template row; serving shipped default", {
      slug,
    });
  }

  try {
    const merged = renderTemplate(
      source.template,
      { ...context, ...toTemplateValues(profile as LegalProfileValues) },
      shipped.requiredTokens,
    );
    return {
      status: "published",
      slug,
      title: shipped.title,
      html: renderMarkdown(merged),
      publishedAt: source.publishedAt,
      templateVersion: doc?.templateVersion ?? source.version,
      controllerLegalName: singleLine(
        (profile as LegalProfileValues).controllerLegalName,
      ),
    };
  } catch (error) {
    if (error instanceof MissingLegalTokenError) {
      // Published, but THIS document's required fields are absent — e.g. terms
      // published before a governing law was set. Half a contract is worse than
      // an honest gap.
      logger.warn("[Legal] Document not renderable for tenant", {
        tenantId,
        slug,
        tokens: error.tokens,
      });
      return {
        status: "unpublished",
        slug,
        title: shipped.title,
        reason: "incomplete",
      };
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
