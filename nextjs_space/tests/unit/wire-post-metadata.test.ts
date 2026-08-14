import { describe, it, expect } from "vitest";

// SEO Supercharge US-003 — The Wire consumes posts.seo.
//
// The property this file exists to hold: what an owner types into the SEO
// Manager's post tab is what the article renders, and an article page carries
// the tags a share/crawl actually needs — an article type, a published time, an
// author, a canonical on the primary host. Before this story the column was
// write-only and the page emitted a hand-suffixed title plus an og:image.
//
// The builders are pure by design (`generateMetadata` renders with no error.tsx
// boundary above it), so they are exercised directly — no prisma, no request.
import {
  POST_NOT_FOUND_TITLE,
  WIRE_INDEX_TITLE,
  buildPostMetadata,
  buildWireIndexMetadata,
  wirePostPath,
} from "@/lib/seo/post-metadata";
import { isEmptyEntitySeo, readEntitySeo } from "@/lib/seo/entity-seo";
import { PUBLIC_IMAGE_ROUTE_PREFIX } from "@/lib/storage/public-image-url";

const BUSINESS_NAME = "Acme Cannabis Co";
const CUSTOM_DOMAIN = "acme-cannabis.example";
const CUSTOM_ORIGIN = `https://${CUSTOM_DOMAIN}`;
const CREATED_AT = new Date("2026-03-04T09:30:00.000Z");

const tenantSource = {
  businessName: BUSINESS_NAME,
  subdomain: "acme",
  customDomain: CUSTOM_DOMAIN as string | null,
};

const basePost = {
  slug: "terpenes-explained",
  title: "Terpenes explained",
  excerpt: "What the aroma compounds actually do." as string | null,
  coverImage: null as string | null,
  createdAt: CREATED_AT as unknown,
  seo: null as unknown,
  authorName: "Dr Sam Okonjo" as unknown,
};

function metadata(overrides: Partial<typeof basePost> = {}) {
  return buildPostMetadata({ ...tenantSource, ...basePost, ...overrides });
}

describe("buildPostMetadata — the authored value is what renders", () => {
  it("renders an authored title verbatim, never brand-suffixed", () => {
    // `absolute` bypasses the layout's "%s | {businessName}" template, so the
    // Google preview the SEO Manager shows is the string that ships.
    expect(metadata({ seo: { title: "Why terpenes matter" } }).title).toEqual({
      absolute: "Why terpenes matter",
    });
  });

  it("hands the post title over UNSUFFIXED for the layout template", () => {
    // The regression guard for US-001: this page used to build
    // `"{title} | {businessName}"` itself, and the store layout now stashes a
    // "%s | {businessName}" template for every segment below the homepage — an
    // article rendered "Terpenes explained | Acme Cannabis Co | Acme Cannabis Co".
    const title = metadata().title;

    expect(title).toBe("Terpenes explained");
    expect(String(title)).not.toContain(BUSINESS_NAME);
  });

  it("prefers the authored description, then the excerpt", () => {
    expect(metadata({ seo: { description: " Aroma, not potency " } }).description).toBe(
      "Aroma, not potency",
    );
    expect(metadata().description).toBe(basePost.excerpt);
  });

  it("OMITS description when there is none, so the layout's is inherited", () => {
    // mergeMetadata assigns `target[key] = source[key] || null` for description
    // (resolve-metadata.js:194-205), so a present-but-undefined key would NULL
    // the store description instead of falling through to it.
    const built = metadata({ excerpt: null, seo: null });

    expect(Object.prototype.hasOwnProperty.call(built, "description")).toBe(false);
  });

  it("names the post's author, falling back to the store, never to 'Admin'", () => {
    expect(metadata().authors).toEqual([{ name: "Dr Sam Okonjo" }]);
    expect(metadata().openGraph).toMatchObject({ authors: ["Dr Sam Okonjo"] });

    // "Admin" is the visible byline's UI placeholder, not a name.
    const anonymous = metadata({ authorName: null });
    expect(anonymous.authors).toEqual([{ name: BUSINESS_NAME }]);
    expect(JSON.stringify(anonymous)).not.toContain("Admin");
  });
});

describe("buildPostMetadata — the article tags a share needs", () => {
  it("declares an article with its published time", () => {
    expect(metadata().openGraph).toMatchObject({
      type: "article",
      publishedTime: "2026-03-04T09:30:00.000Z",
      siteName: BUSINESS_NAME,
      locale: "en_US",
      url: `${CUSTOM_ORIGIN}/the-wire/terpenes-explained`,
    });
  });

  it("accepts a createdAt that has been through a JSON round trip", () => {
    expect(
      metadata({ createdAt: "2026-03-04T09:30:00.000Z" }).openGraph,
    ).toMatchObject({ publishedTime: "2026-03-04T09:30:00.000Z" });
  });

  it("drops an unusable createdAt instead of throwing a RangeError", () => {
    // `new Date("last tuesday").toISOString()` throws, and this runs where a
    // throw is a blank page.
    for (const createdAt of ["last tuesday", null, undefined, 0, {}, new Date("nope")]) {
      const built = metadata({ createdAt });
      expect(built.openGraph).not.toHaveProperty("publishedTime");
      expect(built.openGraph).toMatchObject({ type: "article" });
    }
  });

  it("declares the large-image card so the article shares as one", () => {
    // Card type only: postProcessMetadata (:406-442) fills twitter's title,
    // description and images from the resolved openGraph/metadata, which is the
    // only way the card and the page cannot disagree.
    expect(metadata().twitter).toEqual({ card: "summary_large_image" });
    expect(metadata().twitter).not.toHaveProperty("images");
  });

  it("canonicalises to the post URL on the primary host", () => {
    expect(metadata().alternates).toEqual({
      canonical: `${CUSTOM_ORIGIN}/the-wire/terpenes-explained`,
    });

    // Without a custom domain the subdomain IS the primary host.
    const onSubdomain = buildPostMetadata({
      ...tenantSource,
      ...basePost,
      customDomain: null,
    });
    expect(String(onSubdomain.alternates?.canonical)).toContain("/the-wire/terpenes-explained");
    expect(String(onSubdomain.alternates?.canonical)).not.toContain(CUSTOM_DOMAIN);
  });

  it("percent-encodes a slug rather than emitting a URL that will not parse", () => {
    // The query string goes too — a canonical carrying one points at a variant
    // of the page rather than the page.
    expect(String(metadata({ slug: "a post?x=1" }).alternates?.canonical)).toBe(
      `${CUSTOM_ORIGIN}/the-wire/a%20post`,
    );
    expect(wirePostPath("clean-slug")).toBe("/the-wire/clean-slug");
  });

  it("carries no platform string anywhere in the resolved object", () => {
    const serialised = JSON.stringify(metadata());

    for (const platformString of [
      "BudStacks",
      "Medical Cannabis SaaS Platform",
      "Multi-tenant SaaS platform for medical cannabis dispensaries",
    ]) {
      expect(serialised).not.toContain(platformString);
    }
  });
});

