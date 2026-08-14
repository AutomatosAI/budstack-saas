import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// SEO Supercharge US-012 — the only writer of `tenants.plan`.
//
// Until billing exists this route decides what every tenant is entitled to, so
// the claims worth pinning are:
//  1. only a SUPER_ADMIN, same-origin, with a plan from the known four, can
//     move the column — everything else is refused before any write;
//  2. the column commits and is audited BEFORE Clerk is touched, so a Clerk
//     outage downgrades to a warning and never changes what a tenant gets;
//  3. re-submitting the current plan re-syncs the mirror without writing a
//     no-op row into the entitlement provenance trail.
//
// Module-boundary mocks only (getCurrentUser, prisma, the Clerk SDK). The real
// auth wrapper, the real same-origin guard, the real Zod schema, the real audit
// util and the real Clerk mirror all execute.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
  tenants: { findFirst: vi.fn(), update: vi.fn() },
  audit_logs: { create: vi.fn() },
}));
const clerkMock = vi.hoisted(() => ({
  clerkClient: vi.fn(),
  updateOrganizationMetadata: vi.fn(),
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@clerk/nextjs/server", () => ({ clerkClient: clerkMock.clerkClient }));

import { PATCH } from "@/app/api/super-admin/tenants/[id]/plan/route";
import { PLANS, type Plan } from "@/lib/entitlements/plan";
import { AUDIT_ACTIONS } from "@/lib/audit-log";

const TENANT_ID = "11111111-1111-1111-1111-111111111111";
const CLERK_ORG = "org_abc123";
const params = { params: { id: TENANT_ID } };

function superAdmin(over: Record<string, unknown> = {}) {
  return {
    id: "su_1",
    email: "ops@budstacks.io",
    name: "Operator",
    image: "",
    role: "SUPER_ADMIN",
    tenantId: null,
    clerkOrgId: null,
    impersonation: null,
    ...over,
  };
}

/** The row the route reads; `settings` also feeds the real Clerk mirror. */
function tenantRow(plan: string, settings: unknown = { clerkOrgId: CLERK_ORG }) {
  return { id: TENANT_ID, subdomain: "greenleaf", plan, settings };
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(
    `http://admin.budstacks.io/api/super-admin/tenants/${TENANT_ID}/plan`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "sec-fetch-site": "same-origin",
        ...headers,
      },
      body: JSON.stringify(body),
    },
  );
}

/** Nothing may reach the column or Clerk on a refused request. */
function expectNoWrites() {
  expect(prismaMock.tenants.update).not.toHaveBeenCalled();
  expect(prismaMock.audit_logs.create).not.toHaveBeenCalled();
  expect(clerkMock.updateOrganizationMetadata).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(superAdmin());
  prismaMock.tenants.findFirst.mockResolvedValue(tenantRow("basic"));
  prismaMock.tenants.update.mockResolvedValue(tenantRow("pro"));
  prismaMock.audit_logs.create.mockResolvedValue({ id: "audit_1" });
  clerkMock.clerkClient.mockResolvedValue({
    organizations: {
      updateOrganizationMetadata: clerkMock.updateOrganizationMetadata,
    },
  });
  clerkMock.updateOrganizationMetadata.mockResolvedValue({});
});

describe("only a super-admin may set a plan", () => {
  it("401s a tenant admin — before reading the tenant", async () => {
    getCurrentUser.mockResolvedValue(
      superAdmin({ role: "TENANT_ADMIN", tenantId: "tenant-a" }),
    );

    const res = await PATCH(request({ plan: "pro" }), params);

    expect(res.status).toBe(401);
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it("401s an unauthenticated caller", async () => {
    getCurrentUser.mockResolvedValue(null);

    expect((await PATCH(request({ plan: "pro" }), params)).status).toBe(401);
    expectNoWrites();
  });
});

describe("the write is same-origin only", () => {
  it("403s a request carrying no same-origin signal", async () => {
    const req = new NextRequest(
      `http://admin.budstacks.io/api/super-admin/tenants/${TENANT_ID}/plan`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan: "pro" }),
      },
    );

    const res = await PATCH(req, params);

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "CROSS_ORIGIN_BLOCKED" });
    expectNoWrites();
  });

  it("403s a cross-site request", async () => {
    const res = await PATCH(
      request({ plan: "pro" }, { "sec-fetch-site": "cross-site" }),
      params,
    );

    expect(res.status).toBe(403);
    expectNoWrites();
  });
});

describe("only the four known plans reach the column", () => {
  it.each([
    ["an unknown tier", { plan: "enterprise" }],
    ["a missing field", {}],
    ["a non-string", { plan: 5 }],
    ["a wrong-case value", { plan: "PRO" }],
    ["null", null],
  ])("400s %s", async (_name, body) => {
    const res = await PATCH(request(body), params);

    expect(res.status).toBe(400);
    expectNoWrites();
  });

  it.each(PLANS)("accepts %s", async (plan) => {
    prismaMock.tenants.findFirst.mockResolvedValue(tenantRow("basic"));

    const res = await PATCH(request({ plan }), params);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ plan });
  });

  it("400s a malformed tenant id before any lookup", async () => {
    const res = await PATCH(request({ plan: "pro" }), {
      params: { id: "not-a-uuid" },
    });

    expect(res.status).toBe(400);
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
  });

  it("404s an unknown tenant", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue(null);

    expect((await PATCH(request({ plan: "pro" }), params)).status).toBe(404);
    expectNoWrites();
  });
});

