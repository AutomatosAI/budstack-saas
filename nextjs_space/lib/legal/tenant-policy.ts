/**
 * Resolves a tenant's published privacy notice.
 *
 * A storefront with no published profile serves an explicit fallback notice —
 * never the BudStacks corporate policy. Showing the platform's notice on an
 * operator's domain is the defect this workstream exists to fix, so falling back
 * to it would reintroduce the bug at the moment it matters most.
 *
 * See docs/PRDS/prd-data-protection-remediation.md (US-009).
 */

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { renderMarkdown } from "./markdown";
import {
  PRIVACY_REQUIRED_TOKENS,
  PRIVACY_TEMPLATE,
  PRIVACY_TEMPLATE_VERSION,
} from "./privacy-template";
import { MissingLegalTokenError, renderTemplate } from "./render-policy";

export type TenantPrivacyPolicy =
  | {
      status: "published";
      html: string;
      publishedAt: Date;
      templateVersion: string;
      controllerLegalName: string;
    }
  | { status: "unpublished"; reason: "no-profile" | "not-published" | "incomplete" };

export interface LegalProfileValues {
  controllerLegalName: string;
  registeredAddress: string;
  privacyContactEmail: string;
  icoRegistrationNumber?: string | null;
  dpoName?: string | null;
  dpoContact?: string | null;
  ukRepresentative?: string | null;
}

/**
 * Collapse a merge value to a single line.
 *
 * Values are HTML-escaped downstream by the renderer, so this is not an XSS
 * guard — it stops an operator injecting block-level Markdown (a stray `##` on
 * its own line) into the middle of a legal document through a field like the
 * registered address.
 */
function singleLine(value: string): string {
  return value.replace(/\s*\n+\s*/g, ", ").trim();
}

function toTemplateValues(profile: LegalProfileValues): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, raw] of Object.entries(profile)) {
    if (typeof raw === "string" && raw.trim() !== "") {
      values[key] = singleLine(raw);
    }
  }
  return values;
}

/** Render a profile to HTML without touching the database. */
export function renderPolicyHtml(profile: LegalProfileValues): string {
  const merged = renderTemplate(
    PRIVACY_TEMPLATE,
    toTemplateValues(profile),
    PRIVACY_REQUIRED_TOKENS,
  );
  return renderMarkdown(merged);
}

/** The notice to serve on a tenant's storefront domain. */
export async function getTenantPrivacyPolicy(
  tenantId: string,
): Promise<TenantPrivacyPolicy> {
  // findFirst with a flat field: the tenant-scoping $extends rewrites findUnique
  // to findFirst without flattening compound keys, which 500s on `Unknown
  // argument`. Flat findFirst is the safe form.
  const profile = await prisma.tenant_legal_profiles.findFirst({
    where: { tenantId },
  });

  if (!profile) return { status: "unpublished", reason: "no-profile" };
  if (!profile.publishedAt) return { status: "unpublished", reason: "not-published" };

  try {
    return {
      status: "published",
      html: renderPolicyHtml(profile),
      publishedAt: profile.publishedAt,
      templateVersion: profile.templateVersion ?? PRIVACY_TEMPLATE_VERSION,
      controllerLegalName: singleLine(profile.controllerLegalName),
    };
  } catch (error) {
    if (error instanceof MissingLegalTokenError) {
      // Published but no longer renderable — e.g. a required field was cleared,
      // or the template gained a token this profile predates. Serving the
      // fallback is correct: an incomplete notice is worse than an honest one.
      logger.error("[Legal] Published profile failed to render", {
        tenantId,
        tokens: error.tokens,
      });
      return { status: "unpublished", reason: "incomplete" };
    }
    throw error;
  }
}