describe("buildPostMetadata — og:image fails closed", () => {
  const uploadKey = "development/tenants/tenant-a/uploads/cover.png";

  it("prefers the authored ogImage over the cover image", () => {
    expect(
      metadata({
        seo: { ogImage: "https://cdn.example/authored.png" },
        coverImage: uploadKey,
      }).openGraph,
    ).toMatchObject({ images: ["https://cdn.example/authored.png"] });
  });

  it("serves the cover image through the durable public image route", () => {
    expect(metadata({ coverImage: uploadKey }).openGraph).toMatchObject({
      images: [`${PUBLIC_IMAGE_ROUTE_PREFIX}${uploadKey}`],
    });
  });

  it("drops a presigned cover left over from before Email US-005", () => {
    // Never re-signed here: a tag that 403s an hour after it is minted looks
    // correct and breaks silently.
    const presigned = `https://bucket.s3.eu-west-1.amazonaws.com/${uploadKey}?X-Amz-Signature=deadbeef`;

    expect(metadata({ coverImage: presigned }).openGraph).not.toHaveProperty("images");
    expect(JSON.stringify(metadata({ coverImage: presigned }))).not.toContain("X-Amz");
  });

  it("falls through to the cover when the authored ogImage is unusable", () => {
    const presigned = `https://bucket.s3.eu-west-1.amazonaws.com/${uploadKey}?X-Amz-Signature=deadbeef`;

    expect(
      metadata({ seo: { ogImage: presigned }, coverImage: uploadKey }).openGraph,
    ).toMatchObject({ images: [`${PUBLIC_IMAGE_ROUTE_PREFIX}${uploadKey}`] });
  });

  it("emits no images key at all when there is no durable image", () => {
    expect(metadata().openGraph).not.toHaveProperty("images");
  });
});

describe("buildPostMetadata — a Json column has no shape", () => {
  it("never throws on a malformed posts.seo blob", () => {
    for (const seo of ["nonsense", 42, [], { title: 7 }, { description: {} }, null]) {
      expect(metadata({ seo }).title).toBe("Terpenes explained");
    }
  });

  it("falls back to the shipped 404 wording when even the title is empty", () => {
    expect(metadata({ title: "   " }).title).toBe(POST_NOT_FOUND_TITLE);
  });
});

describe("buildWireIndexMetadata", () => {
  const built = buildWireIndexMetadata(tenantSource);

  it("titles the index for the layout template to suffix", () => {
    expect(built.title).toBe(WIRE_INDEX_TITLE);
    expect(String(built.title)).not.toContain(BUSINESS_NAME);
  });

  it("describes it with the sentence the page itself renders", () => {
    expect(built.description).toBe(
      `Latest news, research updates, and insights from ${BUSINESS_NAME}.`,
    );
  });

  it("canonicalises to /the-wire on the primary host", () => {
    expect(built.alternates).toEqual({ canonical: `${CUSTOM_ORIGIN}/the-wire` });
    expect(built.openGraph).toMatchObject({
      type: "website",
      siteName: BUSINESS_NAME,
      url: `${CUSTOM_ORIGIN}/the-wire`,
    });
  });

  it("falls back to the subdomain when the tenant has no business name", () => {
    const nameless = buildWireIndexMetadata({ ...tenantSource, businessName: "" });

    expect(nameless.description).toContain("acme");
    expect(nameless.openGraph).toMatchObject({ siteName: "acme" });
  });
});

describe("readEntitySeo — the parser both posts.seo and pageSeo share", () => {
  it("keeps non-empty strings and trims them", () => {
    expect(readEntitySeo({ title: "  Hi  ", description: "", ogImage: "k.png" })).toEqual({
      title: "Hi",
      ogImage: "k.png",
    });
  });

  it("drops every value that is not a string", () => {
    expect(readEntitySeo({ title: 7, description: ["a"], ogImage: {} })).toEqual({});
    for (const blob of ["nonsense", 42, [], null, undefined]) {
      expect(readEntitySeo(blob)).toEqual({});
    }
  });

  it("reports an entry with nothing authored as empty", () => {
    expect(isEmptyEntitySeo(readEntitySeo(null))).toBe(true);
    expect(isEmptyEntitySeo(readEntitySeo({ description: "x" }))).toBe(false);
  });
});
