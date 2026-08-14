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

/** The fields an owner can author for any SEO-bearing entity. */
export interface EntitySeo {
  readonly title?: string;
  readonly description?: string;
  /** A stored image reference, NOT a URL — resolve with `storedPublicImagePath`. */
  readonly ogImage?: string;
  /**
   * US-009 — alt text for the entity's own image: the cover on a Wire post, the
   * strain shot on a product. Rendered into `alt=`, never into a meta tag.
   *
   * WHY IT LIVES HERE rather than in a column of its own. The story asked for
   * `product_images.altText`; there is no `product_images` model in
   * prisma/schema.prisma — `products.images` is a `String[]` of URLs, and the
   * `altText` the detail gallery already renders arrives on the Dr Green payload
   * (`DoctorGreenProduct.strainImages[].altText`, lib/drgreen/doctor-green-api.ts
   * :166-169), which is upstream data no store owner can edit. `seo` is the one
   * per-entity authored column that exists, it needs no migration, and
   * `products/sync` never writes it (app/api/tenant-admin/products/sync/route.ts
   * :55-102) — so an authored alt survives every catalogue re-sync. One key
   * across posts and products also means ONE parser and ONE editor field rather
   * than a per-entity name (the story's `posts.seo.coverAlt` suggestion).
   */
  readonly imageAlt?: string;
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
  const imageAlt = seoText(value.imageAlt);

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(ogImage ? { ogImage } : {}),
    ...(imageAlt ? { imageAlt } : {}),
  };
}

/** True when the owner has authored nothing at all for this entity. */
export function isEmptyEntitySeo(seo: EntitySeo): boolean {
  return !seo.title && !seo.description && !seo.ogImage && !seo.imageAlt;
}

/**
 * US-009 — the `alt` an image should carry: the authored text when there is one,
 * else the caller's own fallback.
 *
 * Never returns undefined. An `alt` that is missing entirely makes a screen
 * reader announce the file name, so every call site passes something truthful
 * (a post title, a product name) as the floor; `alt=""` stays a deliberate
 * choice the caller makes by passing "".
 */
export function entityImageAlt(seo: unknown, fallback: string): string {
  return readEntitySeo(seo).imageAlt || seoText(fallback);
}

/**
 * The `seo` value to STORE when the only field being written is the image alt —
 * every other authored field preserved.
 *
 * The Wire's post editor writes the cover alt (app/tenant-admin/the-wire/
 * post-form.tsx) while the SEO Manager writes title/description/ogImage for the
 * same row through a different route. Both land in one Json column, so a blind
 * `{ imageAlt }` write from either side would silently drop the other's work.
 * Reading through `readEntitySeo` first means a corrupt blob cannot round-trip
 * junk back into the column either.
 *
 * Returns null when nothing at all is left, matching what the SEO Manager's
 * write routes store for an entity with nothing authored.
 */
export function withEntityImageAlt(
  existing: unknown,
  alt: unknown,
): Record<string, string> | null {
  const current = readEntitySeo(existing);
  const imageAlt = seoText(alt);

  const merged: Record<string, string> = {
    ...(current.title ? { title: current.title } : {}),
    ...(current.description ? { description: current.description } : {}),
    ...(current.ogImage ? { ogImage: current.ogImage } : {}),
    ...(imageAlt ? { imageAlt } : {}),
  };

  return Object.keys(merged).length > 0 ? merged : null;
}
