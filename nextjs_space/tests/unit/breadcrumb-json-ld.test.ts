import { describe, it, expect } from "vitest";

// SEO Supercharge US-016 — BreadcrumbList on the three detail page types.
//
// What this file holds, all of which fail silently in production — a wrong
// trail still renders, still parses, and simply misdescribes the page:
//
//  1. The URLs are the PRIMARY host's. A tenant on a custom domain publishing a
//     trail of `{subdomain}.budstacks.io` links is the duplicate-content defect
//     US-007 exists to close, restated in structured data.
//  2. The section labels are the ones the sections' own pages carry — a crumb
//     reading "Blog" above a page titled "The Wire" is a trail to nowhere.
//  3. A nameless crumb emits NOTHING. A ListItem without a name is invalid, not
//     partial, and a trail that stops short of the page it sits on is worse than
//     no trail at all.
//  4. A Basic tenant emits nothing — the storefront degrades on plan, never
//     blocks — and no entity name can break out of the script element.
import {
  BREADCRUMB_HOME_NAME,
  buildBreadcrumbJsonLd,
  conditionBreadcrumbTrail,
  productBreadcrumbTrail,
  wirePostBreadcrumbTrail,
  type BreadcrumbJsonLdSource,
} from "@/lib/seo/breadcrumb-json-ld";
import { serializeJsonLd, type JsonLdNode } from "@/lib/seo/json-ld";
import { WIRE_INDEX_TITLE } from "@/lib/seo/post-metadata";
import { PRODUCTS_INDEX_TITLE } from "@/lib/seo/product-paths";
import { storeSeoPage } from "@/lib/seo/store-pages";

/** A custom domain, so expectations never depend on NEXT_PUBLIC_BASE_DOMAIN. */
const CUSTOM_DOMAIN = "acme-cannabis.example";
const STORE_URL = `https://${CUSTOM_DOMAIN}`;

const STRAIN_ID = "6f1c2b18-0f3a-4a11-9a1e-7d5b0c9a2e44";

function source(
  overrides: Partial<BreadcrumbJsonLdSource> = {},
): BreadcrumbJsonLdSource {
  return {
    tenantId: "tenant-a",
    plan: "pro",
    subdomain: "acme",
    customDomain: CUSTOM_DOMAIN,
    ...overrides,
  };
}

/** The single BreadcrumbList node, asserting there is exactly one. */
function breadcrumbNode(nodes: readonly JsonLdNode[]): JsonLdNode {
  expect(nodes).toHaveLength(1);
  expect(nodes[0]["@type"]).toBe("BreadcrumbList");
  return nodes[0];
}

function itemsOf(nodes: readonly JsonLdNode[]): Record<string, unknown>[] {
  return breadcrumbNode(nodes).itemListElement as Record<string, unknown>[];
}

describe("buildBreadcrumbJsonLd — the plan gate", () => {
  it("emits nothing for a Basic tenant", () => {
    const nodes = buildBreadcrumbJsonLd(
      source({ plan: "basic" }),
      productBreadcrumbTrail("Blue Dream", STRAIN_ID),
    );

    expect(nodes).toEqual([]);
    expect(serializeJsonLd(nodes)).toBeNull();
  });

  it("emits for every plan that includes seo.pro", () => {
    for (const plan of ["trial", "pro", "custom"]) {
      expect(
        buildBreadcrumbJsonLd(
          source({ plan }),
          productBreadcrumbTrail("Blue Dream", STRAIN_ID),
        ).length,
        `plan ${plan}`,
      ).toBe(1);
    }
  });

  it("fails closed on an unreadable plan — never a free upgrade", () => {
    for (const plan of [undefined, null, "", "PRO", "enterprise", 169, {}]) {
      expect(
        buildBreadcrumbJsonLd(
          source({ plan }),
          productBreadcrumbTrail("Blue Dream", STRAIN_ID),
        ),
        `plan ${String(plan)}`,
      ).toEqual([]);
    }
  });
});

