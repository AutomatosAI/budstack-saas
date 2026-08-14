import { describe, it, expect, vi, beforeEach } from "vitest";

// SEO Supercharge US-022 — indexing controls.
//
// The property this file exists to hold: a directive an owner sets is the
// directive a crawler receives, and a directive an owner is NOT entitled to set
// is neither rendered nor destroyed. Three surfaces have to agree about that —
// the metadata builders, the sitemap and the four PUT routes — so all three are
// exercised here rather than one being taken on trust.
//
// The routes run for real, through the shipped Zod schemas, the shipped
// permission wrapper and the shipped plan gate; only getCurrentUser, prisma and
// tenant resolution are mocked. The mocked `users` row resolves to a null
// teamRole — a legacy pre-teams admin, which resolvePermissions grants
// everything — so what a test failure means is a plan problem, never a role one.

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
  tenants: { findUnique: vi.fn(), findFirst: vi.fn() },
  users: { findFirst: vi.fn() },
  products: { findFirst: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  posts: { findFirst: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  conditions: { findFirst: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  $queryRaw: vi.fn(),
}));
const { getCurrentTenant } = vi.hoisted(() => ({ getCurrentTenant: vi.fn() }));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/tenant/tenant", () => ({ getCurrentTenant }));

import { NextRequest } from "next/server";

import { UPGRADE_REQUIRED_CODE } from "@/lib/entitlements/require-feature";
import {
  entitySeoWrite,
  isCanonicalOverrideUrl,
  isEmptyEntitySeo,
  readEntitySeo,
  withEntityImageAlt,
} from "@/lib/seo/entity-seo";
import {
  hasIndexingFields,
  isSitemapExcluded,
  seoIndexingDirectives,
} from "@/lib/seo/indexing";
import { buildConditionMetadata } from "@/lib/seo/condition-metadata";
import { buildStorePageMetadata } from "@/lib/seo/page-metadata";
import { buildPostMetadata } from "@/lib/seo/post-metadata";
import { buildProductMetadata } from "@/lib/seo/product-metadata";
import { buildStoreSitemapEntries } from "@/lib/seo/sitemap";
import { PUT as putPageSeo } from "@/app/api/tenant-admin/seo/pages/route";
import { PUT as putPostSeo } from "@/app/api/tenant-admin/seo/posts/[id]/route";
import { PUT as putProductSeo } from "@/app/api/tenant-admin/seo/products/[id]/route";
import { PUT as putConditionSeo } from "@/app/api/tenant-admin/seo/conditions/[id]/route";

const TENANT_A = "tenant-a";
const SUBDOMAIN = "acme";
const ORIGIN = `https://${SUBDOMAIN}.budstacks.io`;
const OTHER_URL = "https://acme.example/the-original";
const PRODUCT_ID = "b1d0f6c2-0000-4000-8000-000000000001";
const POST_ID = "b1d0f6c2-0000-4000-8000-000000000002";

const tenant = {
  businessName: "Acme Cannabis Co",
  subdomain: SUBDOMAIN,
  customDomain: null,
  tenantId: TENANT_A,
};

/** A record with every indexing control set. */
const ALL_RULES = {
  robots: { noindex: true, nofollow: true },
  canonicalOverride: OTHER_URL,
  sitemapExclude: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue({
    id: "user-1",
    email: "owner@acme.test",
    role: "TENANT_ADMIN",
    tenantId: TENANT_A,
  });
  prismaMock.users.findFirst.mockResolvedValue({
    id: "user-1",
    tenantId: TENANT_A,
    teamRole: null,
  });
  prismaMock.tenants.findFirst.mockResolvedValue({ plan: "pro" });
  prismaMock.$queryRaw.mockResolvedValue([{ pageSeo: {} }]);
  prismaMock.products.findFirst.mockResolvedValue({
    id: PRODUCT_ID,
    tenantId: TENANT_A,
    seo: null,
  });
  prismaMock.products.update.mockImplementation(
    async (args: { data: { seo: unknown } }) => ({ id: PRODUCT_ID, ...args.data }),
  );
  prismaMock.posts.findFirst.mockResolvedValue({
    id: POST_ID,
    tenantId: TENANT_A,
    seo: null,
  });
  prismaMock.posts.update.mockImplementation(
    async (args: { data: { seo: unknown } }) => ({ id: POST_ID, ...args.data }),
  );
  prismaMock.conditions.findFirst.mockResolvedValue({
    id: "anxiety",
    tenantId: TENANT_A,
    seo: null,
  });
  prismaMock.conditions.update.mockImplementation(
    async (args: { data: { seo: unknown } }) => ({ id: "anxiety", ...args.data }),
  );
});

