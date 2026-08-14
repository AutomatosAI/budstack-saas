import { describe, expect, it } from "vitest";

// SEO Supercharge US-018 — the branded OG image.
//
// Three properties this file exists to hold:
//
//  1. THE PLAN GATE IS THE BOUNDARY. `brandedOgImage` returns null for every
//     tenant that is not on seo.pro, including one whose plan could not be
//     read at all, and every builder that consumes it emits nothing at all in
//     that case — a Basic store's head is byte-identical to what it was before
//     this story.
//  2. THE URL AND THE ROUTE AGREE. What the builder emits is what the route
//     parses back, including at the length cap, so a crawler cannot ask for a
//     card the route then refuses to draw.
//  3. THE CARD IS BUILT FROM THE TENANT, NOT THE QUERY. The colour, the name,
//     the host and the monogram all come from the row; only the headline is
//     caller-supplied, and it is bounded on both ends.
//
// Pure modules throughout — no route, no Prisma, no rendering. The PNG itself
// is not asserted here: it is a WASM rasterise, and what could go wrong in it
// (an unparseable colour, an unbounded string) is decided in `og-card.ts` and
// asserted directly.

import {
  OG_CARD_DARK_TEXT,
  OG_CARD_FALLBACK_BRAND,
  OG_CARD_LIGHT_TEXT,
  buildOgCardModel,
  ogCardBrandColor,
  readableTextColor,
  storeInitials,
} from "@/lib/seo/og-card";
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_KINDS,
  OG_IMAGE_KIND_PARAM,
  OG_IMAGE_ROUTE,
  OG_IMAGE_TITLE_MAX_LENGTH,
  OG_IMAGE_TITLE_PARAM,
  OG_IMAGE_WIDTH,
  brandedOgImage,
  brandedOgImageUrl,
  parseOgImageRequest,
} from "@/lib/seo/og-image";
import { buildConditionMetadata } from "@/lib/seo/condition-metadata";
import { buildStorePageMetadata } from "@/lib/seo/page-metadata";
import { buildPostMetadata } from "@/lib/seo/post-metadata";
import { buildProductMetadata } from "@/lib/seo/product-metadata";
import { buildStoreRouteMetadata } from "@/lib/seo/route-metadata";
import { buildStoreMetadata } from "@/lib/seo/store-metadata";

const TENANT_ID = "tenant-og";
const BUSINESS_NAME = "Acme Cannabis Co";
const SUBDOMAIN = "acme";

/** The query string of a built URL, for round-tripping through the parser. */
function queryOf(url: string): URLSearchParams {
  return new URLSearchParams(url.slice(url.indexOf("?") + 1));
}

/** The first `openGraph.images` entry, whatever shape the builder used. */
function firstOgImage(metadata: { openGraph?: unknown }): unknown {
  const openGraph = metadata.openGraph as { images?: unknown[] } | undefined;
  return openGraph?.images?.[0];
}

describe("brandedOgImage — the plan gate", () => {
  it.each(["pro", "trial", "custom"])("emits a card for %s", (plan) => {
    expect(brandedOgImage({ tenantId: TENANT_ID, plan, kind: "store" })).toEqual(
      {
        url: expect.stringContaining(OG_IMAGE_ROUTE),
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
      },
    );
  });

  it.each([
    ["basic", "basic"],
    ["an unknown plan", "enterprise"],
    ["the wrong case", "PRO"],
    ["an empty string", ""],
    ["null", null],
    ["a number", 3],
    ["an object", { plan: "pro" }],
  ])("emits nothing for %s", (_label, plan) => {
    expect(brandedOgImage({ tenantId: TENANT_ID, plan, kind: "store" })).toBeNull();
  });

  it("emits nothing when the plan was never passed — fail closed, not a free upgrade", () => {
    expect(brandedOgImage({ tenantId: TENANT_ID, kind: "store" })).toBeNull();
    expect(brandedOgImage({ kind: "store" })).toBeNull();
  });
});

