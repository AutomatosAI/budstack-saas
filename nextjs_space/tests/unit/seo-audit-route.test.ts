import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * SEO Supercharge US-023 — the two gates on the audit route, the queries behind
 * it, and the cache in front of it.
 *
 * THE CLAIM UNDER TEST is the one the PRD is explicit about: gating in the UI is
 * not gating. A Basic tenant's owner hitting this URL by hand gets a 403 with
 * `upgrade_required`, and a member without `canViewSeo` is refused BEFORE the
 * plan is ever looked up — so they never learn the store's plan.
 *
 * Module-boundary mocks only (getCurrentUser, prisma, permission resolution).
 * The real auth wrapper, the real permission gate, the real `requireFeature`,
 * the real cache and the real audit engine all execute. Mirrors
 * tests/unit/seo-redirect-routes.test.ts, the US-020 precedent.
 */
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  tenants: { findFirst: vi.fn() },
  products: { findMany: vi.fn() },
  // `count` is US-004's unpublished-drafts read — see the LLM-readiness block.
  posts: { findMany: vi.fn(), count: vi.fn() },
  conditions: { findMany: vi.fn() },
  seo_redirects: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));

import { UPGRADE_REQUIRED_CODE } from "@/lib/entitlements/require-feature";
import { resetSeoAuditCache } from "@/lib/seo/audit-cache";
import { SEO_AUDIT_MAX_ROWS_PER_TYPE } from "@/lib/seo/audit-types";
import { GET as auditRoute } from "@/app/api/tenant-admin/seo/audit/route";

const TENANT_A = "tenant-a";

function adminUser(tenantId = TENANT_A) {
  return {
    id: "admin_1",
    email: "admin@store.dev",
    name: "Admin",
    image: "",
    role: "TENANT_ADMIN",
    tenantId,
    clerkOrgId: null,
  };
}

function get(query = "") {
  return new NextRequest(
    `http://localhost/api/tenant-admin/seo/audit${query}`,
    { method: "GET" },
  );
}

/** The tenant row as both the audit query and `getTenantPlan` read it. */
function onPlan(plan: string, overrides: Record<string, unknown> = {}) {
  prismaMock.tenants.findFirst.mockResolvedValue({
    id: TENANT_A,
    subdomain: "acme",
    customDomain: null,
    plan,
    pageSeo: null,
    // US-004 reads both: the crawler policy lives in the settings blob, and the
    // Wire mode explains an unpublished-draft queue.
    settings: null,
    wireMode: "MANUAL",
    ...overrides,
  });
}

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    name: "Blue Dream",
    drGreenStrainId: "strain-1",
    images: [],
    seo: null,
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetSeoAuditCache();
  getCurrentUser.mockResolvedValue(adminUser());
  resolveUserPermissions.mockResolvedValue({
    permissions: { canViewSeo: true, canEditSeo: true },
    teamRole: "OWNER",
  });
  onPlan("pro");
  prismaMock.products.findMany.mockResolvedValue([]);
  prismaMock.posts.findMany.mockResolvedValue([]);
  prismaMock.posts.count.mockResolvedValue(0);
  prismaMock.conditions.findMany.mockResolvedValue([]);
  prismaMock.seo_redirects.findMany.mockResolvedValue([]);
});