describe("readEntitySeo — the indexing controls, parsed fail-closed", () => {
  it("keeps a flag only when it is exactly true", () => {
    expect(readEntitySeo({ robots: { noindex: true } }).robots).toEqual({
      noindex: true,
    });
    // "true", 1 and {} are the shapes a hand-edited column or a sloppy API
    // client produces. A robots value we cannot READ must render NOTHING —
    // guessing either de-indexes a page the owner wanted found or publishes one
    // they wanted hidden.
    for (const junk of ["true", 1, {}, [], null, "noindex"]) {
      expect(readEntitySeo({ robots: { noindex: junk } }).robots).toBeUndefined();
    }
  });

  it("drops the robots key entirely when both flags are off", () => {
    expect(
      readEntitySeo({ robots: { noindex: false, nofollow: false } }).robots,
    ).toBeUndefined();
  });

  it("keeps only an absolute https canonical override", () => {
    expect(readEntitySeo({ canonicalOverride: OTHER_URL }).canonicalOverride).toBe(
      OTHER_URL,
    );

    for (const rejected of [
      "/relative/path",
      "http://acme.example/page", // https-only: a canonical must not downgrade
      "example.com/page",
      "javascript:alert(1)",
      "https://",
      42,
      { url: OTHER_URL },
    ]) {
      expect(
        readEntitySeo({ canonicalOverride: rejected }).canonicalOverride,
      ).toBeUndefined();
    }
  });

  it("keeps sitemapExclude only when it is exactly true", () => {
    expect(readEntitySeo({ sitemapExclude: true }).sitemapExclude).toBe(true);
    for (const junk of ["true", 1, "yes", {}]) {
      expect(readEntitySeo({ sitemapExclude: junk }).sitemapExclude).toBeUndefined();
    }
  });

  it("is idempotent — parsing its own output changes nothing", () => {
    const once = readEntitySeo({ title: " T ", ...ALL_RULES });
    expect(readEntitySeo(once)).toEqual(once);
  });

  it("counts an indexing-only record as authored", () => {
    // Otherwise the SEO Manager badge says "Default" for a page the owner has
    // deliberately hidden, and the write routes clear the column on save.
    expect(isEmptyEntitySeo(readEntitySeo({ sitemapExclude: true }))).toBe(false);
    expect(isEmptyEntitySeo(readEntitySeo({}))).toBe(true);
  });

  it("refuses a canonical override longer than the column cap", () => {
    expect(isCanonicalOverrideUrl(`https://acme.example/${"a".repeat(2000)}`)).toBe(
      false,
    );
  });
});

describe("seoIndexingDirectives — Pro renders them, Basic goes dormant", () => {
  const source = (plan: unknown, seo: unknown) => ({
    tenantId: TENANT_A,
    plan,
    seo,
  });

  it("emits both directives whenever either flag is set", () => {
    // Next replaces the inherited robots wholesale, so a bare `nofollow` would
    // leave indexing to the crawler's default. Both are always stated.
    expect(
      seoIndexingDirectives(source("pro", { robots: { noindex: true } })).robots,
    ).toEqual({ index: false, follow: true });
    expect(
      seoIndexingDirectives(source("pro", { robots: { nofollow: true } })).robots,
    ).toEqual({ index: true, follow: false });
    expect(seoIndexingDirectives(source("pro", ALL_RULES)).robots).toEqual({
      index: false,
      follow: false,
    });
  });

  it("emits no robots key at all when nothing is set, so the platform default is inherited", () => {
    expect(seoIndexingDirectives(source("pro", { title: "T" })).robots).toBeUndefined();
  });

  it("renders nothing for a Basic tenant, however the rules got there", () => {
    expect(seoIndexingDirectives(source("basic", ALL_RULES))).toEqual({});
  });

  it("renders them for trial and custom, which hold seo.pro", () => {
    for (const plan of ["trial", "pro", "custom"]) {
      expect(seoIndexingDirectives(source(plan, ALL_RULES)).robots).toBeDefined();
    }
  });

  it("fails closed to Basic on an unreadable plan — never a free upgrade", () => {
    for (const plan of [undefined, null, "", "PRO", "enterprise", 7]) {
      expect(seoIndexingDirectives(source(plan, ALL_RULES))).toEqual({});
    }
  });
});

