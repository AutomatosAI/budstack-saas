/**
 * SEO Supercharge US-016 — Article structured data for a Wire post.
 *
 * THE GAP THIS CLOSES: US-003 gave articles a title, a description, an
 * `og:type: article` and a published time — everything a link preview needs, and
 * none of what a news or article rich result reads. Publication date, author and
 * publisher reach a search surface only through an `Article` node.
 *
 * WHY THE ORGANIZATION NODE IS RESTATED HERE. `publisher` is an `@id` reference
 * to the store's Organization, and structured data is parsed PER PAGE: a
 * reference to a node declared on the homepage hands a consumer reading THIS URL
 * a publisher with no name at all (the rule US-015 wrote down for Product
 * `brand`). So the article's graph carries the Organization itself, built by the
 * same `buildOrganizationNode` the homepage uses, under the same `@id`. Two
 * pages, one entity, one statement of it.
 *
 * WHERE EACH FIELD COMES FROM:
 *  - headline — the post's OWN title, never the authored `seo.title`. The
 *    authored one is the SERP title; the headline must match the `<h1>` the page
 *    renders (the-wire/[postSlug]/page.tsx:144), because structured data that
 *    disagrees with the visible page is the one thing Google penalises outright.
 *  - image, description — the same cascades US-003 feeds `og:image` and
 *    `<meta name="description">`, so the block and the tags beside it agree.
 *  - datePublished / dateModified — `posts.createdAt` / `posts.updatedAt`,
 *    through the SAME `isoTimestamp` parser the og tags use.
 *  - author — `posts.users.name`, the byline the article itself renders.
 *
 * Pro-gated by DEGRADING, and pure and total, like every builder here: a Basic
 * tenant emits nothing, and a render path with no `error.tsx` boundary above it
 * gets omission rather than a throw.
 */

import { storeCanonical } from "@/lib/seo/canonical";
import { readEntitySeo } from "@/lib/seo/entity-seo";
import {
  absoluteAssetUrl,
  buildOrganizationNode,
  organizationJsonLdId,
  type JsonLdNode,
} from "@/lib/seo/json-ld";
import { isoTimestamp, wirePostPath } from "@/lib/seo/post-metadata";
import { isSeoProUnlocked } from "@/lib/seo/pro-features";
import {
  seoText,
  storeDisplayName,
  truncateSeoText,
} from "@/lib/seo/store-identity";

/**
 * How long an Article `headline` may be. Google documents 110 characters and
 * warns above it, so a long title is clipped at a word boundary here rather than
 * cut mid-word by whatever surface renders it. `truncateSeoText` keeps the
 * ellipsis inside the budget, so the result never exceeds the limit.
 */
export const ARTICLE_HEADLINE_MAX_LENGTH = 110;

/**
 * Platform US-018 — everything an `Article` node needs once the CALLER has
 * decided what a title, an image and a publisher mean for its site.
 *
 * The fields are already-resolved values rather than the row they came from:
 * `buildArticleJsonLd` below cascades them the tenant way (authored `seo`, then
 * the post, through `storeCanonical` and a plan gate) and
 * `buildPlatformArticleJsonLd` cascades them the budstacks.io way (through
 * `platformCanonical`, no plan gate, the platform's own hero as the last-resort
 * image). What must NOT differ between the two is the node itself — the
 * headline budget, the author substitution, the `@id` fragment and which
 * properties are omitted rather than emitted empty — so that lives here once.
 */
export interface ArticleNodeSource {
  /** Canonical URL of the article; the node's `url` and `@id` are built from it. */
  readonly url: string;
  /** The article's OWN title, clipped to {@link ARTICLE_HEADLINE_MAX_LENGTH}. */
  readonly title: unknown;
  /** Already cascaded by the caller — authored description, then excerpt. */
  readonly description: unknown;
  /** Absolute image URL, or null when none resolved. Never a relative path. */
  readonly image: string | null;
  /** Parsed by `isoTimestamp` here: a Date from Prisma, a string once serialised. */
  readonly datePublished: unknown;
  readonly dateModified: unknown;
  /** The byline the article renders; falls back to the publisher — see below. */
  readonly authorName: unknown;
  /** `@id` of the Organization node the caller emits alongside this one. */
  readonly publisherId: string;
}

/**
 * The `Article` node itself, or null when the post has no usable title.
 *
 * Null rather than a partial node: an Article without a `headline` is invalid,
 * not smaller, and every caller answers that by emitting no structured data at
 * all rather than a block a validator rejects.
 *
 * The headline is the post's OWN title, never an authored `seo.title`. The
 * authored one is the SERP title; the headline must match the `<h1>` the page
 * renders, because structured data that disagrees with the visible page is the
 * one thing Google penalises outright.
 */
