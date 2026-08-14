import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * LLM Visibility US-003 — llms.txt.
 *
 * The properties this file exists to hold:
 *
 *  1. EVERY URL IS ABSOLUTE AND ON THE PRIMARY HOST. The document is read out of
 *     band by a machine with no page to resolve a relative link against, and a
 *     store on a custom domain serves the same pages on two hosts — naming the
 *     subdomain there would advertise the copy the canonical says is not the
 *     original.
 *  2. IT HONOURS BOTH EXCLUSIONS. `sitemapExclude` AND `robots.noindex`. The
 *     sitemap honours only the first (the two controls are independent by
 *     design); a file whose whole purpose is "read my store" cannot list a URL
 *     whose own page asks not to be read.
 *  3. BASIC TENANTS GET 404, NOT AN EMPTY FILE. An empty 200 is a claim — "this
 *     store has nothing" — and it is false.
 *  4. NO SILENT TRUNCATION. A budgeted section says how much it left out and
 *     where the rest is.
 *  5. THE UI COPY DOES NOT OVERSELL. Four claims are required on the screen:
 *     proposed standard, ~10% adoption, no measured citation lift, no cost.
 *     Nothing in the feature promises a citation.
 *
 * The route runs for real; only prisma and tenant resolution are mocked, so what
 * is asserted is the shipped query shape and the shipped document.
 */

