import { describe, it, expect } from "vitest";

// SEO Supercharge US-016 — Article structured data for a Wire post.
//
// The properties this file holds:
//
//  1. THE PUBLISHER REFERENCE RESOLVES. `publisher` is an `@id`, and structured
//     data is parsed per page — so the Organization it names must be in THIS
//     page's graph, under the SAME id the homepage uses. A dangling reference is
//     a publisher with no name, which no validator reports as an error.
//  2. The headline is the post's own title (the <h1>), never the authored SERP
//     title: structured data that contradicts the visible page is penalised.
//  3. Dates survive a JSON round trip and an invalid value degrades to omission
//     — an `Invalid Date` reaching toISOString() is a RangeError inside a render
//     path with no error.tsx boundary above it.
//  4. A Basic tenant emits nothing, and a presigned S3 URL becomes NO image
//     rather than one that 403s a month from now.
import {
  ARTICLE_HEADLINE_MAX_LENGTH,
  buildArticleJsonLd,
  type ArticleJsonLdSource,
} from "@/lib/seo/article-json-ld";
import {
  organizationJsonLdId,
  serializeJsonLd,
  type JsonLdNode,
} from "@/lib/seo/json-ld";
import { PUBLIC_IMAGE_ROUTE_PREFIX } from "@/lib/storage/public-image-url";

/** A custom domain, so expectations never depend on NEXT_PUBLIC_BASE_DOMAIN. */
const CUSTOM_DOMAIN = "acme-cannabis.example";
const STORE_URL = `https://${CUSTOM_DOMAIN}`;
const BUSINESS_NAME = "Acme Cannabis Co";

const POST_SLUG = "cannabis-and-chronic-pain";
const POST_URL = `${STORE_URL}/the-wire/${POST_SLUG}`;
const POST_TITLE = "Cannabis and chronic pain";
const AUTHOR_NAME = "Dr Alex Moreno";

const PUBLISHED_AT = new Date("2026-03-04T09:30:00.000Z");
const UPDATED_AT = new Date("2026-05-19T14:05:00.000Z");

/** Real tenant upload keys — the only shape with a durable public route. */
const COVER_KEY = "development/tenants/tenant-a/uploads/cover.png";
const OG_IMAGE_KEY = "development/tenants/tenant-a/uploads/authored.png";
const LOGO_KEY = "development/tenants/tenant-a/uploads/logo.png";

function source(
  overrides: Partial<ArticleJsonLdSource> = {},
): ArticleJsonLdSource {
  return {
    tenantId: "tenant-a",
    plan: "pro",
    businessName: BUSINESS_NAME,
    subdomain: "acme",
    customDomain: CUSTOM_DOMAIN,
    logoRef: LOGO_KEY,
    socialLinks: [],
    slug: POST_SLUG,
    title: POST_TITLE,
    excerpt: "What the evidence says, and what it does not.",
    coverImage: COVER_KEY,
    createdAt: PUBLISHED_AT,
    updatedAt: UPDATED_AT,
    seo: null,
    authorName: AUTHOR_NAME,
    ...overrides,
  };
}

function nodeOfType(nodes: readonly JsonLdNode[], type: string): JsonLdNode {
  const node = nodes.find((candidate) => candidate["@type"] === type);
  expect(node, `expected a ${type} node`).toBeDefined();
  return node as JsonLdNode;
}

const articleOf = (nodes: readonly JsonLdNode[]) => nodeOfType(nodes, "Article");

describe("buildArticleJsonLd — the plan gate", () => {
  it("emits nothing for a Basic tenant", () => {
    const nodes = buildArticleJsonLd(source({ plan: "basic" }));

    expect(nodes).toEqual([]);
    expect(serializeJsonLd(nodes)).toBeNull();
  });

  it("emits for every plan that includes seo.pro", () => {
    for (const plan of ["trial", "pro", "custom"]) {
      expect(
        buildArticleJsonLd(source({ plan })).length,
        `plan ${plan}`,
      ).toBe(2);
    }
  });

  it("fails closed on an unreadable plan — never a free upgrade", () => {
    for (const plan of [undefined, null, "", "PRO", "enterprise", 169, {}]) {
      expect(
        buildArticleJsonLd(source({ plan })),
        `plan ${String(plan)}`,
      ).toEqual([]);
    }
  });
});

describe("buildArticleJsonLd — the publisher", () => {
  it("carries the Organization it references, under the store-wide @id", () => {
    const nodes = buildArticleJsonLd(source());
    const organization = nodeOfType(nodes, "Organization");
    const article = articleOf(nodes);

    // The id the homepage's Organization also carries — one entity, two pages.
    expect(organization["@id"]).toBe(organizationJsonLdId(STORE_URL));
    expect(organization.name).toBe(BUSINESS_NAME);
    expect(organization.url).toBe(STORE_URL);
    expect(organization.logo).toBe(
      `${STORE_URL}${PUBLIC_IMAGE_ROUTE_PREFIX}${LOGO_KEY}`,
    );

    // The reference resolves INSIDE this page's graph.
    expect(article.publisher).toEqual({ "@id": organization["@id"] });
  });

  it("falls back to the subdomain, and emits no logo it cannot promise", () => {
    const nodes = buildArticleJsonLd(
      source({
        businessName: null,
        // A presigned S3 URL: it dies within the hour, so it is not a logo.
        logoRef:
          "https://bucket.s3.amazonaws.com/logo.png?X-Amz-Signature=deadbeef",
      }),
    );
    const organization = nodeOfType(nodes, "Organization");

    expect(organization.name).toBe("acme");
    expect(organization.logo).toBeUndefined();
  });
});

