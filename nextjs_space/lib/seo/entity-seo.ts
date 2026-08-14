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
  /**
   * US-022 — the crawler directives for this entity's page. Absent unless at
   * least one flag is set, so "no robots key" and "everything allowed" are the
   * same stored state.
   */
  readonly robots?: EntityRobots;
  /**
   * US-022 — an absolute https URL that replaces the canonical this page would
   * otherwise declare. See {@link isCanonicalOverrideUrl} for why nothing else
   * survives the parse.
   */
  readonly canonicalOverride?: string;
  /** US-022 — keep this entity's URL out of the store's sitemap. */
  readonly sitemapExclude?: boolean;
}

/** US-022 — `<meta name="robots">` for one entity. Only `true` is ever stored. */
export interface EntityRobots {
  readonly noindex?: boolean;
  readonly nofollow?: boolean;
}

/**
 * US-022 — the fields an owner authors for a HUMAN reader (and the SEO Manager
 * previews), as against the rest of the record, which instructs a CRAWLER. The
 * split is what lets a save that may not write indexing controls leave the
 * stored ones alone rather than erase them (see {@link entitySeoWrite}).
 *
 * Named as a tuple because `lib/seo/page-seo-write.ts` performs the same split
 * in SQL and builds its `jsonb - key` chain from this list, so the statement and
 * {@link entitySeoContent} cannot come to disagree about which key is which. It
 * is the CONTENT half that is enumerated, deliberately: a crawler directive
 * added later is then preserved by default rather than silently dropped by a
 * writer that had not heard of it.
 */
export const ENTITY_SEO_CONTENT_KEYS = [
  "title",
  "description",
  "ogImage",
  "imageAlt",
] as const;

/** How long a stored `canonicalOverride` may be — the `ogImage` URL cap. */
export const CANONICAL_OVERRIDE_MAX_LENGTH = 2000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Is this a canonical override we are willing to publish?
 *
 * Absolute and https, because that is the whole point of the field: it names the
 * page that owns this content, which may be on another host entirely, and a
 * relative value would just be the path the page already has. https-only because
 * a canonical pointing at http on a store served over https tells a crawler to
 * prefer the insecure copy.
 *
 * Shared by the Zod schema on every SEO PUT route and by `readEntitySeo`, so a
 * value that was legal when it was written stays legal when it is read, and a
 * value that reached the column any other way is dropped rather than rendered.
 */
export function isCanonicalOverrideUrl(value: string): boolean {
  if (value.length > CANONICAL_OVERRIDE_MAX_LENGTH) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

/**
 * The crawler directives, or undefined when none are set.
 *
 * `=== true` and nothing else: a string "true", a 1, or a nested object are all
 * dropped. This runs inside `generateMetadata`, and a robots value we cannot
 * read must render NO directive rather than a guessed one — the wrong guess
 * either de-indexes a page the owner wanted found or publishes one they wanted
 * hidden, and only one of those is recoverable.
 */
function readEntityRobots(value: unknown): EntityRobots | undefined {
  if (!isRecord(value)) return undefined;

  const noindex = value.noindex === true;
  const nofollow = value.nofollow === true;
  if (!noindex && !nofollow) return undefined;

  return {
    ...(noindex ? { noindex: true } : {}),
    ...(nofollow ? { nofollow: true } : {}),
  };
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

  const robots = readEntityRobots(value.robots);
  const canonicalOverride = seoText(value.canonicalOverride);
  const sitemapExclude = value.sitemapExclude === true;

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(ogImage ? { ogImage } : {}),
    ...(imageAlt ? { imageAlt } : {}),
    ...(robots ? { robots } : {}),
    ...(isCanonicalOverrideUrl(canonicalOverride) ? { canonicalOverride } : {}),
    ...(sitemapExclude ? { sitemapExclude: true } : {}),
  };
}

/** True when the owner has authored nothing at all for this entity. */
export function isEmptyEntitySeo(seo: EntitySeo): boolean {
  return (
    !seo.title &&
    !seo.description &&
    !seo.ogImage &&
    !seo.imageAlt &&
    !seo.robots &&
    !seo.canonicalOverride &&
    !seo.sitemapExclude
  );
}

/** The half of a record an owner writes for a reader. */
export function entitySeoContent(seo: EntitySeo): EntitySeo {
  return {
    ...(seo.title ? { title: seo.title } : {}),
    ...(seo.description ? { description: seo.description } : {}),
    ...(seo.ogImage ? { ogImage: seo.ogImage } : {}),
    ...(seo.imageAlt ? { imageAlt: seo.imageAlt } : {}),
  };
}

/** The half a Pro tenant writes for a crawler. */
export function entitySeoIndexing(seo: EntitySeo): EntitySeo {
  return {
    ...(seo.robots ? { robots: seo.robots } : {}),
    ...(seo.canonicalOverride
      ? { canonicalOverride: seo.canonicalOverride }
      : {}),
    ...(seo.sitemapExclude ? { sitemapExclude: true } : {}),
  };
}

export interface EntitySeoWriteOptions {
  /**
   * True when this save is NOT allowed to write indexing controls — a Basic
   * tenant, or any caller that sent none of those fields.
   */
  readonly preserveIndexing?: boolean;
}

/**
 * US-022 — the record to STORE for one save.
 *
 * The content fields always come from what was submitted. The indexing fields
 * come from the submission when the caller was entitled to send them, and
 * otherwise from what is already stored: a save that is REFUSED the right to
 * change a directive must not erase it either. That is what makes a Pro tenant's
 * rules dormant rather than destroyed when they drop to Basic — the storefront
 * stops honouring them (see `lib/seo/indexing.ts`), the editor keeps offering to
 * save titles, and an upgrade brings the rules back exactly as they were.
 *
 * The same rule `withEntityImageAlt` has always applied to the other direction:
 * two editors write this one column, and a blind write from either drops the
 * other's work.
 */
export function entitySeoWrite(
  stored: unknown,
  authored: unknown,
  options: EntitySeoWriteOptions = {},
): EntitySeo {
  const submitted = readEntitySeo(authored);
  if (!options.preserveIndexing) return submitted;

  return {
    ...entitySeoContent(submitted),
    ...entitySeoIndexing(readEntitySeo(stored)),
  };
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
): EntitySeo | null {
  const current = readEntitySeo(existing);
  const imageAlt = seoText(alt);

  // Everything that is not `imageAlt` is carried through unread, US-022's
  // indexing controls included: the Wire's editor knows nothing about them and
  // must not delete a noindex by saving a cover image's alt text. The two
  // halves are rebuilt rather than spread, so an empty alt CLEARS the stored one
  // instead of leaving it behind.
  const merged: EntitySeo = {
    ...entitySeoContent({ ...current, imageAlt: imageAlt || undefined }),
    ...entitySeoIndexing(current),
  };

  return isEmptyEntitySeo(merged) ? null : merged;
}