const prismaMock = vi.hoisted(() => ({
  products: { findMany: vi.fn() },
  posts: { findMany: vi.fn() },
  conditions: { findMany: vi.fn() },
}));
const { getCurrentTenant } = vi.hoisted(() => ({ getCurrentTenant: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/tenant/tenant", () => ({ getCurrentTenant }));

import { GET as llmsTxt } from "@/app/store/[slug]/llms.txt/route";
import { PLANS } from "@/lib/entitlements/plan";
import { storeCanonical } from "@/lib/seo/canonical";
import {
  LLMS_TXT_HONESTY_COPY,
  LLMS_TXT_PATH,
} from "@/lib/seo/llms-txt-copy";
import {
  LLMS_TXT_MAX_POSTS,
  LLMS_TXT_MAX_PRODUCTS,
  defaultLlmsTxtSummary,
  escapeMarkdownText,
  escapeMarkdownUrl,
  llmsTxtAddressLine,
  renderStoreLlmsTxt,
} from "@/lib/seo/llms-txt";
import { isEntityNoindexed, isSitemapExcluded } from "@/lib/seo/indexing";

const TENANT_ID = "tenant-a";
const SUBDOMAIN = "acme";
const ORIGIN = `https://${SUBDOMAIN}.budstacks.io`;
const STRAIN_ID = "b1d0f6c2-0000-4000-8000-000000000001";
/** Any plan that holds `seo.pro`; the loop below covers the rest. */
const PRO = "pro";

const NO_ADDRESS = {
  businessAddress1: null,
  businessAddress2: null,
  businessCity: null,
  businessState: null,
  businessPostalCode: null,
  businessCountry: null,
};

const FULL_ADDRESS = {
  businessAddress1: "12 High Street",
  businessAddress2: "Unit 4",
  businessCity: "Lisbon",
  businessState: "Lisboa",
  businessPostalCode: "1100-001",
  businessCountry: "PT",
};

const tenantRow = {
  id: TENANT_ID,
  subdomain: SUBDOMAIN,
  customDomain: null,
  businessName: "Acme Cannabis",
  isActive: true,
  plan: PRO,
  settings: null,
  pageSeo: null,
  ...NO_ADDRESS,
};

/** The minimum a builder call needs; each test overrides what it is about. */
function source(overrides: Record<string, unknown> = {}) {
  return {
    tenant: { subdomain: SUBDOMAIN, customDomain: null },
    tenantId: TENANT_ID,
    plan: PRO,
    businessName: "Acme Cannabis",
    address: NO_ADDRESS,
    summary: "",
    conditions: [],
    products: [],
    posts: [],
    ...overrides,
  } as Parameters<typeof renderStoreLlmsTxt>[0];
}

/** Every URL the document links to, in order. */
function links(body: string): string[] {
  return [...body.matchAll(/^- \[[^\]]*\]\(([^)]*)\)/gm)].map((m) => m[1]);
}

beforeEach(() => {
  getCurrentTenant.mockResolvedValue(tenantRow);
  prismaMock.products.findMany.mockResolvedValue([]);
  prismaMock.posts.findMany.mockResolvedValue([]);
  prismaMock.conditions.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("llms.txt — document shape", () => {
  it("opens with the H1, the blockquote summary and the store URL", () => {
    const body = renderStoreLlmsTxt(source({ summary: "Lisbon dispensary." }));
    const lines = body.split("\n");

    expect(lines[0]).toBe("# Acme Cannabis");
    expect(lines[2]).toBe("> Lisbon dispensary.");
    expect(body).toContain(`- Store: ${ORIGIN}`);
  });

  it("names the sitemap, which is the list this file budgets", () => {
    expect(renderStoreLlmsTxt(source())).toContain(
      `- Sitemap: ${ORIGIN}/sitemap.xml`,
    );
  });

  it("falls back to the sentence the homepage's own description falls back to", () => {
    expect(renderStoreLlmsTxt(source())).toContain(
      `> ${defaultLlmsTxtSummary("Acme Cannabis")}`,
    );
  });

  it("names the store after its subdomain when the row carries no business name", () => {
    expect(renderStoreLlmsTxt(source({ businessName: "  " }))).toContain(
      `# ${SUBDOMAIN}`,
    );
  });

  it("carries the three sections, each opening with its index URL", () => {
    const body = renderStoreLlmsTxt(source());

    expect(body).toContain("## Conditions");
    expect(body).toContain("## Products");
    expect(body).toContain("## The Wire");
    expect(links(body)).toEqual([
      `${ORIGIN}/conditions`,
      `${ORIGIN}/products`,
      `${ORIGIN}/the-wire`,
    ]);
  });

  it("ends with exactly one trailing newline", () => {
    const body = renderStoreLlmsTxt(source());
    expect(body.endsWith("\n")).toBe(true);
    expect(body.endsWith("\n\n")).toBe(false);
  });
});

describe("llms.txt — rows", () => {
  it("links a product by its Dr Green strain id, never the dead slug route", () => {
    const body = renderStoreLlmsTxt(
      source({
        products: [
          {
            drGreenStrainId: STRAIN_ID,
            name: "Blue Dream",
            description: "A sativa-dominant hybrid.",
          },
        ],
      }),
    );

    expect(body).toContain(
      `- [Blue Dream](${ORIGIN}/products/${STRAIN_ID}): A sativa-dominant hybrid.`,
    );
  });

  it("links a condition and a post by slug", () => {
    const body = renderStoreLlmsTxt(
      source({
        conditions: [
          { slug: "chronic-pain", name: "Chronic pain", description: "Guide." },
        ],
        posts: [{ slug: "harvest", title: "Harvest", excerpt: "News." }],
      }),
    );

    expect(body).toContain(
      `- [Chronic pain](${ORIGIN}/conditions/chronic-pain): Guide.`,
    );
    expect(body).toContain(`- [Harvest](${ORIGIN}/the-wire/harvest): News.`);
  });

  it("prefers the authored SEO description over the row's body copy", () => {
    const body = renderStoreLlmsTxt(
      source({
        products: [
          {
            drGreenStrainId: STRAIN_ID,
            name: "Blue Dream",
            description: "Raw catalogue copy.",
            seo: { description: "What the owner wrote for search." },
          },
        ],
      }),
    );

    expect(body).toContain(": What the owner wrote for search.");
    expect(body).not.toContain("Raw catalogue copy.");
  });

  it("collapses body copy onto one line and truncates it", () => {
    const body = renderStoreLlmsTxt(
      source({
        posts: [
          {
            slug: "long",
            title: "Long",
            excerpt: `First line.\nSecond line. ${"padding ".repeat(60)}`,
          },
        ],
      }),
    );

    const line = body
      .split("\n")
      .find((candidate) => candidate.includes("/the-wire/long"));
    expect(line).toBeDefined();
    expect(line).toContain("First line. Second line.");
    expect(line?.endsWith("…")).toBe(true);
  });

  it("drops a row with no key rather than aliasing it onto the index", () => {
    const body = renderStoreLlmsTxt(
      source({
        products: [
          { drGreenStrainId: null, name: "Never synced", description: "" },
          { drGreenStrainId: "  ", name: "Blank", description: "" },
        ],
      }),
    );

    expect(body).not.toContain("Never synced");
    expect(body).not.toContain("Blank");
    // The index link, and nothing else.
    expect(links(body).filter((url) => url.includes("/products"))).toEqual([
      `${ORIGIN}/products`,
    ]);
  });

  it("omits the summary suffix entirely when a row has nothing to say", () => {
    const body = renderStoreLlmsTxt(
      source({
        conditions: [{ slug: "anxiety", name: "Anxiety", description: null }],
      }),
    );

    expect(body).toContain(`- [Anxiety](${ORIGIN}/conditions/anxiety)\n`);
  });
});

describe("llms.txt — the address", () => {
  it("states a complete address on one line, unit folded into the street", () => {
    expect(llmsTxtAddressLine(FULL_ADDRESS)).toBe(
      "12 High Street, Unit 4, Lisbon, Lisboa, 1100-001, PT",
    );
    expect(renderStoreLlmsTxt(source({ address: FULL_ADDRESS }))).toContain(
      "- Address: 12 High Street, Unit 4, Lisbon, Lisboa, 1100-001, PT",
    );
  });

  it("emits NO address line below the JSON-LD completeness floor", () => {
    // Street + locality + country is the floor `buildPostalAddress` refuses to
    // go below; this file must not assert an address the structured data will
    // not state either.
    const partial = { ...FULL_ADDRESS, businessCountry: null };
    expect(llmsTxtAddressLine(partial)).toBe("");
    expect(renderStoreLlmsTxt(source({ address: partial }))).not.toContain(
      "- Address:",
    );
    expect(renderStoreLlmsTxt(source())).not.toContain("- Address:");
  });

  it("drops the optional region and postal code without dropping the line", () => {
    expect(
      llmsTxtAddressLine({
        ...FULL_ADDRESS,
        businessAddress2: null,
        businessState: null,
        businessPostalCode: null,
      }),
    ).toBe("12 High Street, Lisbon, PT");
  });
});

describe("llms.txt — exclusions", () => {
  const rows = {
    conditions: [
      { slug: "kept", name: "Kept", description: "" },
      {
        slug: "hidden",
        name: "Hidden",
        description: "",
        seo: { sitemapExclude: true },
      },
      {
        slug: "noindexed",
        name: "Noindexed",
        description: "",
        seo: { robots: { noindex: true } },
      },
    ],
  };

  it("leaves out both sitemapExclude and robots.noindex entities", () => {
    const body = renderStoreLlmsTxt(source(rows));

    expect(body).toContain("/conditions/kept");
    expect(body).not.toContain("/conditions/hidden");
    expect(body).not.toContain("/conditions/noindexed");
  });

  it("keeps a nofollow-only entity — that is a claim about its links", () => {
    const body = renderStoreLlmsTxt(
      source({
        conditions: [
          {
            slug: "nofollow",
            name: "Nofollow",
            description: "",
            seo: { robots: { nofollow: true } },
          },
        ],
      }),
    );

    expect(body).toContain("/conditions/nofollow");
  });

  it("goes dormant on Basic, like every other indexing control", () => {
    // Unreachable through the route (it 404s Basic) and asserted anyway: the
    // builder must not be the place the dormancy rule is different.
    const body = renderStoreLlmsTxt(source({ ...rows, plan: "basic" }));

    expect(body).toContain("/conditions/hidden");
    expect(body).toContain("/conditions/noindexed");
  });

  it("reads both flags through the shared predicates", () => {
    expect(isSitemapExcluded({ sitemapExclude: true }, true)).toBe(true);
    expect(isSitemapExcluded({ sitemapExclude: true }, false)).toBe(false);
    expect(isEntityNoindexed({ robots: { noindex: true } }, true)).toBe(true);
    expect(isEntityNoindexed({ robots: { noindex: true } }, false)).toBe(false);
    expect(isEntityNoindexed({ robots: { nofollow: true } }, true)).toBe(false);
    // Fail-closed on a shape nobody wrote through the editor.
    expect(isEntityNoindexed({ robots: "noindex" }, true)).toBe(false);
    expect(isEntityNoindexed("not-an-object", true)).toBe(false);
  });
});

describe("llms.txt — the render budget", () => {
  function products(count: number) {
    return Array.from({ length: count }, (_, index) => ({
      drGreenStrainId: `strain-${index}`,
      name: `Strain ${index}`,
      description: "",
    }));
  }

  it("renders every row, and says nothing, when the list fits", () => {
    const body = renderStoreLlmsTxt(
      source({ products: products(LLMS_TXT_MAX_PRODUCTS) }),
    );

    expect(body).toContain(`/products/strain-${LLMS_TXT_MAX_PRODUCTS - 1}`);
    expect(body).not.toContain("listed above");
  });

  it("truncates over budget and SAYS SO, with the complete list's URL", () => {
    const body = renderStoreLlmsTxt(
      source({ products: products(LLMS_TXT_MAX_PRODUCTS + 5) }),
    );

    expect(body).toContain(`/products/strain-${LLMS_TXT_MAX_PRODUCTS - 1}`);
    expect(body).not.toContain(`/products/strain-${LLMS_TXT_MAX_PRODUCTS}`);
    expect(body).toContain(
      `${LLMS_TXT_MAX_PRODUCTS} of ${LLMS_TXT_MAX_PRODUCTS + 5} listed above. The complete list is at ${ORIGIN}/products.`,
    );
  });

  it("counts what is PUBLISHABLE, not what was fetched", () => {
    // An excluded row is not "left out by the budget" — it was never going to be
    // listed, and counting it would report a number the owner cannot reconcile.
    const body = renderStoreLlmsTxt(
      source({
        products: [
          ...products(LLMS_TXT_MAX_PRODUCTS),
          {
            drGreenStrainId: "excluded",
            name: "Excluded",
            description: "",
            seo: { sitemapExclude: true },
          },
        ],
      }),
    );

    expect(body).not.toContain("listed above");
  });

  it("budgets the Wire the same way", () => {
    const body = renderStoreLlmsTxt(
      source({
        posts: Array.from({ length: LLMS_TXT_MAX_POSTS + 1 }, (_, index) => ({
          slug: `post-${index}`,
          title: `Post ${index}`,
          excerpt: "",
        })),
      }),
    );

    expect(body).toContain(
      `${LLMS_TXT_MAX_POSTS} of ${LLMS_TXT_MAX_POSTS + 1} listed above.`,
    );
  });

  it("does not budget the conditions — a store's guides are its whole case", () => {
    const body = renderStoreLlmsTxt(
      source({
        conditions: Array.from({ length: 200 }, (_, index) => ({
          slug: `condition-${index}`,
          name: `Condition ${index}`,
          description: "",
        })),
      }),
    );

    expect(body).toContain("/conditions/condition-199");
    expect(body).not.toContain("listed above");
  });
});

describe("llms.txt — markdown safety", () => {
  it("escapes brackets in a link label so an owner-typed name cannot break it", () => {
    expect(escapeMarkdownText("Blue Dream [Reserve]")).toBe(
      "Blue Dream \\[Reserve\\]",
    );
    const body = renderStoreLlmsTxt(
      source({
        products: [
          {
            drGreenStrainId: STRAIN_ID,
            name: "Blue Dream [Reserve]",
            description: "",
          },
        ],
      }),
    );
    expect(body).toContain(`- [Blue Dream \\[Reserve\\]](${ORIGIN}/products/`);
  });

  it("collapses a newline in a name rather than splitting the list item", () => {
    const body = renderStoreLlmsTxt(
      source({
        conditions: [
          { slug: "multi", name: "Chronic\npain", description: "" },
        ],
      }),
    );

    expect(body).toContain("- [Chronic pain](");
  });

  it("percent-encodes parentheses in a URL, which new URL leaves alone", () => {
    expect(escapeMarkdownUrl("https://x.test/a(b)c")).toBe(
      "https://x.test/a%28b%29c",
    );
    const body = renderStoreLlmsTxt(
      source({
        conditions: [{ slug: "pain(acute)", name: "Pain", description: "" }],
      }),
    );

    expect(body).toContain(`(${ORIGIN}/conditions/pain%28acute%29)`);
  });
});

describe("llms.txt route — plan gate and host", () => {
  it("404s a Basic tenant rather than publishing an empty file", async () => {
    getCurrentTenant.mockResolvedValue({ ...tenantRow, plan: "basic" });

    const response = await llmsTxt();

    expect(response.status).toBe(404);
    expect(prismaMock.products.findMany).not.toHaveBeenCalled();
    expect(prismaMock.posts.findMany).not.toHaveBeenCalled();
    expect(prismaMock.conditions.findMany).not.toHaveBeenCalled();
  });

  it("404s on an unreadable plan — fail-closed, the recoverable direction", async () => {
    getCurrentTenant.mockResolvedValue({ ...tenantRow, plan: "enterprise-2" });
    expect((await llmsTxt()).status).toBe(404);

    getCurrentTenant.mockResolvedValue({ ...tenantRow, plan: null });
    expect((await llmsTxt()).status).toBe(404);
  });

  it("publishes for trial, pro and custom", async () => {
    for (const plan of PLANS.filter((candidate) => candidate !== "basic")) {
      getCurrentTenant.mockResolvedValue({ ...tenantRow, plan });
      expect((await llmsTxt()).status).toBe(200);
    }
  });

  it("404s an unresolved or inactive tenant", async () => {
    getCurrentTenant.mockResolvedValue(null);
    expect((await llmsTxt()).status).toBe(404);

    getCurrentTenant.mockResolvedValue({ ...tenantRow, isActive: false });
    expect((await llmsTxt()).status).toBe(404);
  });

  it("serves utf-8 plain text, cached like the sitemap", async () => {
    const response = await llmsTxt();

    expect(response.headers.get("Content-Type")).toBe(
      "text/plain; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=3600, s-maxage=3600",
    );
  });

  it("publishes primary-host URLs on a custom domain", async () => {
    getCurrentTenant.mockResolvedValue({
      ...tenantRow,
      customDomain: "acme.example",
    });

    const body = await (await llmsTxt()).text();

    expect(body).toContain("- Store: https://acme.example");
    for (const url of links(body)) {
      expect(url.startsWith("https://acme.example")).toBe(true);
    }
    expect(body).not.toContain(ORIGIN);
  });

  it("scopes every query by tenantId and filters to what is published", async () => {
    await llmsTxt();

    expect(prismaMock.conditions.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID, published: true },
      }),
    );
    expect(prismaMock.posts.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_ID, published: true },
        orderBy: { createdAt: "desc" },
      }),
    );
    expect(prismaMock.products.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: TENANT_ID,
          deletedAt: null,
          drGreenStrainId: { not: null },
        },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      }),
    );
  });

  it("renders the live rows, exclusions honoured end to end", async () => {
    prismaMock.products.findMany.mockResolvedValue([
      { drGreenStrainId: STRAIN_ID, name: "Blue Dream", description: "Hybrid." },
      {
        drGreenStrainId: "hidden-strain",
        name: "Hidden",
        description: "",
        seo: { sitemapExclude: true },
      },
    ]);

    const body = await (await llmsTxt()).text();

    expect(body).toContain(`${ORIGIN}/products/${STRAIN_ID}`);
    expect(body).not.toContain("hidden-strain");
  });

  it("takes the summary from the authored homepage description, then the tagline", async () => {
    getCurrentTenant.mockResolvedValue({
      ...tenantRow,
      pageSeo: { home: { description: "Authored for search." } },
      settings: { tagline: "The tagline." },
    });
    expect(await (await llmsTxt()).text()).toContain("> Authored for search.");

    getCurrentTenant.mockResolvedValue({
      ...tenantRow,
      settings: { tagline: "The tagline." },
    });
    expect(await (await llmsTxt()).text()).toContain("> The tagline.");

    getCurrentTenant.mockResolvedValue(tenantRow);
    expect(await (await llmsTxt()).text()).toContain(
      `> ${defaultLlmsTxtSummary("Acme Cannabis")}`,
    );
  });

  it("survives a settings blob nothing can parse", async () => {
    getCurrentTenant.mockResolvedValue({
      ...tenantRow,
      settings: "not-json-at-all",
      pageSeo: 7,
    });

    const response = await llmsTxt();

    expect(response.status).toBe(200);
    expect(await response.text()).toContain(
      `> ${defaultLlmsTxtSummary("Acme Cannabis")}`,
    );
  });
});