describe("metadata builders — the override beats the computed canonical", () => {
  it("applies to a static page, and only for Pro", () => {
    const pageSeo = { about: ALL_RULES };

    const pro = buildStorePageMetadata({
      pageKey: "about",
      businessName: tenant.businessName,
      subdomain: SUBDOMAIN,
      customDomain: null,
      pageSeo,
      tenantId: TENANT_A,
      plan: "pro",
    });
    expect(pro.alternates?.canonical).toBe(OTHER_URL);
    expect(pro.robots).toEqual({ index: false, follow: false });
    // og:url follows the canonical: both answer "which URL owns this content".
    expect(pro.openGraph?.url).toBe(OTHER_URL);

    const basic = buildStorePageMetadata({
      pageKey: "about",
      businessName: tenant.businessName,
      subdomain: SUBDOMAIN,
      customDomain: null,
      pageSeo,
      tenantId: TENANT_A,
      plan: "basic",
    });
    expect(basic.alternates?.canonical).toBe(`${ORIGIN}/about`);
    expect(basic.robots).toBeUndefined();
  });

  it("applies to a Wire article", () => {
    const post = {
      ...tenant,
      slug: "harvest-notes",
      title: "Harvest notes",
      excerpt: null,
      coverImage: null,
      createdAt: new Date("2026-01-02T03:04:05.000Z"),
      authorName: "Dr Green",
    };

    expect(
      buildPostMetadata({ ...post, plan: "pro", seo: ALL_RULES }).alternates
        ?.canonical,
    ).toBe(OTHER_URL);
    expect(buildPostMetadata({ ...post, plan: "pro", seo: ALL_RULES }).robots).toEqual(
      { index: false, follow: false },
    );
    expect(
      buildPostMetadata({ ...post, plan: "basic", seo: ALL_RULES }).alternates
        ?.canonical,
    ).toBe(`${ORIGIN}/the-wire/harvest-notes`);
  });

  it("applies to a product", () => {
    const product = {
      ...tenant,
      productId: PRODUCT_ID,
      name: "Blue Dream",
      description: null,
      imageUrl: null,
    };

    expect(
      buildProductMetadata({ ...product, plan: "pro", seo: ALL_RULES }).alternates
        ?.canonical,
    ).toBe(OTHER_URL);
    expect(
      buildProductMetadata({ ...product, plan: "basic", seo: ALL_RULES }).robots,
    ).toBeUndefined();
  });

  it("applies to a condition", () => {
    const condition = {
      ...tenant,
      slug: "anxiety",
      name: "Anxiety",
      description: null,
      image: null,
    };

    expect(
      buildConditionMetadata({ ...condition, plan: "pro", seo: ALL_RULES })
        .alternates?.canonical,
    ).toBe(OTHER_URL);
    expect(
      buildConditionMetadata({ ...condition, plan: "basic", seo: ALL_RULES })
        .alternates?.canonical,
    ).toBe(`${ORIGIN}/conditions/anxiety`);
  });

  it("degrades a malformed override to the page's own canonical", () => {
    // The parse drops it, so the builder never sees a value it would have to
    // decide about — and a store never emits a canonical that does not resolve.
    expect(
      buildStorePageMetadata({
        pageKey: "about",
        businessName: tenant.businessName,
        subdomain: SUBDOMAIN,
        customDomain: null,
        pageSeo: { about: { canonicalOverride: "not-a-url" } },
        tenantId: TENANT_A,
        plan: "pro",
      }).alternates?.canonical,
    ).toBe(`${ORIGIN}/about`);
  });
});

describe("sitemap — the excluded URLs, and only for Pro", () => {
  const rows = {
    tenant: { subdomain: SUBDOMAIN, customDomain: null },
    products: [
      { drGreenStrainId: "strain-1", updatedAt: null, seo: null },
      { drGreenStrainId: "strain-2", updatedAt: null, seo: { sitemapExclude: true } },
    ],
    posts: [{ slug: "kept", updatedAt: null, seo: null }],
    conditions: [
      { slug: "anxiety", updatedAt: null, seo: { sitemapExclude: true } },
    ],
    tenantId: TENANT_A,
    pageSeo: { about: { sitemapExclude: true } },
  };

  const locs = (plan: unknown) =>
    buildStoreSitemapEntries({ ...rows, plan }).map((entry) => entry.loc);

  it("drops an excluded static page, product, post and condition", () => {
    const published = locs("pro");

    expect(published).not.toContain(`${ORIGIN}/about`);
    expect(published).not.toContain(`${ORIGIN}/products/strain-2`);
    expect(published).not.toContain(`${ORIGIN}/conditions/anxiety`);
    // Everything unmarked is still published — exclusion is opt-in per entity.
    expect(published).toContain(`${ORIGIN}/products/strain-1`);
    expect(published).toContain(`${ORIGIN}/the-wire/kept`);
    expect(published).toContain(`${ORIGIN}/contact`);
  });

  it("publishes everything for a Basic tenant — the flags are dormant, not lost", () => {
    const published = locs("basic");

    expect(published).toContain(`${ORIGIN}/about`);
    expect(published).toContain(`${ORIGIN}/products/strain-2`);
    expect(published).toContain(`${ORIGIN}/conditions/anxiety`);
  });

  it("never excludes a page that carries no authored record", () => {
    // /products and /the-wire have no `pageSeo` key, so there is nowhere to
    // store a flag and nothing to look up.
    expect(locs("pro")).toEqual(
      expect.arrayContaining([`${ORIGIN}/products`, `${ORIGIN}/the-wire`]),
    );
  });

  it("ignores the flag when the plan cannot be read", () => {
    expect(isSitemapExcluded({ sitemapExclude: true }, false)).toBe(false);
    expect(isSitemapExcluded({ sitemapExclude: true }, true)).toBe(true);
  });
});

