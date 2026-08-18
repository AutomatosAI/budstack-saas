/**
 * Platform US-009 — metadata for one budstacks.io/blog article.
 *
 * THE DEFECT THIS CLOSES: `app/blog/[slug]/page.tsx` exported NO metadata at
 * all. Every article on the platform blog therefore served the root layout's
 * title — "BudStacks - Medical Cannabis SaaS Platform" — with the platform's
 * generic description, no canonical, no article type, no published time, no
 * author and no image. Eight posts, one <title> between them: duplicate content
 * by construction, and nothing to preview when one is shared.
 *
 * It is `buildPostMetadata`'s counterpart (lib/seo/post-metadata.ts, which does
 * this job for a tenant's Wire) and deliberately not a call into it. That
 * builder's every input is a tenant — business name, subdomain, custom domain,
 * plan — and budstacks.io is not one; the plan gates and the branded-card
 * cascade have no meaning here, and faking a tenant to reach them would be
 * worse than the forty lines below.
 *
 * HOW IT COMPOSES WITH THE ROOT LAYOUT (app/layout.tsx):
 *  - The layout sets a PLAIN `title`, not a `title.template`. Nothing suffixes
 *    a child's title, so the brand is appended here, matching the house
 *    "{page} | BudStacks" the other marketing pages already render.
 *  - `description` is OMITTED, not set to undefined, when there is nothing to
 *    say: Next's `mergeMetadata` assigns `target[key] = source[key] || null` for
 *    that field, so a present-but-undefined key would NULL the layout's
 *    description rather than inherit it.
 *  - `openGraph` is REPLACED wholesale by the deepest segment that declares it,
 *    so this re-declares siteName/locale alongside the article fields.
 *  - Images are ABSOLUTE. The platform layout declares no `metadataBase` — see
 *    `platformAbsoluteUrl` — so a relative one would point at localhost.
 *
 * Pure and total, like every builder in this directory: `generateMetadata` has
 * no `error.tsx` boundary above it, so a malformed Json blob or a date that
 * arrived as a string must degrade to a default rather than throw a blank page.
 */

import type { Metadata } from "next";

import { blogPostPath } from "@/lib/seo/blog-paths";
import { readEntitySeo } from "@/lib/seo/entity-seo";
import { isoTimestamp } from "@/lib/seo/iso-timestamp";
import { platformAbsoluteUrl, platformCanonical } from "@/lib/seo/platform-url";
import { seoText } from "@/lib/seo/store-identity";
import { storedPublicImagePath } from "@/lib/storage/public-image-url";

/** og:site_name and the title suffix — the platform's own name, not a tenant's. */
export const PLATFORM_SITE_NAME = "BudStacks";

/** Matches app/layout.tsx's `locale: 'en_US'`; the platform is English-only. */
export const PLATFORM_OG_LOCALE = "en_US";

/** Title for a slug that resolves to nothing, in the house "| BudStacks" shape. */
export const PLATFORM_POST_NOT_FOUND_TITLE = `Not Found | ${PLATFORM_SITE_NAME}`;

/**
 * The og:image every post falls back to when it has no cover of its own.
 *
 * Neither the editor nor the migration makes a cover mandatory, and a shared
 * link with no image is a bare grey card — so the platform's own hero stands in
 * rather than nothing. `budstack-hero-ecosystem.jpg` is 2752×1536 (≈1.79:1),
 * which is the ratio og:image wants; the other brand assets in `public/` are a
 * square cube and a 1500×287 wordmark, both of which crop badly in a card.
 *
 * A path, not a URL: {@link platformAbsoluteUrl} resolves it against whichever
 * origin the container is actually serving. Exported because US-013's
 * `platform_seo_settings` is where an authored default will live, and this is
 * the value it replaces.
 */
export const PLATFORM_DEFAULT_OG_IMAGE = "/budstack-hero-ecosystem.jpg";

/**
 * The post fields metadata needs. Everything the Json column or the any-widened
 * `prisma` export (lib/db.ts) hands over is typed `unknown` here, because that
 * is genuinely what arrives at runtime.
 */
export interface PlatformPostMetadataSource {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string | null;
  /** Stored cover reference — an S3 key, a path or a URL, never re-signed here. */
  readonly coverImage: string | null;
  /** `platform_posts.authorName`, the byline the article itself renders. */
  readonly authorName: string;
  /** `platform_posts.publishedAt`; a Date from Prisma, a string once serialised. */
  readonly publishedAt: unknown;
  /** Raw `platform_posts.seo` Json — parsed here, never trusted. */
  readonly seo: unknown;
}