describe("brandedOgImageUrl — what goes in the query", () => {
  it("is origin-relative, so metadataBase absolutises it against the tenant's own host", () => {
    const url = brandedOgImageUrl({ tenantId: TENANT_ID, plan: "pro", kind: "article" });
    expect(url?.startsWith(`${OG_IMAGE_ROUTE}?`)).toBe(true);
  });

  it("carries the kind, and the title only when there is one", () => {
    const withTitle = brandedOgImageUrl({
      tenantId: TENANT_ID,
      plan: "pro",
      kind: "product",
      title: "Blue Dream",
    });
    expect(queryOf(withTitle!).get(OG_IMAGE_KIND_PARAM)).toBe("product");
    expect(queryOf(withTitle!).get(OG_IMAGE_TITLE_PARAM)).toBe("Blue Dream");

    for (const empty of [undefined, null, "", "   ", 42, {}]) {
      const url = brandedOgImageUrl({
        tenantId: TENANT_ID,
        plan: "pro",
        kind: "product",
        title: empty,
      });
      expect(queryOf(url!).has(OG_IMAGE_TITLE_PARAM)).toBe(false);
    }
  });

  it("truncates the title to the cap the route enforces, so the two can never disagree", () => {
    const url = brandedOgImageUrl({
      tenantId: TENANT_ID,
      plan: "pro",
      kind: "article",
      title: "word ".repeat(80),
    });
    const title = queryOf(url!).get(OG_IMAGE_TITLE_PARAM)!;

    expect(title.length).toBeLessThanOrEqual(OG_IMAGE_TITLE_MAX_LENGTH);
    expect(parseOgImageRequest(queryOf(url!)).title).toBe(title);
  });

  it("round-trips every kind through the parser", () => {
    for (const kind of OG_IMAGE_KINDS) {
      const url = brandedOgImageUrl({
        tenantId: TENANT_ID,
        plan: "pro",
        kind,
        title: "A title with spaces & an ampersand",
      });
      expect(parseOgImageRequest(queryOf(url!))).toEqual({
        kind,
        title: "A title with spaces & an ampersand",
      });
    }
  });
});

describe("parseOgImageRequest — the route's Zod boundary", () => {
  it("defaults to the plain store card when nothing was asked for", () => {
    expect(parseOgImageRequest(new URLSearchParams())).toEqual({
      kind: "store",
      title: "",
    });
  });

  it("falls back to the store card for a kind that is not in the enum", () => {
    const params = new URLSearchParams({
      [OG_IMAGE_KIND_PARAM]: "admin",
      [OG_IMAGE_TITLE_PARAM]: "Anything",
    });
    expect(parseOgImageRequest(params)).toEqual({ kind: "store", title: "" });
  });

  it("refuses a title past the cap rather than drawing it", () => {
    const params = new URLSearchParams({
      [OG_IMAGE_KIND_PARAM]: "article",
      [OG_IMAGE_TITLE_PARAM]: "x".repeat(OG_IMAGE_TITLE_MAX_LENGTH + 1),
    });
    expect(parseOgImageRequest(params)).toEqual({ kind: "store", title: "" });
  });

  it("accepts a title of exactly the cap", () => {
    const title = "x".repeat(OG_IMAGE_TITLE_MAX_LENGTH);
    const params = new URLSearchParams({
      [OG_IMAGE_KIND_PARAM]: "condition",
      [OG_IMAGE_TITLE_PARAM]: title,
    });
    expect(parseOgImageRequest(params)).toEqual({ kind: "condition", title });
  });
});

