import { describe, it, expect } from "vitest";

// SEO Supercharge US-004 — product pages consume products.seo.
//
// The properties this file exists to hold:
//  1. A product page carries the store's own metadata, not the platform's, and
//     what the owner typed into the SEO Manager is what it renders.
//  2. A product URL is keyed by the DR GREEN STRAIN ID. `products.slug` is a
//     sync-upsert key, not a route — the admin previewed `/products/{slug}` for
//     every product and every one of those URLs 404s.
//  3. A derived description is clipped where WE choose, not where the SERP cuts.
//
// The builders are pure by design (`generateMetadata` renders with no error.tsx
// boundary above it), so they are exercised directly — no prisma, no Dr Green.
import {
  PRODUCT_NOT_FOUND_TITLE,
  buildProductMetadata,
} from "@/lib/seo/product-metadata";
import { PRODUCTS_INDEX_PATH, productPath } from "@/lib/seo/product-paths";
import {
  SEO_DESCRIPTION_MAX_LENGTH,
  truncateSeoText,
} from "@/lib/seo/store-identity";
import { PUBLIC_IMAGE_ROUTE_PREFIX } from "@/lib/storage/public-image-url";

const BUSINESS_NAME = "Acme Cannabis Co";
const SUBDOMAIN = "acme";
const CUSTOM_DOMAIN = "acme-cannabis.example";
const CUSTOM_ORIGIN = `https://${CUSTOM_DOMAIN}`;
const STRAIN_ID = "b6f0a1c2-8d34-4e57-9a1b-2c3d4e5f6a7b";
const DR_GREEN_IMAGE = "https://cdn.drgreen.example/strains/blue-dream.jpg";

const baseSource = {
  businessName: BUSINESS_NAME,
  subdomain: SUBDOMAIN,
  customDomain: CUSTOM_DOMAIN as string | null,
  productId: STRAIN_ID,
  name: "Blue Dream" as unknown,
  description: "A sativa-dominant hybrid." as unknown,
  imageUrl: DR_GREEN_IMAGE as unknown,
  seo: null as unknown,
};

function metadata(overrides: Partial<typeof baseSource> = {}) {
  return buildProductMetadata({ ...baseSource, ...overrides });
}

describe("productPath — the URL a product page actually has", () => {
  it("keys the path on the Dr Green strain id", () => {
    // product-card.tsx:59 links `/products/{product.id}`, and the API resolves
    // it as `fetchProducts(...).find(p => p.id === productId)`
    // (app/api/store/[slug]/products/route.ts:53-55).
    expect(productPath(STRAIN_ID)).toBe(`/products/${STRAIN_ID}`);
  });

  it("falls back to the listing for a row that was never synced", () => {
    // A local product with no strain id has no page of its own; the listing is
    // a live URL, and a dead `/products/null` would be the same defect again.
    expect(productPath(null)).toBe(PRODUCTS_INDEX_PATH);
    expect(productPath(undefined)).toBe(PRODUCTS_INDEX_PATH);
    expect(productPath("   ")).toBe(PRODUCTS_INDEX_PATH);
    expect(productPath(42)).toBe(PRODUCTS_INDEX_PATH);
  });
});

describe("truncateSeoText — a derived description we control the end of", () => {
  it("leaves a short description exactly as written", () => {
    expect(truncateSeoText("A sativa-dominant hybrid.")).toBe(
      "A sativa-dominant hybrid.",
    );
  });

  it("collapses the newlines strain copy arrives with", () => {
    // Dr Green descriptions carry line breaks; inside a meta tag they render as
    // literal gaps in the search snippet.
    expect(truncateSeoText("Line one.\n\n  Line two.\t Line three.")).toBe(
      "Line one. Line two. Line three.",
    );
  });

  it("clips at a word boundary and stays INSIDE the budget", () => {
    const long = "word ".repeat(80).trim();
    const result = truncateSeoText(long);

    expect(result.length).toBeLessThanOrEqual(SEO_DESCRIPTION_MAX_LENGTH);
    expect(result.endsWith("…")).toBe(true);
    // The ellipsis follows a whole word, never half of one.
    expect(result).not.toMatch(/wor…$/);
  });

  it("hard-cuts a single word longer than the budget", () => {
    const result = truncateSeoText("z".repeat(400));

    expect(result.length).toBe(SEO_DESCRIPTION_MAX_LENGTH);
    expect(result.endsWith("…")).toBe(true);
  });

  it("returns '' for anything that is not usable text", () => {
    expect(truncateSeoText(null)).toBe("");
    expect(truncateSeoText(undefined)).toBe("");
    expect(truncateSeoText({ description: "nope" })).toBe("");
    expect(truncateSeoText("   ")).toBe("");
  });
});