describe("GET /api/tenant-admin/seo/audit — gates", () => {
  it("answers a Pro tenant with a scored audit", async () => {
    const response = await auditRoute(get());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(typeof body.audit.score).toBe("number");
    expect(body.audit.checks.length).toBeGreaterThan(0);
    expect(body.cached).toBe(false);
    expect(typeof body.generatedAt).toBe("string");
  });

  it("refuses a Basic tenant with upgrade_required", async () => {
    onPlan("basic");
    const response = await auditRoute(get());
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.code).toBe(UPGRADE_REQUIRED_CODE);
    expect(body.feature).toBe("seo.pro");
    expect(body.plan).toBe("basic");
    // The plan gate refused before any audit query ran.
    expect(prismaMock.products.findMany).not.toHaveBeenCalled();
  });

  it("lets a trial tenant in — the launch window sees Pro working", async () => {
    onPlan("trial");
    expect((await auditRoute(get())).status).toBe(200);
  });

  it("fails closed on an unrecognised plan value", async () => {
    onPlan("enterprise");
    const response = await auditRoute(get());
    expect(response.status).toBe(403);
    expect((await response.json()).plan).toBe("basic");
  });

  it("refuses a member without canViewSeo before looking at the plan", async () => {
    resolveUserPermissions.mockResolvedValue({
      permissions: { canViewSeo: false, canEditSeo: false },
      teamRole: "STAFF",
    });

    const response = await auditRoute(get());
    expect(response.status).toBe(403);

    const body = await response.json();
    // The permission wrapper's bare `{ error }` — never the plan's body, which
    // would tell a denied member what the store pays for.
    expect(body.code).toBeUndefined();
    expect(body.plan).toBeUndefined();
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
  });

  it("refuses an unauthenticated caller", async () => {
    getCurrentUser.mockResolvedValue(null);
    const response = await auditRoute(get());
    expect(response.status).toBe(401);
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
  });
});

describe("GET /api/tenant-admin/seo/audit — queries", () => {
  it("scopes every read to the caller's tenant", async () => {
    await auditRoute(get());

    const wheres = [
      prismaMock.tenants.findFirst,
      prismaMock.posts.findMany,
      prismaMock.conditions.findMany,
      prismaMock.seo_redirects.findMany,
      prismaMock.products.findMany,
    ].flatMap((mock) => mock.mock.calls.map((call) => call[0].where));

    expect(wheres.length).toBeGreaterThanOrEqual(5);
    for (const where of wheres) {
      expect(where.tenantId ?? where.id).toBe(TENANT_A);
    }
  });

  it("reads soft-deleted products in a query of their own", async () => {
    await auditRoute(get());

    const calls = prismaMock.products.findMany.mock.calls.map(
      (call) => call[0],
    );
    expect(calls).toHaveLength(2);

    // The live read leaves `deletedAt` to the soft-delete extension; the leak
    // read names it, which is what suppresses the injected filter.
    const live = calls.find((call) => call.where.deletedAt === undefined);
    const deleted = calls.find((call) => call.where.deletedAt !== undefined);
    expect(live).toBeDefined();
    expect(deleted?.where.deletedAt).toEqual({ not: null });
  });

  it("audits published posts and conditions only", async () => {
    await auditRoute(get());
    expect(prismaMock.posts.findMany.mock.calls[0][0].where.published).toBe(true);
    expect(
      prismaMock.conditions.findMany.mock.calls[0][0].where.published,
    ).toBe(true);
  });

  /**
   * US-004 — the LLM-readiness category's own inputs. The checks themselves are
   * covered row-by-row in tests/unit/seo-llm-audit.test.ts; what is asserted
   * here is the wiring only: the queries that feed them, scoped to the tenant,
   * and the settings blob reaching the crawler check through the route's parse.
   */
  it("counts unpublished drafts in a tenant-scoped query of their own", async () => {
    await auditRoute(get());

    expect(prismaMock.posts.count).toHaveBeenCalledTimes(1);
    expect(prismaMock.posts.count.mock.calls[0][0].where).toEqual({
      tenantId: TENANT_A,
      published: false,
    });
  });

  it("selects the two columns the LLM checks read and nothing more", async () => {
    await auditRoute(get());

    expect(prismaMock.posts.findMany.mock.calls[0][0].select.content).toBe(true);
    expect(prismaMock.conditions.findMany.mock.calls[0][0].select.faqs).toBe(
      true,
    );
  });

  it("reads the crawler policy out of the tenant's settings blob", async () => {
    onPlan("pro", { settings: { aiCrawlerPolicy: "blocked" } });

    const body = await (await auditRoute(get())).json();
    const blocked = body.audit.checks.find(
      (check: { check: string }) => check.check === "ai-search-blocked",
    );
    expect(blocked.total).toBe(1);
    expect(blocked.findings[0].target.tab).toBe("ai-crawlers");
  });

  it("treats a settings blob it cannot parse as no block at all", async () => {
    onPlan("pro", { settings: { aiCrawlerPolicy: { nope: true } } });

    const body = await (await auditRoute(get())).json();
    const blocked = body.audit.checks.find(
      (check: { check: string }) => check.check === "ai-search-blocked",
    );
    expect(blocked.total).toBe(0);
  });

  it("caps each entity type and says so when the cap is hit", async () => {
    prismaMock.products.findMany.mockImplementation(
      async ({ where }: { where: Record<string, unknown> }) =>
        where.deletedAt
          ? []
          : Array.from({ length: SEO_AUDIT_MAX_ROWS_PER_TYPE + 1 }, (_, i) =>
              product({ id: `p${i}`, drGreenStrainId: `strain-${i}` }),
            ),
    );

    const body = await (await auditRoute(get())).json();
    expect(body.audit.stats.truncated).toEqual(["products"]);
    expect(body.audit.stats.products).toBe(SEO_AUDIT_MAX_ROWS_PER_TYPE);
    expect(prismaMock.products.findMany.mock.calls[0][0].take).toBe(
      SEO_AUDIT_MAX_ROWS_PER_TYPE + 1,
    );
  });

  it("404s when the store row has gone", async () => {
    prismaMock.tenants.findFirst.mockImplementation(
      async ({ select }: { select: Record<string, unknown> }) =>
        // `getTenantPlan` asks for the plan alone and must still resolve, or the
        // gate would 403 before the 404 this case is about.
        select.subdomain ? null : { plan: "pro" },
    );

    const response = await auditRoute(get());
    expect(response.status).toBe(404);
  });
});

