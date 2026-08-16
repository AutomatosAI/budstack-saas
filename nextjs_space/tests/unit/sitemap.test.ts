import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// SEO Supercharge US-006 — the sitemaps tell the truth.
//
// The property this file exists to hold: every URL a sitemap publishes resolves
// to a page that exists. Before this story the tenant sitemap emitted
// `/products/{products.slug}` and NO SUCH ROUTE EXISTS — a storefront product
// page is keyed by the Dr Green strain id — so 100% of the product entries were
// 404s. It also advertised soft-deleted products, listed `/faq` (a redirect to
// /support since US-002), and omitted condition detail pages entirely. The
// platform had no sitemap and no robots.txt at all.
//
// The tenant route runs for real; only prisma and tenant resolution are mocked,
// so what is asserted is the shipped query shape and the shipped XML.

const prismaMock = vi.hoisted(() => ({
  products: { findMany: vi.fn() },
  posts: { findMany: vi.fn() },
  conditions: { findMany: vi.fn() },
  learning_resources: { findMany: vi.fn() },
  platform_posts: { findMany: vi.fn() },
}));
const { getCurrentTenant } = vi.hoisted(() => ({ getCurrentTenant: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/tenant/tenant", () => ({ getCurrentTenant }));

import platformRobots from "@/app/robots";
import platformSitemap from "@/app/sitemap";
import { GET as storeSitemap } from "@/app/store/[slug]/sitemap.xml/route";
import { GUIDES, publishedGuides } from "@/lib/documents/registry";
import { storeCanonical } from "@/lib/seo/canonical";
import { platformBaseUrl } from "@/lib/seo/platform-url";
import {
  STORE_SITEMAP_STATIC_PAGES,
  buildStoreSitemapEntries,
  escapeXml,
  renderSitemapXml,
  sitemapLastmod,
} from "@/lib/seo/sitemap";
import { STORE_SEO_PAGES } from "@/lib/seo/store-pages";

const TENANT_ID = "tenant-a";
const SUBDOMAIN = "acme";
const ORIGIN = `https://${SUBDOMAIN}.budstacks.io`;

const tenant = {
  id: TENANT_ID,
  subdomain: SUBDOMAIN,
  customDomain: null,
  isActive: true,
};

const STRAIN_ID = "b1d0f6c2-0000-4000-8000-000000000001";

function locs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);
}

beforeEach(() => {
  getCurrentTenant.mockResolvedValue(tenant);
  prismaMock.products.findMany.mockResolvedValue([]);
  prismaMock.posts.findMany.mockResolvedValue([]);
  prismaMock.conditions.findMany.mockResolvedValue([]);
  prismaMock.learning_resources.findMany.mockResolvedValue([]);
  prismaMock.platform_posts.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("store sitemap — URL shape", () => {
  it("emits the id route for a product, never the dead slug route", async () => {
    // THE BUG. `products.slug` is a name-derived key that exists for the sync
    // upsert's (slug, tenantId) unique constraint; the URL names the Dr Green
    // strain (app/store/[slug]/products/product-card.tsx:59).
    prismaMock.products.findMany.mockResolvedValue([
      { drGreenStrainId: STRAIN_ID, updatedAt: new Date("2026-03-04T10:00:00Z") },
    ]);

    const xml = await (await storeSitemap()).text();

    expect(locs(xml)).toContain(`${ORIGIN}/products/${STRAIN_ID}`);
    expect(xml).not.toContain("/products/blue-dream");
  });

  it("drops a product that was never synced, rather than aliasing the listing", async () => {
    // `productPath(null)` falls back to /products, which the static list already
    // publishes — emitting it again would be a duplicate, not a page.
    prismaMock.products.findMany.mockResolvedValue([
      { drGreenStrainId: null, updatedAt: new Date() },
      { drGreenStrainId: "   ", updatedAt: new Date() },
    ]);

    const xml = await (await storeSitemap()).text();

    expect(locs(xml).filter((loc) => loc === `${ORIGIN}/products`)).toHaveLength(1);
  });

  it("publishes The Wire posts and condition detail pages", async () => {
    prismaMock.posts.findMany.mockResolvedValue([
      { slug: "harvest-notes", updatedAt: new Date("2026-01-02T00:00:00Z") },
    ]);
    prismaMock.conditions.findMany.mockResolvedValue([
      { slug: "chronic-pain", updatedAt: new Date("2026-01-03T00:00:00Z") },
    ]);

    const xml = await (await storeSitemap()).text();

    expect(locs(xml)).toContain(`${ORIGIN}/the-wire/harvest-notes`);
    // Conditions detail pages were absent from the sitemap entirely.
    expect(locs(xml)).toContain(`${ORIGIN}/conditions/chronic-pain`);
  });

  it("lists /support and no longer /faq", async () => {
    const xml = await (await storeSitemap()).text();
    const published = locs(xml);

    expect(published).toContain(`${ORIGIN}/support`);
    // app/store/[slug]/faq/page.tsx has been a redirect() to /support since US-002.
    expect(published).not.toContain(`${ORIGIN}/faq`);
  });

  it("uses the tenant's custom domain when it has one, like every canonical", async () => {
    getCurrentTenant.mockResolvedValue({ ...tenant, customDomain: "acme.example" });

    const xml = await (await storeSitemap()).text();

    expect(locs(xml).every((loc) => loc.startsWith("https://acme.example"))).toBe(
      true,
    );
  });
});

describe("store sitemap — filters", () => {
  it("asks for live products only, and only ones with a storefront page", async () => {
    await storeSitemap();

    expect(prismaMock.products.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT_ID,
        deletedAt: null,
        drGreenStrainId: { not: null },
      },
      // `seo` rides on the SAME query for US-022's sitemapExclude — one more
      // column, never a second read per row.
      select: { drGreenStrainId: true, updatedAt: true, seo: true },
    });
  });

  it("asks for published posts and published conditions, tenant-scoped", async () => {
    await storeSitemap();

    expect(prismaMock.posts.findMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID, published: true },
      select: { slug: true, updatedAt: true, seo: true },
    });
    expect(prismaMock.conditions.findMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID, published: true },
      select: { slug: true, updatedAt: true, seo: true },
    });
  });

  it("404s an unknown or deactivated store instead of publishing a URL set", async () => {
    getCurrentTenant.mockResolvedValue(null);
    expect((await storeSitemap()).status).toBe(404);

    getCurrentTenant.mockResolvedValue({ ...tenant, isActive: false });
    expect((await storeSitemap()).status).toBe(404);
  });

  it("serves cacheable XML", async () => {
    const response = await storeSitemap();

    expect(response.headers.get("Content-Type")).toBe("application/xml");
    expect(response.headers.get("Cache-Control")).toContain("max-age=3600");
  });
});

