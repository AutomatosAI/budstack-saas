import { describe, it, expect } from "vitest";

// SEO Supercharge US-014 — the JSON-LD engine.
//
// Two properties this file exists to hold, because both fail silently:
//
//  1. NOTHING AN OWNER TYPES CAN BREAK OUT OF THE SCRIPT ELEMENT. The serializer
//     is the only path from a node to the DOM, and the hostile fixture below is
//     the exact payload — `</script><script>` in a businessName — that a naive
//     `JSON.stringify` into a script tag hands straight to the browser.
//  2. A BASIC TENANT EMITS NOTHING. Not a partial node, not an empty block —
//     no element at all. The storefront never 403s on plan, it degrades.
import {
  JSON_LD_CONTEXT,
  buildPostalAddress,
  buildStoreJsonLd,
  escapeJsonLd,
  serializeJsonLd,
  type JsonLdNode,
  type StoreJsonLdSource,
} from "@/lib/seo/json-ld";
import { PUBLIC_IMAGE_ROUTE_PREFIX } from "@/lib/storage/public-image-url";

/** A custom domain, so expectations never depend on NEXT_PUBLIC_BASE_DOMAIN. */
const CUSTOM_DOMAIN = "acme-cannabis.example";
const STORE_URL = `https://${CUSTOM_DOMAIN}`;
const BUSINESS_NAME = "Acme Cannabis Co";

/** A real tenant upload key — the only shape that has a durable public route. */
const LOGO_KEY = "development/tenants/tenant-a/uploads/logo.png";

function source(overrides: Partial<StoreJsonLdSource> = {}): StoreJsonLdSource {
  return {
    id: "tenant-a",
    plan: "pro",
    businessName: BUSINESS_NAME,
    subdomain: "acme",
    customDomain: CUSTOM_DOMAIN,
    logoRef: null,
    businessAddress1: null,
    businessAddress2: null,
    businessCity: null,
    businessState: null,
    businessPostalCode: null,
    businessCountry: null,
    ...overrides,
  };
}

/** Every address column filled — the case that earns a LocalBusiness. */
const FULL_ADDRESS = {
  businessAddress1: "12 Rua da Prata",
  businessAddress2: "Unit 4",
  businessCity: "Lisbon",
  businessState: "Lisboa",
  businessPostalCode: "1100-052",
  businessCountry: "Portugal",
};

function nodeOfType(nodes: readonly JsonLdNode[], type: string): JsonLdNode {
  const found = nodes.find((node) => node["@type"] === type);
  expect(found, `expected a ${type} node`).toBeDefined();
  return found as JsonLdNode;
}