export function buildArticleNode(source: ArticleNodeSource): JsonLdNode | null {
  const headline = truncateSeoText(source.title, ARTICLE_HEADLINE_MAX_LENGTH);
  if (!headline) return null;

  const description = seoText(source.description);
  const datePublished = isoTimestamp(source.datePublished);
  const dateModified = isoTimestamp(source.dateModified);
  const authorName = seoText(source.authorName);

  return {
    "@type": "Article",
    "@id": `${source.url}#article`,
    headline,
    url: source.url,
    ...(description ? { description } : {}),
    ...(source.image ? { image: source.image } : {}),
    ...(datePublished ? { datePublished } : {}),
    ...(dateModified ? { dateModified } : {}),
    // A Person when the post has a real byline. With none, the SITE is the
    // author — expressed as a reference to the publisher node rather than a
    // Person named after an organisation, which would assert that a company is
    // a human being. (US-003 makes the same substitution for `og:author`, where
    // the tag can only carry a string.)
    author: authorName
      ? { "@type": "Person", name: authorName }
      : { "@id": source.publisherId },
    publisher: { "@id": source.publisherId },
  };
}

export interface ArticleJsonLdSource {
  /** `tenants.id` — the plan gate's subject. */
  readonly tenantId: string;
  /** Raw `tenants.plan`; parsed fail-closed by the gate. */
  readonly plan: unknown;
  readonly businessName: unknown;
  readonly subdomain: string;
  readonly customDomain: string | null;
  /** Stored logo reference for the publisher — see `lib/seo/tenant-logo.ts`. */
  readonly logoRef: string | null;
  /**
   * US-006 — the publisher's profiles elsewhere, resolved through
   * `lib/seo/tenant-social-links.ts`. Carried for the same reason `logoRef` is:
   * this page states the Organization under the homepage's `@id`, so it must
   * state the SAME entity, not a thinner copy of it.
   */
  readonly socialLinks: readonly string[];
  readonly slug: string;
  readonly title: unknown;
  readonly excerpt: unknown;
  /** Stored cover reference — an S3 key, a path or a URL, never re-signed here. */
  readonly coverImage: unknown;
  /** `posts.createdAt`; a Date from Prisma, a string once serialised. */
  readonly createdAt: unknown;
  /** `posts.updatedAt`, same treatment. */
  readonly updatedAt: unknown;
  /** Raw `posts.seo` Json — parsed here, never trusted. */
  readonly seo: unknown;
  /** `posts.users.name`, the byline the article renders. */
  readonly authorName: unknown;
}

/**
 * The article's image as an absolute URL, or null.
 *
 * US-003's `og:image` cascade exactly — authored override, then the post's cover
 * — and the same fail-closed rule: a presigned S3 URL resolves to NOTHING rather
 * than to a link that 403s an hour after it is minted. Absolute because JSON-LD
 * is read out of band by a crawler with no page to resolve a relative reference
 * against.
 */
function articleImageUrl(
  storeUrl: string,
  source: ArticleJsonLdSource,
): string | null {
  const seo = readEntitySeo(source.seo);
  return (
    absoluteAssetUrl(storeUrl, seo.ogImage ?? null) ??
    absoluteAssetUrl(storeUrl, seoText(source.coverImage) || null)
  );
}

/**
 * The Organization that published the article, and the Article itself — or an
 * empty array.
 *
 * Empty for three ordinary states: the tenant is not on Pro; the post has no
 * usable title (an Article without a `headline` is invalid, not partial); or the
 * tenant has neither business name nor subdomain to publish under.
 */
export function buildArticleJsonLd(
  source: ArticleJsonLdSource,
): readonly JsonLdNode[] {
  if (!isSeoProUnlocked({ id: source.tenantId, plan: source.plan })) return [];

  const publisherName = storeDisplayName(source.businessName, source.subdomain);
  if (!publisherName) return [];

  const storeUrl = storeCanonical(source, "");
  const seo = readEntitySeo(source.seo);

  // The node shape is `buildArticleNode`'s (US-018 shares it with the platform
  // blog); everything passed to it is the TENANT cascade — authored `seo` first,
  // then the post's own fields, resolved against the store's primary host.
  const article = buildArticleNode({
    url: storeCanonical(source, wirePostPath(source.slug)),
    title: source.title,
    description: seoText(seo.description) || seoText(source.excerpt),
    image: articleImageUrl(storeUrl, source),
    datePublished: source.createdAt,
    dateModified: source.updatedAt,
    authorName: source.authorName,
    publisherId: organizationJsonLdId(storeUrl),
  });
  if (!article) return [];

  return [
    buildOrganizationNode(
      storeUrl,
      publisherName,
      source.logoRef,
      source.socialLinks,
    ),
    article,
  ];
}
