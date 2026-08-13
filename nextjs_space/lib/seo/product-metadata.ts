/**
 * SEO Supercharge US-004 — metadata for a storefront product page.
 *
 * THE DEFECT THIS CLOSES: the product page emitted NO metadata whatsoever. The
 * whole route WAS a `"use client"` module, so it could not export
 * `generateMetadata` even in principle, and every product in every store
 * rendered the platform title from app/layout.tsx — on the single most shared,
 * most linked, most crawled page type a storefront has. `products.seo`, which
 * the SEO Manager has always written through
 * app/api/tenant-admin/seo/products/[id]/route.ts, was therefore write-only.
 * US-004 split the interactive body out to `product-detail-client.tsx` so the
 * route itself could become a Server Component.
 *
 * THE TWO SOURCES THIS JOINS. The page a visitor sees is rendered from the LIVE
 * Dr Green strain (name, description, image, price), fetched by id; the SEO
 * OVERRIDE lives on the LOCAL `products` row, matched to that strain through
 * `drGreenStrainId`. Neither alone is enough: the local row's `name` goes stale
 * the moment Dr Green renames a strain, and the live strain carries no authored
 * SEO. So the cascade is authored-override → live product, per field.
 *
 * HOW IT COMPOSES WITH THE US-001 LAYOUT (semantics verified against
 * next/dist/lib/metadata/resolve-metadata.js, 14.2.35), identical in shape to
 * `page-metadata.ts` and `post-metadata.ts`:
 *  - An AUTHORED title is `{ absolute }` — it renders exactly as typed, because
 *    the SEO Manager previews that string to the owner as a Google result.
 *  - A DEFAULT title is a plain string, which the layout's `title.template`
 *    wraps into "Blue Dream | Acme Cannabis".
 *  - `description` is OMITTED rather than set to undefined when there is nothing
 *    to say: `mergeMetadata` assigns `target[key] = source[key] || null` for that
 *    field (:194-205), so a present-but-undefined key NULLs the store
 *    description instead of inheriting it.
 *  - `openGraph` is REPLACED wholesale by the deepest segment that declares it
 *    (:145), so siteName/type/locale are re-declared here.
 *  - og:type is "website", not "product": Next 14's `OpenGraphType` union has no
 *    product member, and the product-shaped signal a shopping crawler actually
 *    reads is the `Product` JSON-LD block — US-015, gated on the Pro plan.
 *
 * Pure and total, like every builder in this directory: `generateMetadata`
 * renders with no `error.tsx` boundary above it, so a malformed Json blob or a
 * missing field must degrade to a default rather than throw a blank page.
 */

import type { Metadata } from "next";

import { storeCanonical } from "@/lib/seo/canonical";
import { readEntitySeo } from "@/lib/seo/entity-seo";
import { productPath } from "@/lib/seo/product-paths";
import {
  STORE_OG_LOCALE,
  seoText,
  storeDisplayName,
  truncateSeoText,
} from "@/lib/seo/store-identity";
import { storedPublicImagePath } from "@/lib/storage/public-image-url";

/**
 * Title for an id that resolves to no live strain — a discontinued product, a
 * stale link, or Dr Green being unreachable. The page body renders "Product not
 * found" for exactly those cases (product-detail-client.tsx); this is the same
 * sentence title-cased, matching `STORE_NOT_FOUND_TITLE`.
 */
export const PRODUCT_NOT_FOUND_TITLE = "Product Not Found";

export interface ProductMetadataSource {
  readonly businessName: string;
  readonly subdomain: string;
  readonly customDomain: string | null;
  /** The Dr Green strain id this URL names — the canonical path segment. */
  readonly productId: string;
  /** Live strain name. `unknown`: it comes off an untyped upstream payload. */
  readonly name: unknown;
  /** Live strain description — body copy, so truncated before it is emitted. */
  readonly description: unknown;
  /**
   * Live strain image, already absolutised by `resolveImageUrl`
   * (lib/drgreen/doctor-green-api.ts:229) against the Dr Green bucket.
   */
  readonly imageUrl: unknown;
  /** Raw `products.seo` Json from the LOCAL row — parsed here, never trusted. */
  readonly seo: unknown;
}

export function buildProductMetadata(
  source: ProductMetadataSource,
): Metadata {
  const businessName = storeDisplayName(source.businessName, source.subdomain);
  const seo = readEntitySeo(source.seo);

  const authoredTitle = seoText(seo.title);
  const title = authoredTitle
    ? { absolute: authoredTitle }
    : seoText(source.name) || PRODUCT_NOT_FOUND_TITLE;

  // No third tier: with neither an authored description nor strain copy the
  // layout's own description is inherited, which is a truthful sentence about
  // the store. A per-store constant would put the SAME description on every
  // product — the duplicate-content defect this workstream exists to remove.
  const description =
    seoText(seo.description) || truncateSeoText(source.description);

  const canonical = storeCanonical(source, productPath(source.productId));

  // Fails closed on a presigned S3 URL (an owner paste, or an upstream image
  // that arrives signed): a tag that 403s an hour after it is minted looks
  // correct and breaks silently. A relative result — an authored ogImage stored
  // as a tenant upload key — absolutises against the layout's metadataBase,
  // which children inherit (resolve-metadata.js:129).
  const ogImage =
    storedPublicImagePath(seo.ogImage) ??
    storedPublicImagePath(seoText(source.imageUrl) || null);

  return {
    title,
    // Omitted rather than undefined — see the merge note in the module header.
    ...(description ? { description } : {}),
    alternates: { canonical },
    openGraph: {
      siteName: businessName,
      type: "website",
      locale: STORE_OG_LOCALE,
      url: canonical,
      // No width/height: the image is whatever Dr Green serves or the owner
      // uploaded, and dimensions we have not measured make scrapers crop it
      // wrong. US-018's generated images are a known 1200x630 and can declare.
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    twitter: { card: "summary_large_image" },
  };
}