describe("buildBreadcrumbJsonLd — the trail", () => {
  it("starts at Home and numbers every crumb from 1", () => {
    const items = itemsOf(
      buildBreadcrumbJsonLd(
        source(),
        productBreadcrumbTrail("Blue Dream", STRAIN_ID),
      ),
    );

    expect(items).toHaveLength(3);
    expect(items.map((item) => item.position)).toEqual([1, 2, 3]);
    expect(items.map((item) => item["@type"])).toEqual([
      "ListItem",
      "ListItem",
      "ListItem",
    ]);
    expect(items[0].name).toBe(BREADCRUMB_HOME_NAME);
    expect(items[0].item).toBe(STORE_URL);
  });

  it("builds every URL on the primary host", () => {
    const onCustomDomain = itemsOf(
      buildBreadcrumbJsonLd(
        source(),
        productBreadcrumbTrail("Blue Dream", STRAIN_ID),
      ),
    );
    for (const item of onCustomDomain) {
      expect(String(item.item).startsWith(STORE_URL)).toBe(true);
    }

    // No custom domain: the subdomain host, and never the platform apex.
    const onSubdomain = itemsOf(
      buildBreadcrumbJsonLd(
        source({ customDomain: null }),
        productBreadcrumbTrail("Blue Dream", STRAIN_ID),
      ),
    );
    for (const item of onSubdomain) {
      expect(String(item.item)).toContain("acme.");
    }
  });

  it("anchors the node's @id to the page the trail ends on", () => {
    const node = breadcrumbNode(
      buildBreadcrumbJsonLd(
        source(),
        productBreadcrumbTrail("Blue Dream", STRAIN_ID),
      ),
    );

    expect(node["@id"]).toBe(`${STORE_URL}/products/${STRAIN_ID}#breadcrumb`);
  });

  it("emits nothing for an empty trail", () => {
    expect(buildBreadcrumbJsonLd(source(), [])).toEqual([]);
  });

  it("emits nothing when a crumb has no usable name", () => {
    for (const name of [null, undefined, "", "   ", 7, {}]) {
      expect(
        buildBreadcrumbJsonLd(source(), productBreadcrumbTrail(name, STRAIN_ID)),
        `name ${String(name)}`,
      ).toEqual([]);
    }
  });

  it("cannot break out of the script element it is serialized into", () => {
    const hostile = "</script><script>alert(1)</script>";
    const json = serializeJsonLd(
      buildBreadcrumbJsonLd(source(), productBreadcrumbTrail(hostile, STRAIN_ID)),
    );

    expect(json).not.toBeNull();
    expect(json).not.toContain("</script>");
    expect(json).not.toContain("<");
    // The VALUE survives the escaping — it is the markup that cannot.
    expect(JSON.parse(json as string)).toMatchObject({
      itemListElement: [{}, {}, { name: hostile }],
    });
  });
});

describe("the three trails", () => {
  it("puts a Wire post under The Wire, keyed by its slug", () => {
    const items = itemsOf(
      buildBreadcrumbJsonLd(
        source(),
        wirePostBreadcrumbTrail("Cannabis and chronic pain", "cannabis-pain"),
      ),
    );

    expect(items[1]).toMatchObject({
      name: WIRE_INDEX_TITLE,
      item: `${STORE_URL}/the-wire`,
    });
    expect(items[2]).toMatchObject({
      name: "Cannabis and chronic pain",
      item: `${STORE_URL}/the-wire/cannabis-pain`,
    });
  });

  it("puts a product under Products, keyed by the Dr Green strain id", () => {
    const items = itemsOf(
      buildBreadcrumbJsonLd(
        source(),
        productBreadcrumbTrail("Blue Dream", STRAIN_ID),
      ),
    );

    expect(items[1]).toMatchObject({
      name: PRODUCTS_INDEX_TITLE,
      item: `${STORE_URL}/products`,
    });
    expect(items[2]).toMatchObject({
      name: "Blue Dream",
      item: `${STORE_URL}/products/${STRAIN_ID}`,
    });
  });

  it("puts a condition under Conditions, keyed by its slug", () => {
    const items = itemsOf(
      buildBreadcrumbJsonLd(
        source(),
        conditionBreadcrumbTrail("Chronic Pain", "chronic-pain"),
      ),
    );

    expect(items[1]).toMatchObject({
      name: storeSeoPage("conditions").name,
      item: `${STORE_URL}/conditions`,
    });
    expect(items[2]).toMatchObject({
      name: "Chronic Pain",
      item: `${STORE_URL}/conditions/chronic-pain`,
    });
  });

  it("falls back to the section itself when the entity has no page of its own", () => {
    // `productPath`/`conditionPath` degrade to the listing for a row with no
    // key — the crumb then points at a page that exists rather than a 404.
    const items = itemsOf(
      buildBreadcrumbJsonLd(source(), productBreadcrumbTrail("Blue Dream", "")),
    );

    expect(items[2].item).toBe(`${STORE_URL}/products`);
  });
});