describe("hasIndexingFields — presence, not truthiness", () => {
  it("sees a field that is present and false", () => {
    // Lifting a noindex and clearing an override are Pro writes too; a gate that
    // only noticed truthy values would let a Basic tenant undo a Pro setup.
    expect(hasIndexingFields({ robots: { noindex: false } })).toBe(true);
    expect(hasIndexingFields({ canonicalOverride: "" })).toBe(true);
    expect(hasIndexingFields({ sitemapExclude: false })).toBe(true);
  });

  it("sees nothing in a body that carries only content fields", () => {
    expect(hasIndexingFields({})).toBe(false);
  });
});

describe("entitySeoWrite — refused is not erased", () => {
  it("takes the submitted controls when the caller may write them", () => {
    expect(
      entitySeoWrite({ sitemapExclude: true }, { title: "T", robots: { noindex: true } }),
    ).toEqual({ title: "T", robots: { noindex: true } });
  });

  it("carries the stored controls through a save that may not write them", () => {
    expect(
      entitySeoWrite(ALL_RULES, { title: "T" }, { preserveIndexing: true }),
    ).toEqual({ title: "T", ...readEntitySeo(ALL_RULES) });
  });

  it("still replaces the content fields on a preserving save", () => {
    expect(
      entitySeoWrite(
        { title: "old", description: "old", ...ALL_RULES },
        { title: "new" },
        { preserveIndexing: true },
      ),
    ).toEqual({ title: "new", ...readEntitySeo(ALL_RULES) });
  });

  it("ignores indexing fields smuggled into a preserving save", () => {
    expect(
      entitySeoWrite({}, { sitemapExclude: true }, { preserveIndexing: true }),
    ).toEqual({});
  });
});

describe("withEntityImageAlt — the Wire editor cannot delete a noindex", () => {
  it("carries the indexing controls through an alt-text-only write", () => {
    expect(withEntityImageAlt(ALL_RULES, "A greenhouse at dawn")).toEqual({
      imageAlt: "A greenhouse at dawn",
      ...readEntitySeo(ALL_RULES),
    });
  });

  it("still clears the alt without touching anything else", () => {
    expect(withEntityImageAlt({ imageAlt: "old", ...ALL_RULES }, "")).toEqual(
      readEntitySeo(ALL_RULES),
    );
  });
});

