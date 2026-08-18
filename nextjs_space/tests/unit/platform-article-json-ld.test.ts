import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * Platform US-018 — Article and BreadcrumbList structured data for one
 * budstacks.io/blog article.
 *
 * Every claim here fails SILENTLY in production: a wrong node still renders,
 * still parses, and simply misdescribes the page to whoever reads it. What is
 * pinned:
 *
 *  1. THE PUBLISHER REFERENCE RESOLVES. `publisher` is an `@id`, and structured
 *     data is parsed per URL — so the Organization it names has to be in THIS
 *     page's graph, under that exact id. A dangling reference is a publisher
 *     with no name, which no validator reports as an error.
 *  2. THE BLOCK AGREES WITH THE TAGS BESIDE IT. The Article's url, image and
 *     headline are the same values `buildPlatformPostMetadata` puts in the
 *     canonical, the og:image and the <h1> — structured data that contradicts
 *     the visible page is the one thing Google penalises outright.
 *  3. `datePublished` IS THE PUBLISHED DATE, not `createdAt`. A post drafted in
 *     June and published in August is an August article to a reader.
 *  4. THE BUILDER IS TOTAL. It runs in a render path with no `error.tsx`
 *     boundary above it, so a malformed `seo` blob, an unparseable date or a
 *     title of whitespace degrades to omission rather than a blank page.
 *  5. NO PLAN GATE. `buildArticleJsonLd` emits nothing for a Basic tenant
 *     because Pro SEO is a thing tenants buy; budstacks.io is not a tenant and
 *     buys nothing from itself.
 */

import {
  PLATFORM_ORGANIZATION_LOGO,
  blogPostBreadcrumbTrail,
  buildPlatformArticleJsonLd,
  platformOrganizationJsonLdId,
  type PlatformArticleJsonLdSource,
} from "@/lib/seo/platform-article-json-ld";
import { BLOG_INDEX_TITLE } from "@/lib/seo/blog-paths";
import { BREADCRUMB_HOME_NAME } from "@/lib/seo/breadcrumb-json-ld";
import { serializeJsonLd, type JsonLdNode } from "@/lib/seo/json-ld";
import {
  PLATFORM_DEFAULT_OG_IMAGE,
  PLATFORM_SITE_NAME,
  buildPlatformPostMetadata,
} from "@/lib/seo/platform-post-metadata";
import { platformBaseUrl, platformCanonical } from "@/lib/seo/platform-url";
import { PUBLIC_IMAGE_ROUTE_PREFIX } from "@/lib/storage/public-image-url";

const POST_SLUG = "wordpress-or-budstacks-cannabis-storefront";
const POST_TITLE = "Should You Build Your Cannabis Storefront on WordPress?";
const AUTHOR_NAME = "BudStacks";

const PUBLISHED_AT = new Date("2026-08-15T09:00:00.000Z");
const UPDATED_AT = new Date("2026-08-16T11:30:00.000Z");

/** A real platform upload key — the only bare-key shape with a durable route. */
const COVER_KEY = "development/platform/uploads/cover.png";

function source(
  overrides: Partial<PlatformArticleJsonLdSource> = {},
): PlatformArticleJsonLdSource {
  return {
    slug: POST_SLUG,
    title: POST_TITLE,
    excerpt: "The honest comparison, including the parts that do not flatter us.",
    coverImage: COVER_KEY,
    authorName: AUTHOR_NAME,
    publishedAt: PUBLISHED_AT,
    updatedAt: UPDATED_AT,
    seo: null,
    ...overrides,
  };
}

function nodeOfType(nodes: readonly JsonLdNode[], type: string): JsonLdNode {
  const node = nodes.find((candidate) => candidate["@type"] === type);
  expect(node, `expected a ${type} node`).toBeDefined();
  return node as JsonLdNode;
}

const articleOf = (nodes: readonly JsonLdNode[]) => nodeOfType(nodes, "Article");
const orgOf = (nodes: readonly JsonLdNode[]) =>
  nodeOfType(nodes, "Organization");
