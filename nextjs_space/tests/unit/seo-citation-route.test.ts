import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * LLM Visibility US-005 — the two gates on the citation route, and the shape it
 * hands the dashboard.
 *
 * THE CLAIM UNDER TEST is the one the PRD is explicit about: gating in the UI is
 * not gating. A Basic tenant's owner hitting this URL by hand gets a 403 with
 * `upgrade_required`, and a member without `canViewSeo` is refused BEFORE the
 * plan is ever looked up — so they never learn the store's plan.
 *
 * Module-boundary mocks only (getCurrentUser, prisma, permission resolution).
 * The real auth wrapper, the real permission gate, the real `requireFeature`
 * and the real store read all execute. Mirrors tests/unit/seo-audit-route.ts,
 * the US-023 precedent.
 */
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  tenants: { findFirst: vi.fn() },
  llm_citation_checks: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));

import { UPGRADE_REQUIRED_CODE } from "@/lib/entitlements/require-feature";
import { CITATION_HISTORY_LIMIT } from "@/lib/seo/citation-monitor";
import { GET as citationsRoute } from "@/app/api/tenant-admin/seo/citations/route";

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

function get() {
  return new NextRequest("http://localhost/api/tenant-admin/seo/citations", {
    method: "GET",
  });
}

/**
 * Two different readers hit `tenants.findFirst`: the plan gate asks for `plan`,
 * the connect-state asks for the Automatos columns. The mock answers by what was
 * selected so both can be steered independently, which is what lets a "Pro but
 * not connected" store be tested at all.
 */
function tenantRow(plan: string, apiKey: string | null) {
  prismaMock.tenants.findFirst.mockImplementation(
    async ({ select }: { select: Record<string, boolean> }) =>
      select.plan
        ? { plan }
        : { automatosApiKey: apiKey, automatosAgentId: null },
  );
}

function storedCheck(over: Record<string, unknown> = {}) {
  return {
    id: "check-1",
    engine: "workspace-default",
    prompt: "How does a patient legally access medical cannabis in Portugal?",
    cited: true,
    citedUrl: "https://acme.budstacks.io/products",
    mentionText: "…try acme.budstacks.io/products…",
    checkedAt: new Date("2026-08-17T04:00:00.000Z"),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(adminUser());
  resolveUserPermissions.mockResolvedValue({
    permissions: { canViewSeo: true, canEditSeo: true },
    teamRole: "OWNER",
  });
  tenantRow("pro", "ak_sec_stored");
  prismaMock.llm_citation_checks.findMany.mockResolvedValue([storedCheck()]);
});

describe("GET /api/tenant-admin/seo/citations — gates", () => {
  it("answers a Pro tenant with its checks", async () => {
    const response = await citationsRoute(get());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.connected).toBe(true);
    expect(body.checks).toHaveLength(1);
    // The timestamp crosses as an ISO STRING — a Date-typed prop that is really
    // a string is the #229 class of render crash.
    expect(body.checks[0].checkedAt).toBe("2026-08-17T04:00:00.000Z");
  });

  it("refuses a Basic tenant with upgrade_required", async () => {
    tenantRow("basic", "ak_sec_stored");
    const response = await citationsRoute(get());
    expect(response.status).toBe(403);

    const body = await response.json();
    expect(body.code).toBe(UPGRADE_REQUIRED_CODE);
    expect(body.feature).toBe("seo.pro");
    expect(body.plan).toBe("basic");
    // The plan gate refused before any check was read.
    expect(prismaMock.llm_citation_checks.findMany).not.toHaveBeenCalled();
  });

  it("lets a trial tenant in — the launch window sees Pro working", async () => {
    tenantRow("trial", "ak_sec_stored");
    expect((await citationsRoute(get())).status).toBe(200);
  });

  it("fails closed on an unrecognised plan value", async () => {
    tenantRow("enterprise-gold", "ak_sec_stored");
    const response = await citationsRoute(get());
    expect(response.status).toBe(403);
    expect((await response.json()).plan).toBe("basic");
  });

  it("refuses a member without canViewSeo before looking at the plan", async () => {
    resolveUserPermissions.mockResolvedValue({
      permissions: { canViewSeo: false, canEditSeo: false },
      teamRole: "STAFF",
    });

    const response = await citationsRoute(get());
    expect(response.status).toBe(403);

    const body = await response.json();
    // The permission wrapper's bare `{ error }` — never the plan's body, which
    // would tell a denied member what the store pays for.
    expect(body.code).toBeUndefined();
    expect(body.plan).toBeUndefined();
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
  });
});

describe("GET /api/tenant-admin/seo/citations — the read", () => {
  it("is scoped to the caller's tenant and bounded", async () => {
    await citationsRoute(get());

    const args = prismaMock.llm_citation_checks.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ tenantId: TENANT_A });
    expect(args.orderBy).toEqual({ checkedAt: "desc" });
    expect(args.take).toBe(CITATION_HISTORY_LIMIT);
  });

  it("tells an unconnected store to connect rather than showing an error", async () => {
    tenantRow("pro", null);
    prismaMock.llm_citation_checks.findMany.mockResolvedValue([]);

    const response = await citationsRoute(get());
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ connected: false, checks: [] });
  });

  it("never puts a credential in the response", async () => {
    const body = await (await citationsRoute(get())).text();
    expect(body).not.toContain("ak_sec_stored");
    expect(body).not.toContain("automatosApiKey");
  });

  it("reports a failed read as an error rather than an empty history", async () => {
    prismaMock.llm_citation_checks.findMany.mockRejectedValue(
      new Error("connection reset"),
    );

    const response = await citationsRoute(get());
    expect(response.status).toBe(500);
    expect((await response.json()).error).not.toContain("connection reset");
  });
});