/** A PUT with a JSON body, as the SEO Manager sends it. */
function request(body: unknown): NextRequest {
  return new NextRequest("https://admin.budstacks.io/api/tenant-admin/seo", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("the PUT routes — the plan gate is the boundary, not the UI", () => {
  it("403s upgrade_required when a Basic tenant sends an indexing field", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue({ plan: "basic" });

    const response = await putProductSeo(
      request({ title: "T", sitemapExclude: true }),
      { params: { id: PRODUCT_ID } },
    );

    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe(UPGRADE_REQUIRED_CODE);
    expect(prismaMock.products.update).not.toHaveBeenCalled();
  });

  it("403s on every SEO route, not only the one with a UI for it", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue({ plan: "basic" });

    const responses = await Promise.all([
      putPostSeo(request({ robots: { noindex: true } }), { params: { id: POST_ID } }),
      putConditionSeo(request({ canonicalOverride: OTHER_URL }), {
        params: { id: "anxiety" },
      }),
      putPageSeo(
        request({ pageKey: "about", seo: { sitemapExclude: true } }),
      ),
    ]);

    expect(responses.map((response) => response.status)).toEqual([403, 403, 403]);
    // The CODE, not just the status: the permission wrapper also answers 403,
    // and a test that could not tell them apart would keep passing if the plan
    // gate were removed.
    const bodies = await Promise.all(
      responses.map((response) => response.json()),
    );
    expect(bodies.map((body) => body.code)).toEqual([
      UPGRADE_REQUIRED_CODE,
      UPGRADE_REQUIRED_CODE,
      UPGRADE_REQUIRED_CODE,
    ]);
    expect(bodies.map((body) => body.feature)).toEqual([
      "seo.pro",
      "seo.pro",
      "seo.pro",
    ]);
    expect(prismaMock.posts.update).not.toHaveBeenCalled();
    expect(prismaMock.conditions.update).not.toHaveBeenCalled();
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });

  it("lets a Basic tenant save a title — the rest of the body is not Pro", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue({ plan: "basic" });

    const response = await putProductSeo(request({ title: "Blue Dream" }), {
      params: { id: PRODUCT_ID },
    });

    expect(response.status).toBe(200);
    // No plan lookup at all: the body asked for nothing that needed one.
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
  });

  it("stores what a Pro tenant sent", async () => {
    await putProductSeo(
      request({
        title: "Blue Dream",
        robots: { noindex: true, nofollow: false },
        canonicalOverride: OTHER_URL,
        sitemapExclude: true,
      }),
      { params: { id: PRODUCT_ID } },
    );

    expect(prismaMock.products.update.mock.calls[0][0].data.seo).toEqual({
      title: "Blue Dream",
      robots: { noindex: true },
      canonicalOverride: OTHER_URL,
      sitemapExclude: true,
    });
  });

  it("lets a Pro tenant clear a rule it set", async () => {
    prismaMock.products.findFirst.mockResolvedValue({
      id: PRODUCT_ID,
      tenantId: TENANT_A,
      seo: ALL_RULES,
    });

    await putProductSeo(
      request({
        title: "Blue Dream",
        robots: { noindex: false, nofollow: false },
        canonicalOverride: "",
        sitemapExclude: false,
      }),
      { params: { id: PRODUCT_ID } },
    );

    expect(prismaMock.products.update.mock.calls[0][0].data.seo).toEqual({
      title: "Blue Dream",
    });
  });

  it("preserves a downgraded tenant's stored rules through a Basic save", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue({ plan: "basic" });
    prismaMock.posts.findFirst.mockResolvedValue({
      id: POST_ID,
      tenantId: TENANT_A,
      seo: { title: "old", ...ALL_RULES },
    });

    await putPostSeo(request({ title: "new" }), { params: { id: POST_ID } });

    expect(prismaMock.posts.update.mock.calls[0][0].data.seo).toEqual({
      title: "new",
      ...readEntitySeo(ALL_RULES),
    });
  });

  it("rejects a canonical override that is not an absolute https URL", async () => {
    const response = await putProductSeo(
      request({ canonicalOverride: "/relative" }),
      { params: { id: PRODUCT_ID } },
    );

    expect(response.status).toBe(400);
    expect(prismaMock.products.update).not.toHaveBeenCalled();
  });

  it("rejects an unknown key beside the indexing ones — the schemas are still strict", async () => {
    const response = await putProductSeo(
      request({ noindex: true }),
      { params: { id: PRODUCT_ID } },
    );

    expect(response.status).toBe(400);
  });
});

describe("the pages route — one statement in both arms", () => {
  const statement = () => {
    const [sql] = prismaMock.$queryRaw.mock.calls.at(-1) ?? [];
    return {
      text: (sql?.strings ?? []).join(" "),
      values: sql?.values ?? [],
    };
  };

  it("rebuilds the entry in SQL when the caller sent no indexing field", async () => {
    await putPageSeo(request({ pageKey: "about", seo: { title: "About" } }));

    const { text, values } = statement();
    // The stored entry minus the CONTENT keys is what survives — the indexing
    // keys are never named, so a key added later is preserved by default.
    expect(text).toContain("jsonb_strip_nulls");
    expect(values).toEqual(
      expect.arrayContaining(["title", "description", "ogImage", "imageAlt"]),
    );
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it("replaces the entry wholesale when a Pro tenant sends the controls", async () => {
    await putPageSeo(
      request({
        pageKey: "about",
        seo: { title: "About", sitemapExclude: true },
      }),
    );

    const { values } = statement();
    expect(values).toContain(
      JSON.stringify({ about: { title: "About", sitemapExclude: true } }),
    );
    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
  });
});