describe("buildArticleJsonLd — the Article node", () => {
  it("uses the post's own title as the headline, on the canonical URL", () => {
    const article = articleOf(
      // An authored SERP title must NOT become the headline — the headline has
      // to match the <h1> the page renders.
      buildArticleJsonLd(source({ seo: { title: "Chronic pain: the evidence" } })),
    );

    expect(article.headline).toBe(POST_TITLE);
    expect(article["@id"]).toBe(`${POST_URL}#article`);
    expect(article.url).toBe(POST_URL);
  });

  it("clips a long headline at the documented limit, on a word boundary", () => {
    const long = `${"Cannabis prescribing in practice ".repeat(6)}end`;
    const headline = String(
      articleOf(buildArticleJsonLd(source({ title: long }))).headline,
    );

    expect(headline.length).toBeLessThanOrEqual(ARTICLE_HEADLINE_MAX_LENGTH);
    expect(headline.endsWith("…")).toBe(true);
    expect(headline).not.toContain("  ");
  });

  it("emits nothing for a post with no usable title", () => {
    for (const title of [null, undefined, "", "   ", 7]) {
      expect(
        buildArticleJsonLd(source({ title })),
        `title ${String(title)}`,
      ).toEqual([]);
    }
  });

  it("prefers the authored description, then the excerpt", () => {
    expect(
      articleOf(buildArticleJsonLd(source({ seo: { description: "Authored." } })))
        .description,
    ).toBe("Authored.");

    expect(articleOf(buildArticleJsonLd(source())).description).toBe(
      "What the evidence says, and what it does not.",
    );

    expect(
      articleOf(buildArticleJsonLd(source({ excerpt: null }))).description,
    ).toBeUndefined();
  });

  it("prefers the authored image, then the cover, and never a presigned URL", () => {
    expect(
      articleOf(buildArticleJsonLd(source({ seo: { ogImage: OG_IMAGE_KEY } })))
        .image,
    ).toBe(`${STORE_URL}${PUBLIC_IMAGE_ROUTE_PREFIX}${OG_IMAGE_KEY}`);

    expect(articleOf(buildArticleJsonLd(source())).image).toBe(
      `${STORE_URL}${PUBLIC_IMAGE_ROUTE_PREFIX}${COVER_KEY}`,
    );

    expect(
      articleOf(
        buildArticleJsonLd(
          source({
            coverImage:
              "https://bucket.s3.amazonaws.com/c.png?X-Amz-Signature=deadbeef",
          }),
        ),
      ).image,
    ).toBeUndefined();
  });
});

describe("buildArticleJsonLd — dates and author", () => {
  it("publishes createdAt and modifies updatedAt, as ISO-8601", () => {
    const article = articleOf(buildArticleJsonLd(source()));

    expect(article.datePublished).toBe(PUBLISHED_AT.toISOString());
    expect(article.dateModified).toBe(UPDATED_AT.toISOString());
  });

  it("accepts a date that has been through JSON, and drops an unreal one", () => {
    const serialised = articleOf(
      buildArticleJsonLd(
        source({
          createdAt: PUBLISHED_AT.toISOString(),
          updatedAt: UPDATED_AT.toISOString(),
        }),
      ),
    );
    expect(serialised.datePublished).toBe(PUBLISHED_AT.toISOString());
    expect(serialised.dateModified).toBe(UPDATED_AT.toISOString());

    for (const value of ["not a date", "", null, undefined, {}, new Date(NaN)]) {
      const article = articleOf(
        buildArticleJsonLd(source({ createdAt: value, updatedAt: value })),
      );
      expect(article.datePublished, `createdAt ${String(value)}`).toBeUndefined();
      expect(article.dateModified, `updatedAt ${String(value)}`).toBeUndefined();
    }
  });

  it("names the author as a Person", () => {
    expect(articleOf(buildArticleJsonLd(source())).author).toEqual({
      "@type": "Person",
      name: AUTHOR_NAME,
    });
  });

  it("attributes an unbylined post to the publisher, not to a Person", () => {
    const nodes = buildArticleJsonLd(source({ authorName: null }));

    // The store is an organisation; naming a Person after it would assert that
    // a company is a human being.
    expect(articleOf(nodes).author).toEqual({
      "@id": organizationJsonLdId(STORE_URL),
    });
  });
});

describe("buildArticleJsonLd — serialization", () => {
  it("puts both nodes in one @graph that no authored string can break out of", () => {
    const hostile = "</script><script>alert(1)</script>";
    const json = serializeJsonLd(
      buildArticleJsonLd(source({ title: hostile, businessName: hostile })),
    );

    expect(json).not.toBeNull();
    expect(json).not.toContain("<");

    const parsed = JSON.parse(json as string) as {
      "@graph": Record<string, unknown>[];
    };
    expect(parsed["@graph"]).toHaveLength(2);
    // The VALUE survives the escaping — it is the markup that cannot.
    expect(parsed["@graph"][0].name).toBe(hostile);
    expect(parsed["@graph"][1].headline).toBe(hostile);
  });
});