describe("store sitemap — lastmod", () => {
  it("carries updatedAt on dynamic entries and nothing on static ones", async () => {
    prismaMock.posts.findMany.mockResolvedValue([
      { slug: "harvest-notes", updatedAt: new Date("2026-01-02T09:30:00Z") },
    ]);

    const xml = await (await storeSitemap()).text();
    const post = xml.slice(xml.indexOf("harvest-notes"));

    expect(post).toContain("<lastmod>2026-01-02</lastmod>");
    // The homepage entry (first in the document) has no timestamp to report.
    expect(xml.slice(0, xml.indexOf("<lastmod>"))).toContain(`${ORIGIN}</loc>`);
  });

  it("omits lastmod rather than publishing 'Invalid Date'", () => {
    // A row can reach here as an ISO string through any JSON hop, and an
    // unparseable one stringifies instead of throwing.
    expect(sitemapLastmod(new Date("2026-05-06T00:00:00Z"))).toBe("2026-05-06");
    expect(sitemapLastmod("2026-05-06T00:00:00Z")).toBe("2026-05-06");
    expect(sitemapLastmod("not a date")).toBeUndefined();
    expect(sitemapLastmod(null)).toBeUndefined();
    expect(sitemapLastmod(undefined)).toBeUndefined();
    expect(sitemapLastmod({})).toBeUndefined();
  });
});

