import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// PRD-203 follow-up (PR #115 review) — tenant-scoping for the customer order
// read paths. Both GET handlers previously resolved the DB user by email ALONE
// (findFirst({where:{email}})), so a customer whose email exists in two stores
// could resolve to the wrong tenant's user row — and read that tenant's orders.
// The fix scopes the user lookup to the request's resolved tenant. These unit
// tests assert the explicit {email, tenantId} where; real-DB row filtering is
// proven separately in the Docker-gated integration suite.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { getTenantFromRequest, getCurrentTenant } = vi.hoisted(() => ({
  getTenantFromRequest: vi.fn(),
  getCurrentTenant: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  users: { findFirst: vi.fn() },
  orders: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/tenant/tenant", () => ({ getTenantFromRequest, getCurrentTenant }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
// Heavy POST-only deps — stubbed so importing the route module stays cheap and
// the GET-path tests don't drag in the email / Dr.Green clients.
vi.mock("@/lib/email/email", () => ({ sendEmail: vi.fn(), emailTemplates: {} }));
vi.mock("@/lib/drgreen/doctor-green-api", () => ({
  createOrder: vi.fn(),
  getCurrencyByCountry: vi.fn(() => "ZAR"),
}));
vi.mock("@/lib/tenant/tenant-config", () => ({ getTenantDrGreenConfig: vi.fn() }));

import { GET as ordersGet } from "@/app/api/orders/route";
import { GET as storeOrdersGet } from "@/app/api/store/[slug]/orders/route";

const TENANT_A = "tenant-a";
const EMAIL = "cust@store.dev";

function customer(over: Record<string, unknown> = {}) {
  return {
    id: "clerk_c",
    email: EMAIL,
    name: "Cust",
    image: "",
    role: "user",
    tenantId: null,
    clerkOrgId: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(customer());
  getTenantFromRequest.mockResolvedValue({ id: TENANT_A });
  getCurrentTenant.mockResolvedValue({ id: TENANT_A });
});

describe("GET /api/orders — user lookup scoped to host tenant (finding #3)", () => {
  it("scopes users.findFirst to {email, tenantId}", async () => {
    prismaMock.users.findFirst.mockResolvedValue(null);

    const res = await ordersGet(new NextRequest("http://store.dev/api/orders"));

    expect(prismaMock.users.findFirst).toHaveBeenCalledWith({
      where: { email: EMAIL, tenantId: TENANT_A },
    });
    // No matching user in THIS tenant → empty list, and no order query at all.
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ orders: [] });
    expect(prismaMock.orders.findMany).not.toHaveBeenCalled();
  });

  it("lists only the resolved tenant's orders for the matched user", async () => {
    prismaMock.users.findFirst.mockResolvedValue({
      id: "u_a",
      email: EMAIL,
      tenantId: TENANT_A,
    });
    prismaMock.orders.findMany.mockResolvedValue([]);

    await ordersGet(new NextRequest("http://store.dev/api/orders"));

    expect(prismaMock.orders.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u_a", tenantId: TENANT_A } }),
    );
  });
});

describe("GET /api/store/[slug]/orders — user lookup scoped to current tenant (finding #4)", () => {
  it("scopes users.findFirst to {email, tenantId}", async () => {
    prismaMock.users.findFirst.mockResolvedValue({
      id: "u_a",
      email: EMAIL,
      tenantId: TENANT_A,
    });
    prismaMock.orders.findMany.mockResolvedValue([]);

    await storeOrdersGet(
      new NextRequest("http://store.dev/api/store/lekkerweed/orders"),
      { params: { slug: "lekkerweed" } },
    );

    expect(prismaMock.users.findFirst).toHaveBeenCalledWith({
      where: { email: EMAIL, tenantId: TENANT_A },
    });
  });
});
