/**
 * SEO Supercharge US-005 — metadata for a storefront condition page.
 *
 * THE DEFECT THIS CLOSES: `conditions.seo` (prisma/schema.prisma:278) was the
 * most orphaned column in the feature — no SEO Manager tab wrote it, no route
 * accepted it, and no page read it. Condition pages are a store's
 * content-marketing landing pages, the pages that rank for "medical cannabis for
 * <condition>", and every one of them rendered the platform title from
 * app/layout.tsx. The whole route WAS a `"use client"` module, so it could not
 * export `generateMetadata` even in principle; US-005 split the interactive body
 * out to `condition-detail-client.tsx`, the same move US-004 made for products.
 *
 * THE CASCADE, per field: `conditions.seo.title` → the condition name,
 * `.description` → the condition's own intro copy (truncated: it is body prose,
 * written for the page rather than for a SERP), `.ogImage` → the condition
 * image. There is no live upstream to reconcile with — unlike a product, a
 * condition row is the whole truth — so the local row is both source and
 * override.
 *
 * HOW IT COMPOSES WITH THE US-001 LAYOUT (semantics verified against
 * next/dist/lib/metadata/resolve-metadata.js, 14.2.35), identical in shape to
 * `page-metadata.ts`, `post-metadata.ts` and `product-metadata.ts`:
 *  - An AUTHORED title is `{ absolute }` — it renders exactly as typed, because
 *    the SEO Manager previews that string to the owner as a Google result.
 *  - A DEFAULT title is a plain string, which the layout's `title.template`
 *    wraps into "Chronic Pain | Acme Cannabis".
 *  - `description` is OMITTED rather than set to undefined when there is nothing
 *    to say: `mergeMetadata` assigns `target[key] = source[key] || null` for that
 *    field (:194-205), so a present-but-undefined key NULLs the store
 *    description instead of inheriting it.
 *  - `openGraph` is REPLACED wholesale by the deepest segment that declares it
 *    (:145), so siteName/type/locale are re-declared here.
 *  - og/twitter titles are deliberately unset: `postProcessMetadata` (:406-445)
 *    fills them from the RESOLVED title, which is the only way og:title and
 *    <title> are guaranteed to agree.
 *
 * og:type is "website", not "article": a condition page is a reference page with
 * no author and no publication date, and the structured signal that actually
 * describes it is `FAQPage` JSON-LD built from `conditions.faqs` — US-017,
 * gated on the Pro plan.
 *
 * Pure and total, like every builder in this directory: `generateMetadata`
 * renders with no `error.tsx` boundary above it, so a malformed Json blob or a
 * missing field must degrade to a default rather than throw a blank page.
 */

import type { Metadata } from "next";

import { storeCanonical } from "@/lib/seo/canonical";
import { conditionPath } from "@/lib/seo/condition-paths";
import { readEntitySeo } from "@/lib/seo/entity-seo";
import { seoIndexingDirectives } from "@/lib/seo/indexing";
import { brandedOgImage } from "@/lib/seo/og-image";
import {
  STORE_OG_LOCALE,
  seoText,
  storeDisplayName,
  truncateSeoText,
} from "@/lib/seo/store-identity";
import { storedPublicImagePath } from "@/lib/storage/public-image-url";

/**
 * Title for a slug that resolves to no condition — an unpublished row, a stale
 * link, or a condition another store owns. The page body calls `notFound()` for
 * exactly those cases; metadata resolves first, so it answers with this instead
 * of leaking the platform title into a 404.
 */
export const CONDITION_NOT_FOUND_TITLE = "Condition Not Found";

export interface ConditionMetadataSource {
  readonly businessName: string;
  readonly subdomain: string;
  readonly customDomain: string | null;
  /** `tenants.id` — the US-018 plan gate's subject. */
  readonly tenantId?: string;
  /** Raw `tenants.plan`; fail-closed to Basic, which emits no branded card. */
  readonly plan?: unknown;
  /** `conditions.slug` — the segment the storefront route is keyed by. */
  readonly slug: unknown;
  /** `conditions.name`. `unknown`: it arrives through the any-widened prisma export. */
  readonly name: unknown;
  /** `conditions.description` — page intro copy, so truncated before emission. */
  readonly description: unknown;
  /** `conditions.image` — a stored reference, resolved to a durable public path. */
  readonly image: unknown;
  /** Raw `conditions.seo` Json — parsed here, never trusted. */
  readonly seo: unknown;
}

export function buildConditionMetadata(
  source: ConditionMetadataSource,
): Metadata {
  const businessName = storeDisplayName(source.businessName, source.subdomain);
  const seo = readEntitySeo(source.seo);

  const authoredTitle = seoText(seo.title);
  const headline =
    authoredTitle || seoText(source.name) || CONDITION_NOT_FOUND_TITLE;
  const title = authoredTitle ? { absolute: authoredTitle } : headline;

  // No third tier: with neither an authored description nor condition copy, the
  // layout's own description is inherited — a truthful sentence about the store.
  // A per-store constant would put the SAME description on every condition,
  // which is the duplicate-content defect this workstream exists to remove.
  const description =
    seoText(seo.description) || truncateSeoText(source.description);

  // US-022 — Pro indexing controls. Condition pages are the ones most likely to
  // duplicate a page the store already ranks with, which is what the canonical
  // override answers. `{}` for a Basic tenant.
  const indexing = seoIndexingDirectives({
    tenantId: source.tenantId,
    plan: source.plan,
    seo,
  });

  const canonical = storeCanonical(source, conditionPath(source.slug), {
    override: indexing.canonicalOverride,
  });

  // Fails closed on a presigned S3 URL (an owner paste, or a seeded image ref
  // that arrives signed): a tag that 403s an hour after it is minted looks
  // correct and breaks silently. A relative result — an ogImage stored as a
  // tenant upload key — absolutises against the layout's metadataBase, which
  // children inherit (resolve-metadata.js:129).
  const ogImage =
    storedPublicImagePath(seo.ogImage) ??
    storedPublicImagePath(seoText(source.image) || null);

  // US-018 — LAST in the cascade, behind the condition's own image. Condition
  // pages are the store's ranking landing pages and most seeded rows carry no
  // image at all, so this is where the branded card earns the most. Pro only.
  const brandedOg = ogImage
    ? null
    : brandedOgImage({
        tenantId: source.tenantId,
        plan: source.plan,
        kind: "condition",
        title: headline,
      });

  return {
    title,
    // Omitted rather than undefined — see the merge note in the module header.
    ...(description ? { description } : {}),
    ...(indexing.robots ? { robots: indexing.robots } : {}),
    alternates: { canonical },
    openGraph: {
      siteName: businessName,
      type: "website",
      locale: STORE_OG_LOCALE,
      url: canonical,
      // No width/height on the row/authored image: it is whatever the row
      // carries or the owner uploaded, and dimensions we have not measured make
      // scrapers crop wrong. The branded card declares its own.
      ...(ogImage
        ? { images: [ogImage] }
        : brandedOg
          ? { images: [brandedOg] }
          : {}),
    },
    twitter: { card: "summary_large_image" },
  };
}