describe("the card model — everything but the headline comes from the tenant row", () => {
  const source = {
    businessName: BUSINESS_NAME,
    subdomain: SUBDOMAIN,
    customDomain: null,
    brandColor: "#7c3aed",
    kind: "article" as const,
    title: "How medical cannabis is prescribed",
  };

  it("labels the kinds that need one and stays quiet for the rest", () => {
    expect(buildOgCardModel({ ...source, kind: "product" }).label).toBe("PRODUCT");
    expect(buildOgCardModel({ ...source, kind: "article" }).label).toBe("ARTICLE");
    expect(buildOgCardModel({ ...source, kind: "condition" }).label).toBe("CONDITION");
    expect(buildOgCardModel({ ...source, kind: "store" }).label).toBe("");
    expect(buildOgCardModel({ ...source, kind: "page" }).label).toBe("");
  });

  it("falls back to the business name when there is no title, and drops the duplicate footer", () => {
    const model = buildOgCardModel({ ...source, kind: "store", title: "" });
    expect(model.headline).toBe(BUSINESS_NAME);
    expect(model.footerName).toBe("");
  });

  it("keeps the business name in the footer under an entity headline", () => {
    const model = buildOgCardModel(source);
    expect(model.headline).toBe(source.title);
    expect(model.footerName).toBe(BUSINESS_NAME);
  });

  it("prints the primary host — the same one US-007 canonicalises to", () => {
    expect(buildOgCardModel(source).host).toBe(`${SUBDOMAIN}.budstacks.io`);
    expect(
      buildOgCardModel({ ...source, customDomain: "acme-cannabis.example" }).host,
    ).toBe("acme-cannabis.example");
  });

  it("falls back to the subdomain when the row carries no business name", () => {
    const model = buildOgCardModel({ ...source, businessName: "", title: "" });
    expect(model.headline).toBe(SUBDOMAIN);
    expect(model.initials).toBe("A");
  });

  it("monograms up to two words", () => {
    expect(storeInitials("Acme Cannabis Co")).toBe("AC");
    expect(storeInitials("Budstacks")).toBe("B");
    expect(storeInitials("")).toBe("");
  });
});

