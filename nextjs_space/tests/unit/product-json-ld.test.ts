import { describe, it, expect } from "vitest";

// SEO Supercharge US-015 — Product + Offer structured data.
//
// The properties this file holds, all of which fail SILENTLY in production —
// a wrong node still renders, still parses, and simply misinforms the SERP:
//
//  1. The offer is priced in the tenant's ACTUAL currency. `DoctorGreenProduct`
//     carries a display symbol AND an ISO code on adjacent fields, and the
//     detail page already reads the wrong one with a `|| "EUR"` fallback
//     (product-detail-client.tsx:186). A symbol must never reach priceCurrency.
//  2. No price, no node. Not a Product with an empty Offer.
//  3. Availability fails CLOSED — a false InStock is the mismatch that costs a
//     merchant their rich results.
//  4. A Basic tenant emits nothing at all, and no owner-authored string can
//     break out of the script element it is serialized into.
import { serializeJsonLd, type JsonLdNode } from "@/lib/seo/json-ld";
import {
  SCHEMA_IN_STOCK,
  SCHEMA_OUT_OF_STOCK,
  buildProductJsonLd,
  type ProductJsonLdSource,
} from "@/lib/seo/product-json-ld";
import { PUBLIC_IMAGE_ROUTE_PREFIX } from "@/lib/storage/public-image-url";

/** A custom domain, so expectations never depend on NEXT_PUBLIC_BASE_DOMAIN. */
const CUSTOM_DOMAIN = "acme-cannabis.example";
const STORE_URL = `https://${CUSTOM_DOMAIN}`;
const BUSINESS_NAME = "Acme Cannabis Co";

/** The Dr Green strain id — what the URL is keyed by, not `products.slug`. */
const STRAIN_ID = "6f1c2b18-0f3a-4a11-9a1e-7d5b0c9a2e44";
const PRODUCT_URL = `${STORE_URL}/products/${STRAIN_ID}`;

const PRODUCT_NAME = "Blue Dream";

/** A real tenant upload key — the only shape with a durable public route. */
const OG_IMAGE_KEY = "development/tenants/tenant-a/uploads/blue-dream.png";

function source(
  overrides: Partial<ProductJsonLdSource> = {},
): ProductJsonLdSource {
  return {
    tenantId: "tenant-a",
    plan: "pro",
    businessName: BUSINESS_NAME,
    subdomain: "acme",
    customDomain: CUSTOM_DOMAIN,
    productId: STRAIN_ID,
    name: PRODUCT_NAME,
    description: "A balanced daytime hybrid.",
    imageUrl: "https://prod-profiles-backend.s3.amazonaws.com/strains/bd.jpg",
    price: 45,
    currencyCode: "ZAR",
    inStock: true,
    thcContent: 22.4,
    cbdContent: 0.6,
    strainType: "Hybrid",
    seo: null,
    ...overrides,
  };
}

/** The single Product node, asserting there is exactly one. */
function productNode(nodes: readonly JsonLdNode[]): JsonLdNode {
  expect(nodes).toHaveLength(1);
  expect(nodes[0]["@type"]).toBe("Product");
  return nodes[0];
}

function offerOf(nodes: readonly JsonLdNode[]): Record<string, unknown> {
  return productNode(nodes).offers as Record<string, unknown>;
}

function propertyNamed(
  nodes: readonly JsonLdNode[],
  name: string,
): Record<string, unknown> | undefined {
  const properties = (productNode(nodes).additionalProperty ??
    []) as Record<string, unknown>[];
  return properties.find((property) => property.name === name);
}

describe("buildProductJsonLd — the plan gate", () => {
  it("emits nothing for a Basic tenant", () => {
    expect(buildProductJsonLd(source({ plan: "basic" }))).toEqual([]);
    expect(
      serializeJsonLd(buildProductJsonLd(source({ plan: "basic" }))),
    ).toBeNull();
  });

  it("emits for every plan that includes seo.pro", () => {
    for (const plan of ["trial", "pro", "custom"]) {
      expect(
        buildProductJsonLd(source({ plan })).length,
        `plan ${plan}`,
      ).toBe(1);
    }
  });

  it("fails closed on an unreadable plan — never a free upgrade", () => {
    for (const plan of [undefined, null, "", "PRO", "enterprise", 169, {}]) {
      expect(
        buildProductJsonLd(source({ plan })),
        `plan ${String(plan)}`,
      ).toEqual([]);
    }
  });
});