describe("llms.txt — the honest framing (AC)", () => {
  const copy = Object.values(LLMS_TXT_HONESTY_COPY).join(" ");

  it("states it is a proposed standard nobody has committed to", () => {
    expect(copy).toContain("proposed standard");
    expect(copy.toLowerCase()).toContain("not one any ai company has committed");
  });

  it("states the adoption figure and the absence of a measured lift", () => {
    expect(copy).toContain("10%");
    expect(copy).toContain("300,000 domains");
    expect(copy).toContain("no measurable change in AI citations");
  });

  it("states the cost, which is the actual case for it", () => {
    expect(copy).toContain("costs nothing");
  });

  it("makes no claim about citations or ranking, and says so outright", () => {
    // The words a card that WAS overselling would reach for. Asserted as an
    // absence because the failure mode is a well-meaning copy edit, not a lie:
    // "helps you get cited" reads as reasonable and is exactly the claim the
    // 300,000-domain study failed to find support for.
    for (const oversell of [
      "guarantee",
      "boost",
      "improve your ranking",
      "rank higher",
      "more traffic",
      "get you cited",
      "get cited more",
    ]) {
      expect(copy.toLowerCase()).not.toContain(oversell);
    }
    expect(copy).toContain(
      "Nobody can honestly tell you this will get your store cited more often",
    );
  });

  it("publishes at the one path the route serves", () => {
    expect(LLMS_TXT_PATH).toBe("/llms.txt");
    expect(storeCanonical({ subdomain: SUBDOMAIN, customDomain: null }, LLMS_TXT_PATH)).toBe(
      `${ORIGIN}/llms.txt`,
    );
  });
});
