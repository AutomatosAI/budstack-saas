import { describe, it, expect } from "vitest";

// SEO Supercharge US-001 — the storefront metadata foundation.
//
// The property this file exists to hold: NO store page can fall through to
// `app/layout.tsx` and title itself with the platform's brand. That was true of
// every store page except the homepage before this metadata existed, and it is
// the single largest indexed-quality defect in docs/SEO-SYSTEM-REVIEW.md.
//
// The builder is pure on purpose — `generateMetadata` renders with no error.tsx
// boundary above it, so the second property asserted here is that no malformed
// input (a junk settings blob, an unparseable custom domain, an expiring asset
// URL) can throw or emit a tag that breaks later.
import {
  PLATFORM_FAVICON,
  buildStoreMetadata,
  type StoreMetadataSource,
} from "@/lib/seo/store-metadata";
import { PUBLIC_IMAGE_ROUTE_PREFIX } from "@/lib/storage/public-image-url";

/** Every string app/layout.tsx would have leaked onto a tenant's pages. */
const PLATFORM_STRINGS = [
  "BudStacks",
  "Medical Cannabis SaaS Platform",
  "Multi-tenant SaaS platform for medical cannabis dispensaries",
  "budstacks.io",
];

const BUSINESS_NAME = "Acme Cannabis Co";

/** A custom domain, so expectations do not depend on NEXT_PUBLIC_BASE_DOMAIN. */
const CUSTOM_DOMAIN = "acme-cannabis.example";

function source(
  overrides: Partial<StoreMetadataSource> = {},
): StoreMetadataSource {
  return {
    tenantId: "tenant-a",
    businessName: BUSINESS_NAME,
    subdomain: "acme",
    customDomain: CUSTOM_DOMAIN,
    settings: null,
    faviconRef: null,
    ...overrides,
  };
}

describe("buildStoreMetadata — the platform brand cannot leak", () => {
  it("titles every deeper page '%s | {businessName}' and defaults to the business", () => {
    const metadata = buildStoreMetadata(source());

    // Next stashes `template` for deeper segments only (the store homepage sits
    // at metadataItems.length - 2 and is skipped), so this suffixes /products,
    // /the-wire/... and leaves the homepage's own title verbatim.
    expect(metadata.title).toEqual({
      template: `%s | ${BUSINESS_NAME}`,
      default: BUSINESS_NAME,
    });
  });

  it("carries no platform string anywhere in the resolved object", () => {
    // The whole story in one assertion: whatever a page fails to declare, what
    // it inherits is the TENANT's — title, description, og:site_name, author.
    const serialised = JSON.stringify(
      buildStoreMetadata(source({ settings: { tagline: "Feel better" } })),
    );

    for (const platformString of PLATFORM_STRINGS) {
      expect(serialised).not.toContain(platformString);
    }
  });

  it("names the tenant as author, site name and og type", () => {
    const metadata = buildStoreMetadata(source());

    expect(metadata.authors).toEqual([{ name: BUSINESS_NAME }]);
    expect(metadata.openGraph).toMatchObject({
      siteName: BUSINESS_NAME,
      type: "website",
    });
  });

  it("declares twitter so the platform's card title/description cannot survive", () => {
    // Next REPLACES `twitter` at the deepest segment that declares it, then
    // refills title/description from this page's own. Not declaring it would
    // leave app/layout.tsx's "BudStacks - Medical Cannabis SaaS" in place.
    expect(buildStoreMetadata(source()).twitter).toEqual({
      card: "summary_large_image",
    });
  });

  it("falls back to the subdomain rather than rendering an empty title", () => {
    const metadata = buildStoreMetadata(
      source({ businessName: "   ", subdomain: "acme" }),
    );

    expect(metadata.title).toEqual({ template: "%s | acme", default: "acme" });
  });
});

describe("buildStoreMetadata — description cascade", () => {
  it("prefers the tenant's own tagline", () => {
    const metadata = buildStoreMetadata(
      source({ settings: { tagline: "  Grown in Portugal  " } }),
    );

    expect(metadata.description).toBe("Grown in Portugal");
  });

  it("falls back to a tenant-branded sentence when there is no tagline", () => {
    expect(buildStoreMetadata(source()).description).toBe(
      `Premium medical cannabis products and consultations from ${BUSINESS_NAME}`,
    );
  });

  it("survives a settings blob that is not an object at all", () => {
    // parseTenantSettings fails closed; the point is that generateMetadata
    // cannot throw into a render path with no error boundary above it.
    for (const settings of ["nonsense", 42, [], { tagline: 7 }]) {
      expect(buildStoreMetadata(source({ settings })).description).toBe(
        `Premium medical cannabis products and consultations from ${BUSINESS_NAME}`,
      );
    }
  });
});

