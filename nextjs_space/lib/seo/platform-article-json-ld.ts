/**
 * Platform US-018 — structured data for one budstacks.io/blog article: the
 * Organization that published it, the Article itself, and the trail that gets it
 * there.
 *
 * THE GAP THIS CLOSES: US-009 gave every platform post a title, a description, a
 * canonical, an `og:type: article` and a published time. None of that is
 * machine-readable as an ARTICLE. Publication date, author and publisher reach a
 * search surface only through an `Article` node, and a result showing
 * `budstacks.io › Blog › <post>` instead of the bare URL is the difference a
 * `BreadcrumbList` makes. Storefront Wire posts have had both since SEO
 * Supercharge US-016; the platform's own blog had neither.
 *
 * NOT A SECOND IMPLEMENTATION. The two node builders are the ones the tenant
 * Wire page already renders — `buildArticleNode` (lib/seo/article-json-ld.ts)
 * and `buildBreadcrumbNodes` (lib/seo/breadcrumb-json-ld.ts) — extracted from
 * those modules by this story so both sites state an Article and a
 * BreadcrumbList the same way. What is platform-specific, and all that lives
 * here, is the cascade feeding them:
 *
 *  - NO PLAN GATE. `isSeoProUnlocked` gates a tenant's structured data because
 *    Pro SEO is a thing tenants buy. budstacks.io is not a tenant and buys
 *    nothing from itself, so the node is unconditional.
 *  - URLs come from `platformCanonical`, not `storeCanonical` — the same origin
 *    the page's own canonical and og:url already name (US-017), so the block and
 *    the tags beside it cannot disagree about what this page's address is.
 *  - The publisher is the PLATFORM, restated on this page rather than referenced
 *    from the homepage: structured data is parsed PER URL, so an `@id` pointing
 *    at a node declared elsewhere hands a consumer a publisher with no name.
 *  - The image is `platformPostOgImage`, the identical cascade the og:image
 *    runs, ending in the platform hero — so a post with no cover still has one.
 *
 * PURE AND TOTAL, like every builder in this directory: no Prisma, no headers,
 * no throw. It runs in the article's render path, which has no `error.tsx`
 * boundary above it, so a malformed `seo` blob or a date that arrived as a
 * string degrades to omission rather than a blank page.
 */

import {
  buildArticleNode,
  type ArticleNodeSource,
} from "@/lib/seo/article-json-ld";
import {
  buildBreadcrumbNodes,
  type BreadcrumbTrailItem,
} from "@/lib/seo/breadcrumb-json-ld";
import {
  BLOG_INDEX_PATH,
  BLOG_INDEX_TITLE,
  blogPostPath,
} from "@/lib/seo/blog-paths";
import { readEntitySeo } from "@/lib/seo/entity-seo";
import {
  buildOrganizationNode,
  organizationJsonLdId,
  type JsonLdNode,
} from "@/lib/seo/json-ld";
import {
  PLATFORM_SITE_NAME,
  platformPostOgImage,
} from "@/lib/seo/platform-post-metadata";
import { platformBaseUrl, platformCanonical } from "@/lib/seo/platform-url";
import { seoText } from "@/lib/seo/store-identity";

/**
 * The publisher's logo — the wordmark the marketing nav itself renders
 * (components/homepage/Nav.tsx), 1500×287, so the entity a crawler reads carries
 * the same mark a visitor sees at the top of the page.
 *
 * A `/public` path rather than `platform_settings.logoUrl`: that column holds a
 * PRIVATE S3 key (the platform branding keys deliberately sit outside
 * `PLATFORM_UPLOAD_PREFIX`, lib/storage/public-image-url.ts), reachable only
 * through a presigned URL that dies in an hour. `storedPublicImagePath` fails
 * closed on exactly that shape, so wiring it up would publish no logo at all
 * while looking like it did.
 */
export const PLATFORM_ORGANIZATION_LOGO =
  "/images/homepage/budstacks-horizontal.png";

/**
 * The platform's Organization `@id` — the join key the Article's `publisher`
 * points at, anchored to whichever origin `platformBaseUrl()` resolves for this
 * container.
 */
export function platformOrganizationJsonLdId(): string {
  return organizationJsonLdId(platformBaseUrl());
}

/** Home → Blog → this article. */
export function blogPostBreadcrumbTrail(
  title: unknown,
  slug: string,
): readonly BreadcrumbTrailItem[] {
  return [
    { name: BLOG_INDEX_TITLE, path: BLOG_INDEX_PATH },
    { name: title, path: blogPostPath(slug) },
  ];
}

/** The `platform_posts` columns this builder reads. */
export interface PlatformArticleJsonLdSource {
  readonly slug: string;
  readonly title: string;
  readonly excerpt: string | null;
  /** Stored cover reference — an S3 key, a path or a URL, never re-signed here. */
  readonly coverImage: string | null;
  /** `platform_posts.authorName`, the byline the article renders. */
  readonly authorName: string;
  /**
   * `platform_posts.publishedAt` — the date the article went live and the date
   * the page itself prints, NOT `createdAt`. A post drafted in June and
   * published in August is an August article to a reader, and `datePublished`
   * must say what the byline says. Null while a post is a draft, which
   * `isoTimestamp` drops; a draft never reaches this code path anyway, since
   * `published: true` is inside the loader's query.
   */
  readonly publishedAt: unknown;
  /** `platform_posts.updatedAt` — stamped by Prisma on every edit. */
  readonly updatedAt: unknown;
  /** Raw `platform_posts.seo` Json — parsed here, never trusted. */
  readonly seo: unknown;
}

/**
 * Organization, Article and BreadcrumbList for one platform post — or an empty
 * array when the post has no usable title, which `<JsonLd>` renders as no
 * element at all.
 *
 * All three in ONE block: `serializeJsonLd` puts multiple nodes in an `@graph`,
 * which is how one script element carries several entities that reference each
 * other by `@id`.
 */
export function buildPlatformArticleJsonLd(
  source: PlatformArticleJsonLdSource,
): readonly JsonLdNode[] {
  const siteUrl = platformBaseUrl();
  const seo = readEntitySeo(source.seo);

  const articleSource: ArticleNodeSource = {
    url: platformCanonical(blogPostPath(source.slug)),
    title: source.title,
    // Authored description first, then the excerpt — the same two tiers, in the
    // same order, that `buildPlatformPostMetadata` feeds the description tag.
    description: seoText(seo.description) || seoText(source.excerpt),
    image: platformPostOgImage(seo.ogImage, source.coverImage),
    datePublished: source.publishedAt,
    dateModified: source.updatedAt,
    authorName: source.authorName,
    publisherId: organizationJsonLdId(siteUrl),
  };

  const article = buildArticleNode(articleSource);
  if (!article) return [];

  return [
    // `sameAs` is empty because budstacks.io states no social profiles anywhere
    // on the marketing site — there is no footer link to copy, and asserting
    // profiles we have not verified is worse than saying nothing. The builder
    // omits the property entirely for an empty list.
    buildOrganizationNode(siteUrl, PLATFORM_SITE_NAME, PLATFORM_ORGANIZATION_LOGO, []),
    article,
    ...buildBreadcrumbNodes(
      platformCanonical,
      blogPostBreadcrumbTrail(source.title, source.slug),
    ),
  ];
}