describe("buildProductJsonLd — the Product node", () => {
  it("carries the live name, the canonical URL as @id, and the store brand", () => {
    const product = productNode(buildProductJsonLd(source()));

    expect(product.name).toBe(PRODUCT_NAME);
    expect(product["@id"]).toBe(`${PRODUCT_URL}#product`);
    // A self-contained Brand, not an @id reference to the Organization the home
    // page declares: structured data is read per page.
    expect(product.brand).toEqual({ "@type": "Brand", name: BUSINESS_NAME });
  });

  it("keys the URL on the Dr Green strain id, on the primary host", () => {
    expect(offerOf(buildProductJsonLd(source())).url).toBe(PRODUCT_URL);

    const onSubdomain = offerOf(
      buildProductJsonLd(source({ customDomain: null })),
    );
    expect(onSubdomain.url).toContain("acme.");
    expect(onSubdomain.url).toContain(`/products/${STRAIN_ID}`);
  });

  it("emits nothing for a strain with no name", () => {
    expect(buildProductJsonLd(source({ name: "   " }))).toEqual([]);
    expect(buildProductJsonLd(source({ name: null }))).toEqual([]);
  });

  it("falls back to the subdomain for the brand, and omits it when there is none", () => {
    expect(
      productNode(buildProductJsonLd(source({ businessName: null }))).brand,
    ).toEqual({ "@type": "Brand", name: "acme" });

    expect(
      productNode(
        buildProductJsonLd(source({ businessName: "", subdomain: "" })),
      ).brand,
    ).toBeUndefined();
  });
});

describe("buildProductJsonLd — description matches the meta description", () => {
  it("prefers the authored products.seo.description", () => {
    const product = productNode(
      buildProductJsonLd(
        source({ seo: { description: "Authored for search." } }),
      ),
    );
    expect(product.description).toBe("Authored for search.");
  });

  it("falls back to truncated strain copy, collapsing its newlines", () => {
    const product = productNode(
      buildProductJsonLd(source({ description: `Line one.\n\nLine two.` })),
    );
    expect(product.description).toBe("Line one. Line two.");
  });

  it("omits the key entirely when there is nothing to say", () => {
    const product = productNode(
      buildProductJsonLd(source({ description: null, seo: null })),
    );
    expect(product.description).toBeUndefined();
    expect("description" in product).toBe(false);
  });
});

describe("buildProductJsonLd — the image", () => {
  it("absolutises an authored upload key to the durable public route", () => {
    const product = productNode(
      buildProductJsonLd(source({ seo: { ogImage: OG_IMAGE_KEY } })),
    );
    expect(product.image).toBe(
      `${STORE_URL}${PUBLIC_IMAGE_ROUTE_PREFIX}${OG_IMAGE_KEY}`,
    );
  });

  it("falls back to the live strain shot", () => {
    const product = productNode(buildProductJsonLd(source()));
    expect(product.image).toBe(
      "https://prod-profiles-backend.s3.amazonaws.com/strains/bd.jpg",
    );
  });

  it("drops a presigned S3 URL rather than emit a link that 403s", () => {
    const presigned = `https://bucket.s3.amazonaws.com/strains/bd.jpg?X-Amz-Signature=abc`;
    const product = productNode(
      buildProductJsonLd(source({ imageUrl: presigned })),
    );
    expect(product.image).toBeUndefined();
  });
});