/**
 * og:image for a post: the authored override, then its cover, then the platform
 * default — so the answer is never nothing.
 *
 * `storedPublicImagePath` fails CLOSED on a presigned S3 URL left over from
 * before Email US-005: a tag that 403s an hour after it is minted looks correct
 * and breaks silently. Its null then falls through to the default here rather
 * than dropping the tag.
 *
 * Exported for US-018: the Article node's `image` is the SAME picture as the
 * `og:image` beside it, and structured data that disagrees with the tags on the
 * page it sits in is the defect the whole seo/ directory is arranged to avoid.
 */
export function platformPostOgImage(
  seoOgImage: string | undefined,
  coverImage: string | null,
) {
  const stored =
    storedPublicImagePath(seoOgImage) ?? storedPublicImagePath(coverImage);

  return (
    platformAbsoluteUrl(stored) ??
    platformAbsoluteUrl(PLATFORM_DEFAULT_OG_IMAGE) ??
    PLATFORM_DEFAULT_OG_IMAGE
  );
}

/**
 * What one article actually serves, before it is shaped into a {@link Metadata}.
 *
 * Split out for Platform US-020's audit, for the reason its page counterpart is
 * (`resolvePlatformPageSeo`): the audit's questions are "does this article have
 * a description of its own" and "is its social card the platform hero", and
 * neither survives into the built `Metadata` — the description key is OMITTED
 * when there is nothing to say, and the image is a union type the audit would
 * have to guess its way through. Re-deriving either would be a second copy of
 * the cascade below, drifting from the tag it claims to describe.
 */
export interface PlatformPostSeo {
  /** The `<title>`, as Next receives it — absolute when authored. */
  readonly title: Metadata["title"];
  /** "" when the article inherits the layout's platform description. */
  readonly description: string;
  readonly ogImage: string;
  readonly canonical: string;
  readonly authorName: string;
  /** True when the card is the platform hero rather than this article's. */
  readonly usesDefaultOgImage: boolean;
}

/** Resolve one article's metadata. Pure and total. */
export function resolvePlatformPostSeo(
  source: PlatformPostMetadataSource,
): PlatformPostSeo {
  const seo = readEntitySeo(source.seo);

  // An AUTHORED title renders exactly as typed — that is what authoring it
  // means, and a suffix bolted onto a hand-written title is how a page ends up
  // titled "Foo | BudStacks | BudStacks". The post's own title takes the house
  // suffix instead.
  const authoredTitle = seoText(seo.title);
  const headline = seoText(source.title);
  const title = authoredTitle
    ? { absolute: authoredTitle }
    : headline
      ? `${headline} | ${PLATFORM_SITE_NAME}`
      : PLATFORM_POST_NOT_FOUND_TITLE;

  // No third tier: with neither an authored description nor an excerpt the
  // layout's own description is inherited, which is a truthful sentence about
  // the platform. Deriving one from the post body would mean un-escaping HTML
  // inside a metadata path, and a per-page constant would put the SAME
  // description on every article — the duplicate-content defect this closes.
  const description = seoText(seo.description) || seoText(source.excerpt);

  const ogImage = platformPostOgImage(seo.ogImage, source.coverImage);

  return {
    title,
    description,
    ogImage,
    canonical: platformCanonical(blogPostPath(source.slug)),
    authorName: seoText(source.authorName) || PLATFORM_SITE_NAME,
    // Compared against what the cascade produces for an article with neither an
    // authored image nor a cover, so a stored reference this origin cannot serve
    // — a presigned S3 URL, a bare filename — counts as the default it will
    // actually render as.
    usesDefaultOgImage: ogImage === platformPostOgImage(undefined, null),
  };
}

/** Metadata for one budstacks.io/blog article. */
export function buildPlatformPostMetadata(
  source: PlatformPostMetadataSource,
): Metadata {
  const { title, description, ogImage, canonical, authorName } =
    resolvePlatformPostSeo(source);
  const publishedTime = isoTimestamp(source.publishedAt);

  return {
    title,
    // Omitted rather than undefined — see the merge note in the module header.
    ...(description ? { description } : {}),
    authors: [{ name: authorName }],
    alternates: { canonical },
    openGraph: {
      siteName: PLATFORM_SITE_NAME,
      type: "article",
      locale: PLATFORM_OG_LOCALE,
      url: canonical,
      ...(publishedTime ? { publishedTime } : {}),
      authors: [authorName],
      // No width/height: the cover is whatever the author uploaded or pasted,
      // and dimensions we have not measured make scrapers crop it wrong.
      images: [ogImage],
    },
    twitter: { card: "summary_large_image" },
  };
}