const crumbsOf = (nodes: readonly JsonLdNode[]) =>
  nodeOfType(nodes, "BreadcrumbList").itemListElement as Record<
    string,
    unknown
  >[];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildPlatformArticleJsonLd — the graph", () => {
  it("emits Organization, Article and BreadcrumbList in one block", () => {
    const nodes = buildPlatformArticleJsonLd(source());

    expect(nodes.map((node) => node["@type"])).toEqual([
      "Organization",
      "Article",
      "BreadcrumbList",
    ]);
    // Several nodes go in an @graph, which is what lets them reference each
    // other by @id from one script element.
    expect(serializeJsonLd(nodes)).toContain('"@graph"');
  });

  it("emits nothing at all when the post has no usable title", () => {
    for (const title of ["", "   "]) {
      const nodes = buildPlatformArticleJsonLd(source({ title }));

      expect(nodes).toEqual([]);
      // An empty array is what <JsonLd> renders as no element — an empty
      // <script type="application/ld+json"></script> is a parse error.
      expect(serializeJsonLd(nodes)).toBeNull();
    }
  });

  it("applies no plan gate — the platform is not a tenant", () => {
    // The tenant builder returns [] for anything but Pro. There is no equivalent
    // input here, and this asserts the omission is deliberate rather than a
    // field somebody forgot to thread through.
    expect(buildPlatformArticleJsonLd(source()).length).toBe(3);
  });
});

describe("buildPlatformArticleJsonLd — the publisher", () => {
  it("states the Organization the Article's publisher points at", () => {
    const nodes = buildPlatformArticleJsonLd(source());
    const organization = orgOf(nodes);

    expect(organization["@id"]).toBe(platformOrganizationJsonLdId());
    expect(organization.name).toBe(PLATFORM_SITE_NAME);
    expect(organization.url).toBe(platformBaseUrl());
    // The reference resolves INSIDE this page's graph.
    expect(articleOf(nodes).publisher).toEqual({
      "@id": organization["@id"],
    });
  });

  it("carries the wordmark the marketing nav renders, absolutised", () => {
    expect(orgOf(buildPlatformArticleJsonLd(source())).logo).toBe(
      `${platformBaseUrl()}${PLATFORM_ORGANIZATION_LOGO}`,
    );
  });

  it("asserts no social profiles, rather than an empty list of them", () => {
    // `sameAs: []` is a positive claim that this entity has no presence
    // anywhere, which is worse than silence.
    expect(orgOf(buildPlatformArticleJsonLd(source()))).not.toHaveProperty(
      "sameAs",
    );
  });

  it("follows the container's origin rather than a baked-in host", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.budstacks.io");

    const nodes = buildPlatformArticleJsonLd(source());

    expect(orgOf(nodes).url).toBe("https://staging.budstacks.io");
    expect(articleOf(nodes).url).toBe(
      `https://staging.budstacks.io/blog/${POST_SLUG}`,
    );
  });
});

describe("buildPlatformArticleJsonLd — the Article node", () => {
  it("is addressed at the same URL the page declares canonical", () => {
    const article = articleOf(buildPlatformArticleJsonLd(source()));
    const canonical = platformCanonical(`/blog/${POST_SLUG}`);

    expect(article.url).toBe(canonical);
    expect(article["@id"]).toBe(`${canonical}#article`);
    expect(buildPlatformPostMetadata(source()).alternates?.canonical).toBe(
      canonical,
    );
  });

  it("uses the post's own title as the headline, never the authored SEO one", () => {
    const article = articleOf(
      buildPlatformArticleJsonLd(
        source({ seo: { title: "Cannabis storefronts compared | BudStacks" } }),
      ),
    );

    // The headline has to match the <h1> the page renders; the authored one is
    // the SERP title and is asserted on the metadata side.
    expect(article.headline).toBe(POST_TITLE);
  });

  it("clips a long headline to the documented budget", () => {
    const headline = articleOf(
      buildPlatformArticleJsonLd(source({ title: "Cannabis ".repeat(40) })),
    ).headline as string;

    expect(headline.length).toBeLessThanOrEqual(110);
  });

  it("prefers the authored description, then the excerpt", () => {
    expect(
      articleOf(
        buildPlatformArticleJsonLd(
          source({ seo: { description: "Authored." } }),
        ),
      ).description,
    ).toBe("Authored.");

    expect(articleOf(buildPlatformArticleJsonLd(source())).description).toBe(
      "The honest comparison, including the parts that do not flatter us.",
    );

    // Omitted rather than emitted empty when there is nothing to say.
    expect(
      articleOf(buildPlatformArticleJsonLd(source({ excerpt: null }))),
    ).not.toHaveProperty("description");
  });

  it("shows the same image the og:image tag shows", () => {
    const post = source();
    const article = articleOf(buildPlatformArticleJsonLd(post));
    const ogImages = buildPlatformPostMetadata(post).openGraph?.images;

    expect(article.image).toBe(
      `${platformBaseUrl()}${PUBLIC_IMAGE_ROUTE_PREFIX}development/platform/uploads/cover.png`,
    );
    expect(String((ogImages as unknown[])[0])).toBe(article.image);
  });

  it("falls back to the platform hero for a post with no cover", () => {
    expect(
      articleOf(buildPlatformArticleJsonLd(source({ coverImage: null }))).image,
    ).toBe(`${platformBaseUrl()}${PLATFORM_DEFAULT_OG_IMAGE}`);
  });

  it("refuses a presigned S3 cover rather than publishing a link that 403s", () => {
    const article = articleOf(
      buildPlatformArticleJsonLd(
        source({
          coverImage:
            "https://bucket.s3.amazonaws.com/cover.png?X-Amz-Signature=abc",
        }),
      ),
    );

    expect(article.image).toBe(
      `${platformBaseUrl()}${PLATFORM_DEFAULT_OG_IMAGE}`,
    );
  });
});

