import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// SEO Supercharge US-011 — the operator-controlled plan column and the
// entitlement matrix the #235 seam was built to consume.
//
// Three claims are pinned here, in ascending order of how expensive they'd be
// to get wrong:
//  1. resolution is fail-CLOSED — an unreadable plan lands on 'basic', never on
//     'trial' (which grants everything);
//  2. the plan gate is a real server boundary that composes with the permission
//     gate, not a UI decoration;
//  3. nothing in the resolution path reads Clerk — the column is the truth and
//     a Clerk outage cannot change what a tenant can do.
//
// Module-boundary mocks only (getCurrentUser, prisma, permission resolution,
// Clerk). The real auth wrapper, the real permission wrapper and the real plan
// gate all execute.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  tenants: { findFirst: vi.fn() },
}));
const clerkMock = vi.hoisted(() => ({
  clerkClient: vi.fn(),
  updateOrganizationMetadata: vi.fn(),
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));
vi.mock("@clerk/nextjs/server", () => ({ clerkClient: clerkMock.clerkClient }));

import {
  PLANS,
  DEFAULT_PLAN,
  FAIL_CLOSED_PLAN,
  isPlan,
  parsePlan,
  type Plan,
} from "@/lib/entitlements/plan";
import {
  FEATURES,
  featuresForPlan,
  getTenantFeatures,
  hasFeature,
  type FeatureKey,
} from "@/lib/entitlements/features";
import {
  getTenantPlan,
  requireFeature,
  UPGRADE_REQUIRED_CODE,
} from "@/lib/entitlements/require-feature";
import { mirrorPlanToClerkOrg } from "@/lib/entitlements/clerk-plan-mirror";
import {
  requirePermission,
  requirePermissionParams,
} from "@/lib/permissions/require-permission";
import { resolvePermissions } from "@/lib/permissions/resolve";

const TENANT_A = "tenant-a";
const CLERK_ORG = "org_abc123";

const ANALYTICS_KEYS: FeatureKey[] = [
  FEATURES.ANALYTICS_CORE,
  FEATURES.ANALYTICS_RETENTION,
  FEATURES.ANALYTICS_CAMPAIGNS,
  FEATURES.ANALYTICS_EXPORTS,
];

function adminUser(over: Record<string, unknown> = {}) {
  return {
    id: "admin_1",
    email: "admin@store.dev",
    name: "Admin",
    image: "",
    role: "TENANT_ADMIN",
    tenantId: TENANT_A,
    clerkOrgId: null,
    ...over,
  };
}

/** Run the REAL pure resolver so fixtures can't drift from production. */
function resolvedAs(teamRole: string | null) {
  return {
    teamRole,
    permissions: resolvePermissions({ role: "TENANT_ADMIN", teamRole }),
  };
}
const OWNER_ADMIN = () => resolvedAs("admin");
/** The `editor` preset grants neither SEO key. */
const NO_SEO_ACCESS = () => resolvedAs("editor");

function request(method = "POST") {
  return new NextRequest("http://store.dev/api/tenant-admin/seo/pro-thing", {
    method,
  });
}

/** Set what the plan column returns for the next lookup. */
function planColumn(plan: unknown) {
  prismaMock.tenants.findFirst.mockResolvedValue({ plan });
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(adminUser());
  resolveUserPermissions.mockResolvedValue(OWNER_ADMIN());
  planColumn("pro");
  clerkMock.clerkClient.mockResolvedValue({
    organizations: {
      updateOrganizationMetadata: clerkMock.updateOrganizationMetadata,
    },
  });
  clerkMock.updateOrganizationMetadata.mockResolvedValue({});
});

describe("parsePlan is exact-match and fails closed", () => {
  it.each(PLANS)("accepts the known plan %s", (plan) => {
    expect(parsePlan(plan)).toBe(plan);
    expect(isPlan(plan)).toBe(true);
  });

  // The AC's headline: an unreadable column value is treated as 'basic'. It is
  // deliberately NOT 'trial' — trial grants every feature, so a parse failure
  // resolving there would be a free upgrade for anyone who could corrupt a row.
  it.each([
    ["undefined (column not selected)", undefined],
    ["null", null],
    ["empty string", ""],
    ["wrong case", "PRO"],
    ["padded", " pro "],
    ["unknown tier", "enterprise"],
    ["a number", 42],
    ["an object", { plan: "pro" }],
    ["an array", ["pro"]],
    ["a boolean", true],
  ])("fails closed to basic on %s", (_label, value) => {
    expect(parsePlan(value)).toBe("basic");
    expect(isPlan(value)).toBe(false);
  });

  it("never resolves an unreadable value to the all-features trial plan", () => {
    expect(FAIL_CLOSED_PLAN).toBe("basic");
    expect(DEFAULT_PLAN).toBe("trial");
    expect(parsePlan("garbage")).not.toBe(DEFAULT_PLAN);
  });
});