describe("buildProductMetadata — the authored value is what renders", () => {
  it("renders an authored title verbatim, never brand-suffixed", () => {
    // `absolute` bypasses the layout's "%s | {businessName}" template, so the
    // Google preview the SEO Manager shows is the string that ships.
    expect(metadata({ seo: { title: "Blue Dream — 22% THC" } }).title).toEqual({
      absolute: "Blue Dream — 22% THC",
    });
  });

  it("hands the strain name over UNSUFFIXED for the layout template", () => {
    const title = metadata().title;

    expect(title).toBe("Blue Dream");
    expect(String(title)).not.toContain(BUSINESS_NAME);
  });

  it("titles a nameless strain rather than rendering an empty <title>", () => {
    expect(metadata({ name: null }).title).toBe(PRODUCT_NOT_FOUND_TITLE);
    expect(metadata({ name: "   " }).title).toBe(PRODUCT_NOT_FOUND_TITLE);
  });

  it("prefers the authored description, then the truncated strain copy", () => {
    expect(
      metadata({ seo: { description: " Our best seller " } }).description,
    ).toBe("Our best seller");
    expect(metadata().description).toBe("A sativa-dominant hybrid.");
  });

  it("does NOT truncate an authored description", () => {
    // The owner previewed that exact string; the write route already caps it.
    const authored = "x".repeat(SEO_DESCRIPTION_MAX_LENGTH + 40);

    expect(metadata({ seo: { description: authored } }).description).toBe(
      authored,
    );
  });

  it("truncates long strain copy", () => {
    const built = metadata({ description: "cannabis ".repeat(60) });

    expect(String(built.description).length).toBeLessThanOrEqual(
      SEO_DESCRIPTION_MAX_LENGTH,
    );
  });

  it("OMITS description when there is none, so the layout's is inherited", () => {
    // mergeMetadata assigns `target[key] = source[key] || null` for description
    // (resolve-metadata.js:194-205), so a present-but-undefined key would NULL
    // the store description instead of falling through to it.
    const built = metadata({ description: null, seo: null });

    expect("description" in built).toBe(false);
  });

  it("survives a products.seo blob of the wrong shape", () => {
    // The column is Prisma `Json?` with no DB-level shape. A throw inside
    // generateMetadata is a blank page, not a missing tag.
    for (const seo of [42, "a string", [], { title: 7, description: {} }]) {
      const built = metadata({ seo });

      expect(built.title).toBe("Blue Dream");
      expect(built.description).toBe("A sativa-dominant hybrid.");
    }
  });
});

describe("buildProductMetadata — canonical on the primary host", () => {
  it("points at the id route on the custom domain when there is one", () => {
    const built = metadata();

    expect(built.alternates?.canonical).toBe(
      `${CUSTOM_ORIGIN}/products/${STRAIN_ID}`,
    );
    // og:url and the canonical are the same string — a page that disagrees with
    // itself is worse than a page with neither.
    expect(built.openGraph?.url).toBe(built.alternates?.canonical);
  });

  it("falls back to the subdomain host with no custom domain", () => {
    const canonical = String(
      metadata({ customDomain: null }).alternates?.canonical,
    );

    expect(canonical).toContain(SUBDOMAIN);
    expect(canonical).toContain(`/products/${STRAIN_ID}`);
    expect(canonical).not.toContain(CUSTOM_DOMAIN);
  });

  it("percent-encodes an id that is not URL-safe", () => {
    const canonical = String(
      metadata({ productId: "blue dream/22%" }).alternates?.canonical,
    );

    expect(canonical.startsWith(CUSTOM_ORIGIN)).toBe(true);
    expect(canonical).not.toContain(" ");
  });
});

describe("buildProductMetadata — og:image cascade", () => {
  it("prefers an authored ogImage over the strain image", () => {
    const key = "development/tenants/t1/uploads/og/blue-dream.png";
    const built = metadata({ seo: { ogImage: key } });

    expect(built.openGraph?.images).toEqual([
      expect.stringContaining(PUBLIC_IMAGE_ROUTE_PREFIX),
    ]);
  });

  it("falls back to the live strain image, absolute as Dr Green serves it", () => {
    expect(metadata().openGraph?.images).toEqual([DR_GREEN_IMAGE]);
  });

  it("DROPS a presigned S3 URL rather than emitting a tag that expires", () => {
    const presigned = `${DR_GREEN_IMAGE}?X-Amz-Signature=deadbeef&X-Amz-Expires=3600`;
    const built = metadata({ imageUrl: presigned, seo: null });

    expect(built.openGraph?.images).toBeUndefined();
  });

  it("emits no images key at all when there is no usable image", () => {
    expect(metadata({ imageUrl: null }).openGraph?.images).toBeUndefined();
    expect(metadata({ imageUrl: 12345 }).openGraph?.images).toBeUndefined();
  });
});

describe("buildProductMetadata — the tags the store layout must not lose", () => {
  it("re-declares og:site_name, because openGraph is replaced not merged", () => {
    // resolve-metadata.js:145 — the deepest segment that declares openGraph
    // REPLACES the parent's wholesale. Dropping siteName here would strip it
    // from exactly the pages this story is fixing.
    expect(metadata().openGraph?.siteName).toBe(BUSINESS_NAME);
  });

  it("names the store by subdomain when the business name is blank", () => {
    expect(metadata({ businessName: "" }).openGraph?.siteName).toBe(SUBDOMAIN);
  });

  it("declares the large-image twitter card, and nothing else", () => {
    // Card type only: Next's postProcessMetadata fills twitter's title,
    // description and images from the resolved openGraph, which is the only way
    // the card and the page agree.
    expect(metadata().twitter).toEqual({ card: "summary_large_image" });
  });

  it("uses og:type website — the product signal is JSON-LD (US-015)", () => {
    // `OpenGraph` is a discriminated union on `type` and Next 14 has no product
    // member, so the assertion reads the property off the built object.
    expect(metadata().openGraph).toMatchObject({ type: "website" });
  });
});