describe("the card's colours — an owner's value can never break the render", () => {
  it("takes hex straight from tenant_branding.primaryColor", () => {
    expect(ogCardBrandColor("#7c3aed")).toBe("#7c3aed");
    expect(ogCardBrandColor("#abc")).toBe("#abc");
  });

  it("converts the raw HSL channels a template design system stores", () => {
    expect(ogCardBrandColor("275 70% 55%")).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it.each([
    ["a malformed hex", "#zzz"],
    ["a CSS keyword", "rebeccapurple"],
    ["an injection attempt", "red; background-image:url(x)"],
    ["an empty string", ""],
    ["null", null],
    ["a number", 16],
  ])("falls back to the platform brand for %s", (_label, value) => {
    expect(ogCardBrandColor(value)).toBe(OG_CARD_FALLBACK_BRAND);
  });

  it("puts light text on a dark brand and dark text on a pale one", () => {
    expect(readableTextColor("#0b1220")).toBe(OG_CARD_LIGHT_TEXT);
    expect(readableTextColor("#7c3aed")).toBe(OG_CARD_LIGHT_TEXT);
    expect(readableTextColor("#ffffff")).toBe(OG_CARD_DARK_TEXT);
    expect(readableTextColor("#fde68a")).toBe(OG_CARD_DARK_TEXT);
  });

  it("agrees with itself: the model's foreground is the contrast of its background", () => {
    for (const brandColor of ["#ffffff", "#0b1220", "#10b981", "not a colour"]) {
      const model = buildOgCardModel({
        businessName: BUSINESS_NAME,
        subdomain: SUBDOMAIN,
        customDomain: null,
        brandColor,
        kind: "store",
        title: "",
      });
      expect(model.foreground).toBe(readableTextColor(model.background));
    }
  });
});

describe("the metadata cascade — where the card sits in each builder", () => {
  const identity = { tenantId: TENANT_ID, plan: "pro" };
  const tenant = {
    businessName: BUSINESS_NAME,
    subdomain: SUBDOMAIN,
    customDomain: null,
  };

  it("gives a static page the card only when the owner authored no image", () => {
    const authored = buildStorePageMetadata({
      ...tenant,
      ...identity,
      pageKey: "about",
      pageSeo: { about: { ogImage: "https://cdn.example/about.png" } },
    });
    expect(firstOgImage(authored)).toBe("https://cdn.example/about.png");

    const branded = buildStorePageMetadata({
      ...tenant,
      ...identity,
      pageKey: "about",
      pageSeo: {},
    });
    expect(firstOgImage(branded)).toEqual({
      url: expect.stringContaining(`${OG_IMAGE_TITLE_PARAM}=About+Us`),
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
    });
  });

  it("puts the card behind a post's cover image, never in front of it", () => {
    const post = {
      ...tenant,
      ...identity,
      slug: "how-it-works",
      title: "How it works",
      excerpt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      seo: null,
      authorName: null,
    };

    expect(
      firstOgImage(
        buildPostMetadata({ ...post, coverImage: "https://cdn.example/cover.jpg" }),
      ),
    ).toBe("https://cdn.example/cover.jpg");

    expect(firstOgImage(buildPostMetadata({ ...post, coverImage: null }))).toEqual({
      url: expect.stringContaining(`${OG_IMAGE_KIND_PARAM}=article`),
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
    });
  });

  it("puts the card behind a strain photograph, never in front of it", () => {
    const product = {
      ...tenant,
      ...identity,
      productId: "strain-1",
      name: "Blue Dream",
      description: null,
      seo: null,
    };

    expect(
      firstOgImage(
        buildProductMetadata({ ...product, imageUrl: "https://cdn.example/bd.jpg" }),
      ),
    ).toBe("https://cdn.example/bd.jpg");

    expect(
      firstOgImage(buildProductMetadata({ ...product, imageUrl: null })),
    ).toEqual({
      url: expect.stringContaining(`${OG_IMAGE_TITLE_PARAM}=Blue+Dream`),
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
    });
  });

  it("gives a condition page the card when the row carries no image", () => {
    const condition = {
      ...tenant,
      ...identity,
      slug: "chronic-pain",
      name: "Chronic Pain",
      description: null,
      seo: null,
    };

    expect(firstOgImage(buildConditionMetadata({ ...condition, image: null }))).toEqual(
      {
        url: expect.stringContaining(`${OG_IMAGE_KIND_PARAM}=condition`),
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
      },
    );
    expect(
      firstOgImage(
        buildConditionMetadata({ ...condition, image: "https://cdn.example/cp.jpg" }),
      ),
    ).toBe("https://cdn.example/cp.jpg");
  });

  it("gives the un-authorable routes their only preview", () => {
    expect(
      firstOgImage(buildStoreRouteMetadata("howItWorks", { ...tenant, ...identity })),
    ).toEqual({
      url: expect.stringContaining(`${OG_IMAGE_KIND_PARAM}=page`),
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
    });
  });

  it("declares the store card on the layout, which every page inherits until it declares its own", () => {
    expect(
      firstOgImage(
        buildStoreMetadata({
          ...tenant,
          ...identity,
          settings: null,
          faviconRef: null,
        }),
      ),
    ).toEqual({
      url: expect.stringContaining(`${OG_IMAGE_KIND_PARAM}=store`),
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
    });
  });

  it("emits NOTHING anywhere for a Basic tenant — the storefront degrades, never breaks", () => {
    const basic = { tenantId: TENANT_ID, plan: "basic" };

    expect(
      firstOgImage(
        buildStorePageMetadata({ ...tenant, ...basic, pageKey: "about", pageSeo: {} }),
      ),
    ).toBeUndefined();
    expect(
      firstOgImage(
        buildConditionMetadata({
          ...tenant,
          ...basic,
          slug: "chronic-pain",
          name: "Chronic Pain",
          description: null,
          image: null,
          seo: null,
        }),
      ),
    ).toBeUndefined();
    expect(
      firstOgImage(buildStoreRouteMetadata("howItWorks", { ...tenant, ...basic })),
    ).toBeUndefined();
    expect(
      firstOgImage(
        buildStoreMetadata({ ...tenant, ...basic, settings: null, faviconRef: null }),
      ),
    ).toBeUndefined();
  });
});