describe("the plan → feature matrix", () => {
  it("grants every feature on trial, pro and custom", () => {
    for (const plan of ["trial", "pro", "custom"] as Plan[]) {
      const features = featuresForPlan(plan);
      for (const key of Object.values(FEATURES)) {
        expect(features.has(key)).toBe(true);
      }
    }
  });

  it("grants basic seo.core but NOT seo.pro", () => {
    const basic = featuresForPlan("basic");
    expect(basic.has(FEATURES.SEO_CORE)).toBe(true);
    expect(basic.has(FEATURES.SEO_PRO)).toBe(false);
  });

  // AC-2 is explicit that this story does not decide the analytics split — the
  // analytics module does, later. This pins the keys as unchanged on every
  // plan so a drive-by edit here has to argue with a red test.
  it.each(PLANS)("leaves every analytics key granted on %s", (plan) => {
    for (const key of ANALYTICS_KEYS) {
      expect(featuresForPlan(plan).has(key)).toBe(true);
    }
  });

  it("resolves the raw column value through getTenantFeatures", () => {
    expect(getTenantFeatures({ id: TENANT_A, plan: "pro" }).has(FEATURES.SEO_PRO))
      .toBe(true);
    expect(getTenantFeatures({ id: TENANT_A, plan: "basic" }).has(FEATURES.SEO_PRO))
      .toBe(false);
  });

  it("fails closed when a call site omits the plan entirely", () => {
    // The pre-column #235 call shape still compiles; it must degrade, not grant.
    const features = getTenantFeatures({ id: TENANT_A });
    expect(features.has(FEATURES.SEO_PRO)).toBe(false);
    expect(features.has(FEATURES.SEO_CORE)).toBe(true);
  });

  it("keeps hasFeature working over the string[] the client receives", () => {
    const wire = Array.from(getTenantFeatures({ id: TENANT_A, plan: "basic" }));
    expect(hasFeature(wire, FEATURES.ANALYTICS_RETENTION)).toBe(true);
    expect(hasFeature(wire, FEATURES.SEO_PRO)).toBe(false);
  });
});

describe("getTenantPlan reads the column and fails closed", () => {
  it("returns the column value, scoped to the calling tenant", async () => {
    planColumn("custom");

    expect(await getTenantPlan(TENANT_A)).toBe("custom");
    expect(prismaMock.tenants.findFirst).toHaveBeenCalledWith({
      where: { id: TENANT_A },
      select: { plan: true },
    });
  });

  it.each([
    ["a missing row", null],
    ["a row with a null plan", { plan: null }],
    ["a row with an unknown plan", { plan: "platinum" }],
  ])("falls back to basic on %s", async (_label, row) => {
    prismaMock.tenants.findFirst.mockResolvedValue(row);

    expect(await getTenantPlan(TENANT_A)).toBe("basic");
  });

  it("falls back to basic when the query throws, without propagating", async () => {
    prismaMock.tenants.findFirst.mockRejectedValue(new Error("connection reset"));

    await expect(getTenantPlan(TENANT_A)).resolves.toBe("basic");
  });
});

