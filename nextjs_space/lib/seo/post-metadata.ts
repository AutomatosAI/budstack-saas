/**
 * SEO Supercharge US-003 — metadata for The Wire (the storefront blog).
 *
 * THE DEFECT THIS CLOSES: `posts.seo` was write-only. The SEO Manager saves a
 * title/description/ogImage per post through
 * app/api/tenant-admin/seo/posts/[id]/route.ts, and the article page ignored the
 * column entirely — it built `"{post.title} | {businessName}"` with the post's
 * excerpt and cover image, and emitted no canonical, no article type, no
 * published time and no author.
 *
 * It also un-does a double suffix that US-001 introduced: the article page
 * hand-appended `" | {businessName}"` to its title, and the store layout now
 * stashes a `"%s | {businessName}"` template for every segment deeper than the
 * homepage — an article sits four nodes below the store layout, so the rendered
 * title had become "Post | Acme | Acme". Titles are handed over unsuffixed here
 * and the template does the one job it exists for.
 *
 * HOW IT COMPOSES WITH THE LAYOUT (semantics verified against
 * next/dist/lib/metadata/resolve-metadata.js, 14.2.35):
 *  - An AUTHORED title is `{ absolute }` so it renders exactly as typed — the
 *    SEO Manager previews that string to the owner. A DEFAULT (the post's own
 *    title) is a plain string, which the layout template suffixes.
 *  - `description` is OMITTED, not set to undefined, when there is nothing to
 *    say: `mergeMetadata` assigns `target[key] = source[key] || null` for that
 *    field (:194-205), so a present-but-undefined key would NULL the layout's
 *    description rather than inherit it.
 *  - `openGraph` is REPLACED wholesale by the deepest segment that declares it
 *    (:145), so this re-declares siteName/locale alongside the article fields.
 *  - `twitter` is declared for the card type only. `postProcessMetadata`
 *    (:406-442) fills its title, description and images from the resolved
 *    openGraph/metadata, which is the only way the card and the page agree.
 *
 * Pure and total, like every builder in this directory: `generateMetadata` has
 * no `error.tsx` boundary above it, so a malformed Json blob or a date that
 * arrived as a string must degrade to a default rather than throw a blank page.
 */

import type { Metadata } from "next";

import { storeCanonical } from "@/lib/seo/canonical";
import { readEntitySeo } from "@/lib/seo/entity-seo";
import {
  STORE_OG_LOCALE,
  seoText,
  storeDisplayName,
} from "@/lib/seo/store-identity";
import { storedPublicImagePath } from "@/lib/storage/public-image-url";

/** The Wire's store-relative paths — also its canonical paths. */
export const WIRE_INDEX_PATH = "/the-wire";

export function wirePostPath(slug: string): string {
  return `${WIRE_INDEX_PATH}/${slug}`;
}

/** Title for a post slug that resolves to nothing; the shipped wording. */
export const POST_NOT_FOUND_TITLE = "Not Found";

/** Index title, kept plain so the layout renders "The Wire | {businessName}". */
export const WIRE_INDEX_TITLE = "The Wire";

/**
 * Mirrors the sentence the index page already renders under its heading
 * (app/store/[slug]/the-wire/page.tsx), so the search snippet and the page a
 * visitor lands on say the same thing.
 */
function wireIndexDescription(businessName: string): string {
  return `Latest news, research updates, and insights from ${businessName}.`;
}

export interface WireTenantSource {
  readonly businessName: string;
  readonly subdomain: string;
  readonly customDomain: string | null;
}

/**
 * The post fields metadata needs. Everything the Json column or the any-widened
 * `prisma` export (lib/db.ts) hands over is typed `unknown` here, because that
 * is genuinely what arrives at runtime.
 */
export interface PostMetadataSource extends WireTenantSource {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string | null;
  /** Stored cover reference — an S3 key, a path or a URL, never re-signed here. */
  readonly coverImage: string | null;
  /** `posts.createdAt`; a Date from Prisma, a string once it has been serialised. */
  readonly createdAt: unknown;
  /** Raw `posts.seo` Json — parsed here, never trusted. */
  readonly seo: unknown;
  /** `posts.users.name`, the byline the article itself renders. */
  readonly authorName: unknown;
}

/**
 * ISO-8601 timestamp for `article:published_time`, or undefined when the value
 * is not a real date.
 *
 * Accepts a string as well as a Date: a JSON round trip turns one into the
 * other, and an `Invalid Date` reaching `toISOString()` throws a RangeError —
 * the failure mode that takes render routes down elsewhere in this repo.
 */
function isoTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string" && !(value instanceof Date)) return undefined;

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

/** Metadata for The Wire's index page. */
export function buildWireIndexMetadata(source: WireTenantSource): Metadata {
  const businessName = storeDisplayName(source.businessName, source.subdomain);
  const canonical = storeCanonical(source, WIRE_INDEX_PATH);

  return {
    title: WIRE_INDEX_TITLE,
    description: wireIndexDescription(businessName),
    alternates: { canonical },
    openGraph: {
      siteName: businessName,
      type: "website",
      locale: STORE_OG_LOCALE,
      url: canonical,
    },
  };
}

/** Metadata for one Wire article. */
export function buildPostMetadata(source: PostMetadataSource): Metadata {
  const businessName = storeDisplayName(source.businessName, source.subdomain);
  const seo = readEntitySeo(source.seo);

  const authoredTitle = seoText(seo.title);
  const title = authoredTitle
    ? { absolute: authoredTitle }
    : seoText(source.title) || POST_NOT_FOUND_TITLE;

  // No third tier: with neither an authored description nor an excerpt the
  // layout's own description is inherited, which is a truthful sentence about
  // the store. Deriving one from the post body would mean un-escaping HTML
  // inside a metadata path, and a per-store constant would put the SAME
  // description on every article — the duplicate-content defect this workstream
  // exists to remove.
  const description = seoText(seo.description) || seoText(source.excerpt);

  // The author of the article, not the platform: the store layout sets
  // `authors: [{ name: businessName }]` for every page and an article has a
  // person. Falls back to the store rather than to the visible "Admin" byline,
  // which is a UI placeholder and not a name.
  const authorName = seoText(source.authorName) || businessName;

  const canonical = storeCanonical(source, wirePostPath(source.slug));

  // Fails closed on a presigned S3 URL left over from before Email US-005: a
  // tag that 403s an hour after it is minted looks correct and breaks silently.
  // Relative results absolutise against the layout's metadataBase, which
  // children inherit (resolve-metadata.js:129).
  const ogImage =
    storedPublicImagePath(seo.ogImage) ??
    storedPublicImagePath(source.coverImage);

  const publishedTime = isoTimestamp(source.createdAt);

  return {
    title,
    // Omitted rather than undefined — see the merge note in the module header.
    ...(description ? { description } : {}),
    authors: [{ name: authorName }],
    alternates: { canonical },
    openGraph: {
      siteName: businessName,
      type: "article",
      locale: STORE_OG_LOCALE,
      url: canonical,
      ...(publishedTime ? { publishedTime } : {}),
      authors: [authorName],
      // No width/height: the image is whatever the owner uploaded or pasted,
      // and dimensions we have not measured make scrapers crop it wrong.
      ...(ogImage ? { images: [ogImage] } : {}),
    },
    twitter: { card: "summary_large_image" },
  };
}