describe("a plan change commits the column, audits it, then mirrors", () => {
  it("writes the plan and returns the applied state", async () => {
    const res = await PATCH(request({ plan: "pro" }), params);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      plan: "pro",
      changed: true,
      mirrored: true,
      mirrorReason: null,
    });
    expect(prismaMock.tenants.update).toHaveBeenCalledWith({
      where: { id: TENANT_ID },
      data: { plan: "pro" },
    });
  });

  it("records the move in the audit trail with both ends of the change", async () => {
    await PATCH(request({ plan: "pro" }), params);

    expect(prismaMock.audit_logs.create).toHaveBeenCalledTimes(1);
    const row = prismaMock.audit_logs.create.mock.calls[0][0].data;
    expect(row).toMatchObject({
      action: AUDIT_ACTIONS.TENANT_PLAN_CHANGED,
      entityType: "Tenant",
      entityId: TENANT_ID,
      tenantId: TENANT_ID,
      userId: "su_1",
    });
    expect(row.metadata).toMatchObject({
      previousPlan: "basic",
      newPlan: "pro",
      subdomain: "greenleaf",
    });
  });

  it("records the RAW previous value when the column held something unrecognised", async () => {
    // Repair path: entitlements already treat this tenant as 'basic' (fail-closed
    // parse), but the trail must say what was actually there.
    prismaMock.tenants.findFirst.mockResolvedValue(tenantRow("enterprise"));

    await PATCH(request({ plan: "basic" }), params);

    expect(prismaMock.audit_logs.create.mock.calls[0][0].data.metadata).toMatchObject(
      { previousPlan: "enterprise", newPlan: "basic" },
    );
  });

  it("mirrors onto the Clerk org — AFTER the column has committed", async () => {
    await PATCH(request({ plan: "pro" }), params);

    expect(clerkMock.updateOrganizationMetadata).toHaveBeenCalledWith(CLERK_ORG, {
      publicMetadata: { plan: "pro" },
    });
    // Order is the safety argument: the authoritative write cannot be lost to a
    // Clerk failure that happens first.
    expect(
      prismaMock.tenants.update.mock.invocationCallOrder[0],
    ).toBeLessThan(clerkMock.updateOrganizationMetadata.mock.invocationCallOrder[0]);
  });
});

describe("Clerk is a warning channel, never a gate", () => {
  it("still 200s with the plan written when the Clerk write fails", async () => {
    clerkMock.updateOrganizationMetadata.mockRejectedValue(new Error("429"));

    const res = await PATCH(request({ plan: "pro" }), params);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      plan: "pro",
      changed: true,
      mirrored: false,
      mirrorReason: "clerk_write_failed",
    });
    expect(prismaMock.tenants.update).toHaveBeenCalledWith({
      where: { id: TENANT_ID },
      data: { plan: "pro" },
    });
  });

  it("reports a tenant with no Clerk org as an unsynced mirror, not a failure", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue(tenantRow("basic", {}));

    const res = await PATCH(request({ plan: "pro" }), params);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      changed: true,
      mirrored: false,
      mirrorReason: "no_clerk_org",
    });
    expect(prismaMock.tenants.update).toHaveBeenCalled();
  });
});

describe("re-submitting the current plan is a re-sync, not a change", () => {
  it("skips the column write and the audit row", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue(tenantRow("pro"));

    const res = await PATCH(request({ plan: "pro" }), params);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ plan: "pro", changed: false });
    expect(prismaMock.tenants.update).not.toHaveBeenCalled();
    expect(prismaMock.audit_logs.create).not.toHaveBeenCalled();
  });

  it("still pushes the mirror, so a failed sync can be retried", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue(tenantRow("pro"));

    await PATCH(request({ plan: "pro" }), params);

    expect(clerkMock.updateOrganizationMetadata).toHaveBeenCalledWith(CLERK_ORG, {
      publicMetadata: { plan: "pro" },
    });
  });
});

describe("the response never leaks internals", () => {
  it("returns only the plan contract fields", async () => {
    const res = await PATCH(request({ plan: "pro" }), params);
    const json = await res.json();

    expect(Object.keys(json).sort()).toEqual([
      "changed",
      "mirrorReason",
      "mirrored",
      "plan",
    ]);
  });

  it("keeps the validation message free of internals", async () => {
    const res = await PATCH(request({ plan: "enterprise" }), params);
    const json = await res.json();

    expect(json.error).not.toMatch(/prisma|clerk|stack|zod/i);
    // The message enumerates the accepted values — an operator-facing 400.
    for (const plan of PLANS as readonly Plan[]) {
      expect(json.error).toContain(plan);
    }
  });
});