describe("requireFeature is a server boundary", () => {
  it("403s a basic tenant with the distinct upgrade_required shape", async () => {
    planColumn("basic");
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const route = requirePermission(
      "canEditSeo",
      requireFeature(FEATURES.SEO_PRO, handler),
    );

    const res = await route(request());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json).toEqual({
      error: expect.any(String),
      code: UPGRADE_REQUIRED_CODE,
      feature: FEATURES.SEO_PRO,
      plan: "basic",
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("leaks no internals in the denial body", async () => {
    planColumn("basic");
    const route = requirePermission(
      "canEditSeo",
      requireFeature(FEATURES.SEO_PRO, async () => NextResponse.json({ ok: true })),
    );

    const json = await (await route(request())).json();

    expect(JSON.stringify(json)).not.toMatch(/prisma|tenant-a|stack|at\s/i);
  });

  it("is distinguishable from a permission denial", async () => {
    // Same route, same status — different cause. The client must be able to
    // offer "upgrade" vs "ask your admin" without guessing.
    resolveUserPermissions.mockResolvedValue(NO_SEO_ACCESS());
    const route = requirePermission(
      "canEditSeo",
      requireFeature(FEATURES.SEO_PRO, async () => NextResponse.json({ ok: true })),
    );

    const res = await route(request());
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.code).toBeUndefined();
  });

  it("lets a pro tenant through to the handler", async () => {
    planColumn("pro");
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const route = requirePermission(
      "canEditSeo",
      requireFeature(FEATURES.SEO_PRO, handler),
    );

    expect((await route(request())).status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  // Trial is the 3-month launch window: those tenants must see Pro working, not
  // locked, or they never learn what they'd be buying.
  it.each(["trial", "custom"])("lets a %s tenant through", async (plan) => {
    planColumn(plan);
    const route = requirePermission(
      "canEditSeo",
      requireFeature(FEATURES.SEO_PRO, async () => NextResponse.json({ ok: true })),
    );

    expect((await route(request())).status).toBe(200);
  });

  it("forwards route params on the [param] wrapper", async () => {
    planColumn("pro");
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const route = requirePermissionParams(
      "canEditSeo",
      requireFeature(FEATURES.SEO_PRO, handler),
    );

    await route(request("PUT"), { params: { id: "prod-1" } });

    expect(handler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ tenantId: TENANT_A }),
      { id: "prod-1" },
    );
  });

  it("gates on the CALLER's tenant, never a body-supplied one", async () => {
    planColumn("pro");
    const route = requirePermission(
      "canEditSeo",
      requireFeature(FEATURES.SEO_PRO, async () => NextResponse.json({ ok: true })),
    );

    await route(request());

    expect(prismaMock.tenants.findFirst).toHaveBeenCalledWith({
      where: { id: TENANT_A },
      select: { plan: true },
    });
  });
});

describe("plan gate and permission gate compose", () => {
  it("denies on permission BEFORE spending a plan lookup", async () => {
    resolveUserPermissions.mockResolvedValue(NO_SEO_ACCESS());
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const route = requirePermission(
      "canEditSeo",
      requireFeature(FEATURES.SEO_PRO, handler),
    );

    expect((await route(request())).status).toBe(403);
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("401s an unauthenticated caller before either gate runs", async () => {
    getCurrentUser.mockResolvedValue(null);
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const route = requirePermission(
      "canEditSeo",
      requireFeature(FEATURES.SEO_PRO, handler),
    );

    expect((await route(request())).status).toBe(401);
    expect(resolveUserPermissions).not.toHaveBeenCalled();
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
    expect(handler).not.toHaveBeenCalled();
  });

  it("requires BOTH: an entitled tenant still needs the permission", async () => {
    planColumn("pro");
    resolveUserPermissions.mockResolvedValue(NO_SEO_ACCESS());
    const route = requirePermission(
      "canEditSeo",
      requireFeature(FEATURES.SEO_PRO, async () => NextResponse.json({ ok: true })),
    );

    expect((await route(request())).status).toBe(403);
  });

  it("requires BOTH: a permitted member still needs the plan", async () => {
    planColumn("basic");
    resolveUserPermissions.mockResolvedValue(OWNER_ADMIN());
    const route = requirePermission(
      "canEditSeo",
      requireFeature(FEATURES.SEO_PRO, async () => NextResponse.json({ ok: true })),
    );

    expect((await route(request())).status).toBe(403);
  });
});

describe("Clerk is never the source of truth", () => {
  it("resolves a gated request without touching Clerk at all", async () => {
    planColumn("basic");
    const route = requirePermission(
      "canEditSeo",
      requireFeature(FEATURES.SEO_PRO, async () => NextResponse.json({ ok: true })),
    );

    expect((await route(request())).status).toBe(403);
    expect(clerkMock.clerkClient).not.toHaveBeenCalled();
  });

  it("mirrors a plan onto the org's publicMetadata, merging other keys", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue({
      settings: { clerkOrgId: CLERK_ORG },
    });

    await expect(mirrorPlanToClerkOrg(TENANT_A, "pro")).resolves.toEqual({
      mirrored: true,
    });
    expect(clerkMock.updateOrganizationMetadata).toHaveBeenCalledWith(CLERK_ORG, {
      publicMetadata: { plan: "pro" },
    });
  });

  it("reports, never throws, when the tenant has no Clerk org", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue({ settings: {} });

    await expect(mirrorPlanToClerkOrg(TENANT_A, "pro")).resolves.toEqual({
      mirrored: false,
      reason: "no_clerk_org",
    });
    expect(clerkMock.updateOrganizationMetadata).not.toHaveBeenCalled();
  });

  it("reports, never throws, when the Clerk write fails", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue({
      settings: { clerkOrgId: CLERK_ORG },
    });
    clerkMock.updateOrganizationMetadata.mockRejectedValue(new Error("429"));

    await expect(mirrorPlanToClerkOrg(TENANT_A, "pro")).resolves.toEqual({
      mirrored: false,
      reason: "clerk_write_failed",
    });
  });

  // The whole point of the write-only mirror: a broken Clerk sync must not
  // change a single thing about what the tenant can do.
  it("keeps entitlements intact after a failed mirror", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue({
      settings: { clerkOrgId: CLERK_ORG },
    });
    clerkMock.updateOrganizationMetadata.mockRejectedValue(new Error("down"));
    await mirrorPlanToClerkOrg(TENANT_A, "pro");

    planColumn("pro");
    expect(await getTenantPlan(TENANT_A)).toBe("pro");
  });
});