describe("serializeJsonLd — nothing can terminate the script element", () => {
  it("neutralises a </script> breakout in a tenant-authored name", () => {
    const hostile = '</script><script>alert("xss")</script>';
    const nodes = buildStoreJsonLd(source({ businessName: hostile }));
    const serialized = serializeJsonLd(nodes);

    expect(serialized).toBeTruthy();
    // The whole point: the rendered string carries no character that can close
    // the element it lives inside, in either case or any spacing variation.
    expect(serialized).not.toContain("<");
    expect(serialized).not.toContain(">");
    expect(serialized!.toLowerCase()).not.toContain("</script");
    expect(serialized).toContain("\\u003c");

    // ...and the escape is value-preserving: a consumer parses back the exact
    // string the owner typed, so this is neutralisation, not mangling.
    const parsed = JSON.parse(serialized!);
    expect(parsed.name).toBe(hostile);
  });

  it("escapes < > & and the JS line separators, and only those", () => {
    expect(escapeJsonLd('{"a":"<>&"}')).toBe(
      '{"a":"\\u003c\\u003e\\u0026"}',
    );
    // The REAL separator characters, spelled via fromCharCode so the intent
    // survives a copy-paste that would silently normalise them away.
    const separators = String.fromCharCode(0x2028, 0x2029);
    expect(escapeJsonLd(`"${separators}"`)).toBe('"\\u2028\\u2029"');
    expect(escapeJsonLd('{"a":"plain text 1"}')).toBe('{"a":"plain text 1"}');
  });

  it("survives a hostile value in every position, not just the name", () => {
    const hostile = "</script>";
    const nodes = buildStoreJsonLd(
      source({
        ...FULL_ADDRESS,
        businessAddress1: `12 ${hostile} Street`,
        businessCity: hostile,
        businessCountry: hostile,
      }),
    );
    const serialized = serializeJsonLd(nodes);

    expect(serialized).not.toContain("<");
    const address = JSON.parse(serialized!)["@graph"][1].address;
    expect(address.addressLocality).toBe(hostile);
  });

  it("returns null for no nodes — an empty block is a parse error", () => {
    expect(serializeJsonLd([])).toBeNull();
  });

  it("emits one node inline and several under @graph", () => {
    const single = JSON.parse(
      serializeJsonLd([{ "@type": "Organization", name: "A" }])!,
    );
    expect(single).toEqual({
      "@context": JSON_LD_CONTEXT,
      "@type": "Organization",
      name: "A",
    });
    expect(single["@graph"]).toBeUndefined();

    const many = JSON.parse(
      serializeJsonLd([
        { "@type": "Organization", name: "A" },
        { "@type": "LocalBusiness", name: "A" },
      ])!,
    );
    expect(many["@context"]).toBe(JSON_LD_CONTEXT);
    expect(many["@graph"]).toHaveLength(2);
  });

  it("returns null rather than throwing on a value that cannot serialize", () => {
    const circular: Record<string, unknown> = { "@type": "Organization" };
    circular.self = circular;
    expect(serializeJsonLd([circular as JsonLdNode])).toBeNull();
  });
});

describe("buildStoreJsonLd — the plan gate", () => {
  it("emits nothing for a Basic tenant", () => {
    expect(buildStoreJsonLd(source({ plan: "basic", ...FULL_ADDRESS }))).toEqual(
      [],
    );
    expect(
      serializeJsonLd(buildStoreJsonLd(source({ plan: "basic" }))),
    ).toBeNull();
  });

  it("emits for every plan that includes seo.pro", () => {
    for (const plan of ["trial", "pro", "custom"]) {
      expect(
        buildStoreJsonLd(source({ plan })).length,
        `plan ${plan}`,
      ).toBeGreaterThan(0);
    }
  });

  it("fails closed on an unreadable plan — never a free upgrade", () => {
    for (const plan of [undefined, null, "", "PRO", "enterprise", 169, {}]) {
      expect(buildStoreJsonLd(source({ plan })), `plan ${String(plan)}`).toEqual(
        [],
      );
    }
  });
});

