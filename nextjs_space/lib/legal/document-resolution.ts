/**
 * Which text a storefront serves for a given legal document.
 *
 * Three sources, in precedence order:
 *
 *   1. the tenant's OWN text, when they have chosen custom mode and published it
 *   2. the maintained default from the database, merged with their details
 *   3. the maintained default shipped in code, if the database has no row
 *
 * (3) exists so an unseeded or partially-migrated database degrades to the
 * shipped wording rather than to nothing. A legal page that silently empties is
 * worse than one that is slightly out of date.
 *
 * Pure decision logic — the database read happens in the caller — so the
 * precedence rules can be tested without a database.
 *
 * See docs/PRDS/prd-data-protection-remediation.md.
 */

import { getLegalDocument, type LegalDocumentSlug } from "./documents";

export type DocumentMode = "default" | "custom";

export interface TenantDocumentRow {
  slug: string;
  mode: string;
  body: string | null;
  publishedAt: Date | null;
  templateVersion: string | null;
}

export interface PlatformTemplateRow {
  slug: string;
  body: string;
  version: string;
}

export type ResolvedSource =
  | { kind: "custom"; body: string; publishedAt: Date }
  | {
      kind: "default";
      template: string;
      version: string;
      publishedAt: Date;
      /** True when the shipped code template was used because the DB had none. */
      fromCodeFallback: boolean;
    }
  | { kind: "unpublished"; reason: UnpublishedReason };

export type UnpublishedReason =
  | "no-document"
  | "not-published"
  | "custom-empty"
  | "no-profile";

/**
 * Decide which text to serve.
 *
 * `profilePublished` gates the DEFAULT path only: the maintained template merges
 * in the operator's identity, so it cannot render without one. A tenant's own
 * text carries its own identity and does not depend on the profile.
 */
export function resolveDocumentSource(
  slug: LegalDocumentSlug,
  doc: TenantDocumentRow | null,
  platform: PlatformTemplateRow | null,
  profilePublished: boolean,
): ResolvedSource {
  if (!doc) return { kind: "unpublished", reason: "no-document" };
  if (!doc.publishedAt) return { kind: "unpublished", reason: "not-published" };

  if (doc.mode === "custom") {
    // Published custom with nothing written serves the fallback notice — never
    // an empty page, and never the platform's text standing in for theirs.
    if (!doc.body || doc.body.trim() === "") {
      return { kind: "unpublished", reason: "custom-empty" };
    }
    return { kind: "custom", body: doc.body, publishedAt: doc.publishedAt };
  }

  if (!profilePublished) {
    return { kind: "unpublished", reason: "no-profile" };
  }

  if (platform) {
    return {
      kind: "default",
      template: platform.body,
      version: platform.version,
      publishedAt: doc.publishedAt,
      fromCodeFallback: false,
    };
  }

  const shipped = getLegalDocument(slug);
  return {
    kind: "default",
    template: shipped.template,
    version: shipped.version,
    publishedAt: doc.publishedAt,
    fromCodeFallback: true,
  };
}

/** Human-readable explanation for the admin, not the storefront. */
export function explainUnpublished(reason: UnpublishedReason): string {
  switch (reason) {
    case "no-document":
      return "This document has not been set up yet.";
    case "not-published":
      return "Saved but not published. Publish it to make it live.";
    case "custom-empty":
      return "Set to your own wording, but no text has been written.";
    case "no-profile":
      return "Your company details are needed before the standard wording can be published.";
  }
}
