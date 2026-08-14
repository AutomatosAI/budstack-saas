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

  const headline = truncateSeoText(source.title, ARTICLE_HEADLINE_MAX_LENGTH);
  if (!headline) return [];

  const publisherName = storeDisplayName(source.businessName, source.subdomain);
  if (!publisherName) return [];

  const storeUrl = storeCanonical(source, "");
  const url = storeCanonical(source, wirePostPath(source.slug));
  const publisherId = organizationJsonLdId(storeUrl);

  const seo = readEntitySeo(source.seo);
  const description = seoText(seo.description) || seoText(source.excerpt);
  const image = articleImageUrl(storeUrl, source);
  const datePublished = isoTimestamp(source.createdAt);
  const dateModified = isoTimestamp(source.updatedAt);
  const authorName = seoText(source.authorName);

  return [
    buildOrganizationNode(storeUrl, publisherName, source.logoRef),
    {
      "@type": "Article",
      "@id": `${url}#article`,
      headline,
      url,
      ...(description ? { description } : {}),
      ...(image ? { image } : {}),
      ...(datePublished ? { datePublished } : {}),
      ...(dateModified ? { dateModified } : {}),
      // A Person when the post has a real byline. With none, the STORE is the
      // author — expressed as a reference to the publisher node rather than a
      // Person named after the business, which would assert that a company is a
      // human being. (US-003 makes the same substitution for `og:author`, where
      // the tag can only carry a string.)
      author: authorName
        ? { "@type": "Person", name: authorName }
        : { "@id": publisherId },
      publisher: { "@id": publisherId },
    },
  ];
}