describe("buildPlatformArticleJsonLd — dates and author", () => {
  it("publishes publishedAt and updatedAt as ISO timestamps", () => {
    const article = articleOf(buildPlatformArticleJsonLd(source()));

    expect(article.datePublished).toBe(PUBLISHED_AT.toISOString());
    expect(article.dateModified).toBe(UPDATED_AT.toISOString());
  });

  it("survives dates that arrived as strings", () => {
    const article = articleOf(
      buildPlatformArticleJsonLd(
        source({
          publishedAt: PUBLISHED_AT.toISOString(),
          updatedAt: UPDATED_AT.toISOString(),
        }),
      ),
    );

    expect(article.datePublished).toBe(PUBLISHED_AT.toISOString());
    expect(article.dateModified).toBe(UPDATED_AT.toISOString());
  });

  it("omits a date it cannot parse instead of throwing", () => {
    for (const value of ["", "not a date", null, undefined, {}, NaN]) {
      const article = articleOf(
        buildPlatformArticleJsonLd(
          source({ publishedAt: value, updatedAt: value }),
        ),
      );

      expect(article).not.toHaveProperty("datePublished");
      expect(article).not.toHaveProperty("dateModified");
    }
  });

  it("names the byline as a Person", () => {
    expect(articleOf(buildPlatformArticleJsonLd(source())).author).toEqual({
      "@type": "Person",
      name: AUTHOR_NAME,
    });
  });

  it("credits the publisher, not a Person, when there is no byline", () => {
    // Every row has an authorName — the column is NOT NULL — so this is the
    // defensive path. A Person named after an organisation would assert that a
    // company is a human being.
    const nodes = buildPlatformArticleJsonLd(source({ authorName: "   " }));

    expect(articleOf(nodes).author).toEqual({
      "@id": platformOrganizationJsonLdId(),
    });
  });
});

describe("buildPlatformArticleJsonLd — the breadcrumb trail", () => {
  it("reads Home > Blog > post, in order, on the platform's own host", () => {
    const items = crumbsOf(buildPlatformArticleJsonLd(source()));

    expect(items).toEqual([
      {
        "@type": "ListItem",
        position: 1,
        name: BREADCRUMB_HOME_NAME,
        item: platformBaseUrl(),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: BLOG_INDEX_TITLE,
        item: `${platformBaseUrl()}/blog`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: POST_TITLE,
        item: `${platformBaseUrl()}/blog/${POST_SLUG}`,
      },
    ]);
  });

  it("anchors the list to the page it ends on", () => {
    const list = nodeOfType(
      buildPlatformArticleJsonLd(source()),
      "BreadcrumbList",
    );

    expect(list["@id"]).toBe(
      `${platformCanonical(`/blog/${POST_SLUG}`)}#breadcrumb`,
    );
  });

  it("names the blog the way the marketing nav names it", () => {
    const trail = blogPostBreadcrumbTrail(POST_TITLE, POST_SLUG);

    expect(trail.map((item) => item.path)).toEqual([
      "/blog",
      `/blog/${POST_SLUG}`,
    ]);
    expect(trail[0].name).toBe("Blog");
  });
});

describe("buildPlatformArticleJsonLd — serialization", () => {
  it("cannot break out of the script element", () => {
    const hostile = '</script><script>alert(1)</script>';
    const json = serializeJsonLd(
      buildPlatformArticleJsonLd(
        source({ title: hostile, excerpt: hostile, authorName: hostile }),
      ),
    );

    expect(json).not.toBeNull();
    expect(json).not.toContain("<");
    expect(json).not.toContain(">");
  });
});