describe("buildProductJsonLd — the Offer", () => {
  it("prices in the ISO code at the precision the page prints", () => {
    const offer = offerOf(buildProductJsonLd(source({ price: 45 })));

    expect(offer["@type"]).toBe("Offer");
    expect(offer.price).toBe("45.00");
    expect(offer.priceCurrency).toBe("ZAR");
  });

  it("rounds away the float artefacts the EUR conversion produces", () => {
    const offer = offerOf(
      buildProductJsonLd(source({ price: 45.230000000000004 })),
    );
    expect(offer.price).toBe("45.23");
  });

  it("REFUSES a currency SYMBOL — the `|| \"EUR\"` bug class", () => {
    // `DoctorGreenProduct.currency` is the symbol sitting next to the code.
    for (const symbol of ["R", "€", "C$", "", "EURO", "za"]) {
      expect(
        buildProductJsonLd(source({ currencyCode: symbol })),
        `currency ${symbol}`,
      ).toEqual([]);
    }
  });

  it("upper-cases a lower-case ISO code rather than dropping it", () => {
    expect(
      offerOf(buildProductJsonLd(source({ currencyCode: "eur" }))).priceCurrency,
    ).toBe("EUR");
  });

  it("emits NO node at all when there is no usable price", () => {
    // 0 is what `normalizeProduct` falls back to for "Price unavailable".
    for (const price of [0, -1, null, undefined, "", "free", NaN, {}]) {
      expect(
        buildProductJsonLd(source({ price })),
        `price ${String(price)}`,
      ).toEqual([]);
    }
  });

  it("reads a numeric string price rather than dropping the offer", () => {
    expect(offerOf(buildProductJsonLd(source({ price: "45.5" }))).price).toBe(
      "45.50",
    );
  });

  it("marks availability from stock, failing closed on anything but true", () => {
    expect(offerOf(buildProductJsonLd(source({ inStock: true }))).availability)
      .toBe(SCHEMA_IN_STOCK);

    for (const inStock of [false, undefined, null, 0, "true", 1]) {
      expect(
        offerOf(buildProductJsonLd(source({ inStock }))).availability,
        `inStock ${String(inStock)}`,
      ).toBe(SCHEMA_OUT_OF_STOCK);
    }
  });
});

describe("buildProductJsonLd — strain attributes", () => {
  it("carries THC, CBD and strain type as PropertyValues", () => {
    const nodes = buildProductJsonLd(source());

    expect(propertyNamed(nodes, "THC content")).toEqual({
      "@type": "PropertyValue",
      name: "THC content",
      value: 22.4,
      unitText: "%",
    });
    expect(propertyNamed(nodes, "CBD content")?.value).toBe(0.6);
    expect(propertyNamed(nodes, "Strain type")).toEqual({
      "@type": "PropertyValue",
      name: "Strain type",
      value: "Hybrid",
    });
  });

  it("treats 0 as absent — the page hides the badge, so the schema stays quiet", () => {
    const nodes = buildProductJsonLd(source({ thcContent: 0, cbdContent: 0 }));

    expect(propertyNamed(nodes, "THC content")).toBeUndefined();
    expect(propertyNamed(nodes, "CBD content")).toBeUndefined();
    // The strain type survives — only the readings were missing.
    expect(propertyNamed(nodes, "Strain type")?.value).toBe("Hybrid");
  });

  it("rounds a reading to the one decimal the page displays", () => {
    expect(
      propertyNamed(buildProductJsonLd(source({ thcContent: 22.449 })), "THC content")
        ?.value,
    ).toBe(22.4);
  });

  it("omits additionalProperty entirely when the payload carries none", () => {
    const product = productNode(
      buildProductJsonLd(
        source({ thcContent: null, cbdContent: undefined, strainType: "" }),
      ),
    );
    expect(product.additionalProperty).toBeUndefined();
    expect("additionalProperty" in product).toBe(false);
  });
});

describe("buildProductJsonLd — nothing escapes the script element", () => {
  it("neutralises a </script> breakout in every owner-reachable field", () => {
    const hostile = '</script><script>alert("xss")</script>';
    const serialized = serializeJsonLd(
      buildProductJsonLd(
        source({
          name: hostile,
          businessName: hostile,
          strainType: hostile,
          seo: { description: hostile },
        }),
      ),
    );

    expect(serialized).toBeTruthy();
    expect(serialized).not.toContain("<");
    expect(serialized!.toLowerCase()).not.toContain("</script");

    // Value-preserving: a consumer parses back exactly what was authored.
    const parsed = JSON.parse(serialized!);
    expect(parsed.name).toBe(hostile);
    expect(parsed.description).toBe(hostile);
    expect(parsed.brand.name).toBe(hostile);
  });

  it("serializes a single Product inline with @context, not under @graph", () => {
    const parsed = JSON.parse(serializeJsonLd(buildProductJsonLd(source()))!);

    expect(parsed["@context"]).toBe("https://schema.org");
    expect(parsed["@type"]).toBe("Product");
    expect(parsed["@graph"]).toBeUndefined();
    expect(parsed.offers.priceCurrency).toBe("ZAR");
  });
});