describe("sitemap serialisation", () => {
  it("entity-escapes a URL so one bad id cannot invalidate the document", () => {
    const xml = renderSitemapXml([{ loc: "https://acme.example/products/a&b" }]);

    expect(xml).toContain("<loc>https://acme.example/products/a&amp;b</loc>");
    expect(escapeXml(`<a href="x">'&'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&apos;&amp;&apos;&lt;/a&gt;",
    );
  });

  it("renders a valid empty urlset", () => {
    expect(renderSitemapXml([])).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        "</urlset>",
    );
  });

  it("publishes every authorable page, so the two lists cannot drift", () => {
    const paths = STORE_SITEMAP_STATIC_PAGES.map((page) => page.path);

    for (const page of STORE_SEO_PAGES) {
      expect(paths).toContain(page.path);
    }
    expect(paths).toContain("/products");
    expect(paths).toContain("/the-wire");
  });

  it("points every static entry at the same URL the page calls canonical", () => {
    const entries = buildStoreSitemapEntries({
      tenant: { subdomain: SUBDOMAIN, customDomain: null },
      products: [],
      posts: [],
      conditions: [],
    });

    for (const page of STORE_SITEMAP_STATIC_PAGES) {
      expect(entries.map((entry) => entry.loc)).toContain(
        storeCanonical({ subdomain: SUBDOMAIN, customDomain: null }, page.path),
      );
    }
  });
});

describe("platform sitemap + robots", () => {
  it("publishes the marketing pages and every published Learning Center article", async () => {
    prismaMock.learning_resources.findMany.mockResolvedValue([
      { slug: "getting-started", updatedAt: new Date("2026-02-01T00:00:00Z") },
    ]);

    const entries = await platformSitemap();
    const urls = entries.map((entry) => entry.url);
    const base = platformBaseUrl();

    expect(urls).toContain(base);
    expect(urls).toContain(`${base}/learn`);
    expect(urls).toContain(`${base}/marketplace`);
    expect(urls).toContain(`${base}/learn/getting-started`);
    expect(prismaMock.learning_resources.findMany).toHaveBeenCalledWith({
      where: { isPublished: true },
      select: { slug: true, updatedAt: true },
    });
  });

  it("publishes every published blog post, dated from updatedAt", async () => {
    // US-016 — /blog was listed and none of the articles under it were. Once
    // US-008/US-009 made the blog database-backed, nothing but the index linked
    // a post, so a publish had no route to discovery at all.
    prismaMock.platform_posts.findMany.mockResolvedValue([
      { slug: "the-economics-of-a-white-label-dispensary", updatedAt: new Date("2026-08-14T00:00:00Z") },
    ]);

    const entries = await platformSitemap();
    const base = platformBaseUrl();
    const post = entries.find(
      (entry) => entry.url === `${base}/blog/the-economics-of-a-white-label-dispensary`,
    );

    expect(post).toBeDefined();
    expect(post?.lastModified).toEqual(new Date("2026-08-14T00:00:00Z"));
    expect(post?.priority).toBe(0.6);
  });

  it("asks for published posts only, with no tenant predicate", async () => {
    // A draft must not be advertised. `published: true` is in the QUERY, so an
    // unpublished row never reaches the document — and no tenantId appears,
    // because `platform_posts` is deliberately outside `tenantScopedModels`
    // (an opt-in allowlist) and a tenant filter here would empty the apex.
    await platformSitemap();

    expect(prismaMock.platform_posts.findMany).toHaveBeenCalledWith({
      where: { published: true },
      select: { slug: true, updatedAt: true },
    });
  });

  it("publishes the guide index and every published guide", async () => {
    // The largest content set on the site (18 pages, 16 embedded videos),
    // public since #246/#249/#251 and absent from the sitemap until US-016.
    const urls = (await platformSitemap()).map((entry) => entry.url);
    const base = platformBaseUrl();

    expect(urls).toContain(`${base}/documents`);
    for (const guide of publishedGuides()) {
      expect(urls).toContain(`${base}/documents/${guide.slug}`);
    }
    // A `coming-soon` guide has no page — app/documents/[slug]/page.tsx calls
    // notFound() — so listing one would publish a 404. Every guide is published
    // today, which makes the loop below vacuous and the length check the one
    // that holds the property; both are here so that adding a coming-soon guide
    // fails loudly rather than shipping a 404 into the sitemap.
    for (const guide of GUIDES.filter((g) => g.status !== "published")) {
      expect(urls).not.toContain(`${base}/documents/${guide.slug}`);
    }
    expect(
      urls.filter((url) => url.startsWith(`${base}/documents/`)),
    ).toHaveLength(publishedGuides().length);
  });

  it("lists only routes a signed-out crawler can fetch", async () => {
    // Everything published here is in the middleware's isPublicRoute allowlist
    // (middleware.ts:8-46). /faq, /aup, /dpa, /regulatory and /legal/* are NOT,
    // so a crawler following them would get a Clerk sign-in redirect.
    const urls = (await platformSitemap()).map((entry) => entry.url);
    const base = platformBaseUrl();

    for (const gated of ["/faq", "/aup", "/dpa", "/regulatory", "/legal/subprocessors"]) {
      expect(urls).not.toContain(`${base}${gated}`);
    }
  });

  it("still serves the marketing pages when the database is down", async () => {
    prismaMock.learning_resources.findMany.mockRejectedValue(new Error("no db"));
    prismaMock.platform_posts.findMany.mockRejectedValue(new Error("no db"));

    const urls = (await platformSitemap()).map((entry) => entry.url);

    expect(urls).toContain(platformBaseUrl());
    expect(urls.some((url) => url.includes("/learn/"))).toBe(false);
    expect(urls.some((url) => url.includes("/blog/"))).toBe(false);
    // The guides are code, not rows — they survive an outage the two
    // database-backed sections do not.
    expect(urls).toContain(`${platformBaseUrl()}/documents/overview`);
  });

  it("takes its origin from the environment at call time", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.budstacks.io/");

    expect(platformBaseUrl()).toBe("https://staging.budstacks.io");
    expect((await platformSitemap())[0].url).toBe("https://staging.budstacks.io");
    expect(platformRobots().sitemap).toBe(
      "https://staging.budstacks.io/sitemap.xml",
    );
  });

  it("keeps crawlers off the admin surfaces and the /store/ rewrite target", () => {
    const robots = platformRobots();
    const rule = Array.isArray(robots.rules) ? robots.rules[0] : robots.rules;
    const disallow = rule?.disallow as string[];

    expect(rule?.allow).toBe("/");
    // /store/{slug} also serves on the apex (middleware.ts:207), duplicating
    // every storefront page at a second URL.
    expect(disallow).toContain("/store/");
    expect(disallow).toEqual(
      expect.arrayContaining(["/api/", "/tenant-admin/", "/super-admin/", "/auth/"]),
    );
    expect(robots.sitemap).toBe(`${platformBaseUrl()}/sitemap.xml`);
  });
});