describe("GET /api/tenant-admin/seo/audit — cache", () => {
  it("serves the second call from cache without re-querying", async () => {
    await auditRoute(get());
    const cached = await (await auditRoute(get())).json();

    expect(cached.cached).toBe(true);
    // One live + one deleted read from the first call, and nothing since.
    expect(prismaMock.products.findMany).toHaveBeenCalledTimes(2);
  });

  it("refresh=1 recomputes", async () => {
    await auditRoute(get());
    const refreshed = await (await auditRoute(get("?refresh=1"))).json();

    expect(refreshed.cached).toBe(false);
    expect(prismaMock.products.findMany).toHaveBeenCalledTimes(4);
  });

  it("is keyed on the tenant, so an impersonated store gets its own audit", async () => {
    prismaMock.products.findMany.mockResolvedValueOnce([product()]);
    const first = await (await auditRoute(get())).json();

    // PRD-302: the impersonated tenant is what `ctx.tenantId` carries, and it
    // must not be answered from the operator's own cached result.
    getCurrentUser.mockResolvedValue(adminUser("tenant-b"));
    prismaMock.tenants.findFirst.mockResolvedValue({
      id: "tenant-b",
      subdomain: "beta",
      customDomain: null,
      plan: "pro",
      pageSeo: null,
    });
    prismaMock.products.findMany.mockResolvedValue([]);

    const second = await (await auditRoute(get())).json();
    expect(second.cached).toBe(false);
    expect(second.audit.stats.products).toBe(0);
    expect(first.audit.stats.products).toBe(1);
  });

  it("a failed run is not remembered as an answer", async () => {
    prismaMock.seo_redirects.findMany.mockRejectedValueOnce(
      new Error("connection lost"),
    );
    expect((await auditRoute(get())).status).toBe(500);

    const retry = await auditRoute(get());
    expect(retry.status).toBe(200);
    expect((await retry.json()).cached).toBe(false);
  });
});