describe("buildStoreJsonLd — Organization", () => {
  it("carries name, the primary host and a stable @id", () => {
    const organization = nodeOfType(
      buildStoreJsonLd(source()),
      "Organization",
    );

    expect(organization.name).toBe(BUSINESS_NAME);
    expect(organization.url).toBe(STORE_URL);
    expect(organization["@id"]).toBe(`${STORE_URL}/#organization`);
  });

  it("uses the custom domain over the subdomain as the primary host", () => {
    const onSubdomain = nodeOfType(
      buildStoreJsonLd(source({ customDomain: null })),
      "Organization",
    );

    expect(onSubdomain.url).not.toBe(STORE_URL);
    expect(onSubdomain.url).toContain("acme.");
  });

  it("falls back to the subdomain when the tenant has no business name", () => {
    const organization = nodeOfType(
      buildStoreJsonLd(source({ businessName: "   " })),
      "Organization",
    );
    expect(organization.name).toBe("acme");
  });

  it("emits nothing when there is no name at all — a nameless entity is invalid", () => {
    expect(
      buildStoreJsonLd(source({ businessName: null, subdomain: "" })),
    ).toEqual([]);
  });

  it("absolutises a stored upload key to the durable public image route", () => {
    const organization = nodeOfType(
      buildStoreJsonLd(source({ logoRef: LOGO_KEY })),
      "Organization",
    );

    expect(organization.logo).toBe(
      `${STORE_URL}${PUBLIC_IMAGE_ROUTE_PREFIX}${LOGO_KEY}`,
    );
  });

  it("drops a presigned S3 logo rather than emitting a URL that expires", () => {
    const presigned =
      "https://budstack-uploads.s3.amazonaws.com/logo.png?X-Amz-Signature=abc";
    const organization = nodeOfType(
      buildStoreJsonLd(source({ logoRef: presigned })),
      "Organization",
    );

    expect(organization.logo).toBeUndefined();
    expect(JSON.stringify(organization)).not.toContain("X-Amz-");
  });

  it("keeps an already-absolute unsigned logo URL verbatim", () => {
    const hosted = "https://cdn.example/logo.png";
    const organization = nodeOfType(
      buildStoreJsonLd(source({ logoRef: hosted })),
      "Organization",
    );
    expect(organization.logo).toBe(hosted);
  });

  it("omits logo entirely when there is none", () => {
    const organization = nodeOfType(buildStoreJsonLd(source()), "Organization");
    expect("logo" in organization).toBe(false);
  });
});

describe("buildStoreJsonLd — LocalBusiness and the address floor", () => {
  it("adds LocalBusiness with a full PostalAddress", () => {
    const nodes = buildStoreJsonLd(source({ ...FULL_ADDRESS, logoRef: LOGO_KEY }));
    expect(nodes).toHaveLength(2);

    const business = nodeOfType(nodes, "LocalBusiness");
    expect(business["@id"]).toBe(`${STORE_URL}/#localbusiness`);
    expect(business.name).toBe(BUSINESS_NAME);
    expect(business.url).toBe(STORE_URL);
    expect(business.image).toBe(
      `${STORE_URL}${PUBLIC_IMAGE_ROUTE_PREFIX}${LOGO_KEY}`,
    );
    expect(business.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "12 Rua da Prata, Unit 4",
      addressLocality: "Lisbon",
      addressRegion: "Lisboa",
      postalCode: "1100-052",
      addressCountry: "Portugal",
    });
  });

  it("degrades a partial address to Organization only — never a half-empty one", () => {
    const partials = [
      { ...FULL_ADDRESS, businessAddress1: null },
      { ...FULL_ADDRESS, businessCity: "  " },
      { ...FULL_ADDRESS, businessCountry: undefined },
      { ...FULL_ADDRESS, businessAddress1: 42 },
    ];

    for (const partial of partials) {
      const nodes = buildStoreJsonLd(source(partial));
      expect(nodes, JSON.stringify(partial)).toHaveLength(1);
      expect(nodes[0]["@type"]).toBe("Organization");
      expect(JSON.stringify(nodes)).not.toContain("PostalAddress");
    }
  });

  it("emits no address at all for a tenant that has filled in none of it", () => {
    const nodes = buildStoreJsonLd(source());
    expect(nodes).toHaveLength(1);
    expect(nodes[0]["@type"]).toBe("Organization");
  });

  it("keeps region and postal code optional once the floor is met", () => {
    const address = buildPostalAddress({
      ...FULL_ADDRESS,
      businessAddress2: null,
      businessState: null,
      businessPostalCode: "",
    });

    expect(address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "12 Rua da Prata",
      addressLocality: "Lisbon",
      addressCountry: "Portugal",
    });
  });

  it("never throws on junk in any address column", () => {
    expect(() =>
      buildPostalAddress({
        businessAddress1: { street: "x" },
        businessAddress2: [],
        businessCity: 7,
        businessState: true,
        businessPostalCode: null,
        businessCountry: undefined,
      }),
    ).not.toThrow();
  });
});