describe("buildStoreMetadata — metadataBase", () => {
  it("is the custom domain when the tenant has one", () => {
    expect(buildStoreMetadata(source()).metadataBase?.href).toBe(
      `https://${CUSTOM_DOMAIN}/`,
    );
  });

  it("is the tenant subdomain otherwise", () => {
    const metadataBase = buildStoreMetadata(
      source({ customDomain: null }),
    ).metadataBase;

    expect(metadataBase?.protocol).toBe("https:");
    expect(metadataBase?.hostname.startsWith("acme.")).toBe(true);
  });

  it("degrades to the subdomain origin when the custom domain is unparseable", () => {
    const metadataBase = buildStoreMetadata(
      source({ customDomain: "not a domain" }),
    ).metadataBase;

    expect(metadataBase?.hostname.startsWith("acme.")).toBe(true);
  });
});

describe("buildStoreMetadata — favicon cascade", () => {
  it("serves an uploaded favicon through the durable public image route", () => {
    const metadata = buildStoreMetadata(
      source({
        faviconRef: "development/tenants/tenant-a/uploads/1754-favicon.png",
      }),
    );

    expect(metadata.icons).toEqual({
      icon: `${PUBLIC_IMAGE_ROUTE_PREFIX}development/tenants/tenant-a/uploads/1754-favicon.png`,
      shortcut: `${PUBLIC_IMAGE_ROUTE_PREFIX}development/tenants/tenant-a/uploads/1754-favicon.png`,
      apple: `${PUBLIC_IMAGE_ROUTE_PREFIX}development/tenants/tenant-a/uploads/1754-favicon.png`,
    });
  });

  it("falls back to the platform favicon when the tenant has none", () => {
    expect(buildStoreMetadata(source()).icons).toEqual({
      icon: PLATFORM_FAVICON,
      shortcut: PLATFORM_FAVICON,
      apple: PLATFORM_FAVICON,
    });
  });

  it("never renders a presigned URL — it would expire in the page", () => {
    const presigned =
      "https://bucket.s3.eu-west-1.amazonaws.com/development/tenants/tenant-a/uploads/1754-favicon.png?X-Amz-Signature=deadbeef";

    expect(
      buildStoreMetadata(source({ faviconRef: presigned })).icons,
    ).toMatchObject({ icon: PLATFORM_FAVICON });
  });

  it("falls back for a key the public image route would 404", () => {
    // An SVG (never served — it is XML and can carry script) and a template
    // asset key (outside tenants/{id}/uploads/) both have no durable route.
    for (const faviconRef of [
      "development/tenants/tenant-a/uploads/1754-favicon.svg",
      "development/tenants/tenant-a/templates/healingbudsv2/favicon.png",
    ]) {
      expect(buildStoreMetadata(source({ faviconRef })).icons).toMatchObject({
        icon: PLATFORM_FAVICON,
      });
    }
  });
});

describe("buildStoreMetadata — site verification (US-026)", () => {
  const GOOGLE_TOKEN = "AbCdEf0123456789_-AbCdEf0123456789_-AbCdEfg";

  it("declares the tokens on the layout, so every store page carries them", () => {
    const metadata = buildStoreMetadata(
      source({
        plan: "pro",
        settings: {
          googleSiteVerification: GOOGLE_TOKEN,
          bingSiteVerification: "0123456789ABCDEF0123456789ABCDEF",
        },
      }),
    );

    expect(metadata.verification).toEqual({
      google: GOOGLE_TOKEN,
      other: { "msvalidate.01": "0123456789ABCDEF0123456789ABCDEF" },
    });
  });

  it("omits the key entirely for a Basic tenant and for a store with nothing verified", () => {
    expect(
      buildStoreMetadata(
        source({ plan: "basic", settings: { googleSiteVerification: GOOGLE_TOKEN } }),
      ).verification,
    ).toBeUndefined();
    expect(buildStoreMetadata(source({ plan: "pro" })).verification).toBeUndefined();
  });

  it("does not disturb the rest of the metadata", () => {
    const metadata = buildStoreMetadata(
      source({ plan: "pro", settings: { googleSiteVerification: GOOGLE_TOKEN } }),
    );

    expect(metadata.title).toEqual({
      template: `%s | ${BUSINESS_NAME}`,
      default: BUSINESS_NAME,
    });
    expect(metadata.openGraph?.siteName).toBe(BUSINESS_NAME);
  });

  /**
   * The production regression, end to end.
   *
   * Search Console reported the tag as missing from `<head>` and it was: the
   * token was stored and valid, but the blob also carried ONE malformed cosmetic
   * key (`letterSpacingPreset` holding a design-system map instead of a token),
   * and `parseTenantSettings` used to fail the whole object over it — so this
   * builder read `{}` and emitted no verification at all. The token must now
   * survive its neighbour.
   */
  it("emits the tag even when an unrelated settings key is malformed", () => {
    const metadata = buildStoreMetadata(
      source({
        plan: "trial",
        settings: {
          googleSiteVerification: GOOGLE_TOKEN,
          tagline: "Lekker local",
          letterSpacingPreset: {
            wide: "0.025em",
            tight: "-0.02em",
            normal: "0",
          },
        },
      }),
    );

    expect(metadata.verification).toEqual({ google: GOOGLE_TOKEN });
    // the same parse feeds the description, which was collateral damage too
    expect(metadata.description).toBe("Lekker local");
  });
});
