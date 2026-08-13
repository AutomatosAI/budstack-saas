/**
 * SEO Supercharge — ONE authored SEO record, parsed from an untrusted Json blob.
 *
 * The same three fields are written for every entity in the SEO Manager: a
 * `tenants.pageSeo` entry (US-002), `posts.seo` (US-003), and later
 * `products.seo` / `conditions.seo`. Each column is a Prisma `Json?` with no
 * DB-level shape, so a nested value can be anything at all — a number title
 * would render `<title>7</title>`, an object description would render
 * `[object Object]`.
 *
 * Every reader runs inside `generateMetadata`, which renders with no `error.tsx`
 * boundary above it: a throw there is a blank page, not a missing tag. So this
 * fails CLOSED on every malformed shape and lets the caller fall back to its own
 * default.
 *
 * Deliberately dependency-free (no zod, no next, no prisma) — a client component
 * imports it through `store-pages.ts` for the admin list.
 */

import { seoText } from "@/lib/seo/store-identity";

/** The three fields an owner can author for any SEO-bearing entity. */
export interface EntitySeo {
  readonly title?: string;
  readonly description?: string;
  /** A stored image reference, NOT a URL — resolve with `storedPublicImagePath`. */
  readonly ogImage?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * One authored record, keeping only the fields that are non-empty strings.
 * `{}` for anything that is not an object at all.
 */
export function readEntitySeo(value: unknown): EntitySeo {
  if (!isRecord(value)) return {};

  const title = seoText(value.title);
  const description = seoText(value.description);
  const ogImage = seoText(value.ogImage);

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(ogImage ? { ogImage } : {}),
  };
}

/** True when the owner has authored nothing at all for this entity. */
export function isEmptyEntitySeo(seo: EntitySeo): boolean {
  return !seo.title && !seo.description && !seo.ogImage;
}
