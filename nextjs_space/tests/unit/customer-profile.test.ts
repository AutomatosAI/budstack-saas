import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// PRD-203 US-005 — customer/profile is migrated to withAuth, which binds the
// HOST tenant around the handler. These tests prove the profile DB calls run
// INSIDE that host-tenant binding — the necessary condition for lib/db's tenant
// middleware to scope them, closing the prior host-blind `findFirst({where:{email}})`
// cross-tenant leak (AC-3).
//
// Module-boundary mocks: getCurrentUser, getTenantFromRequest, prisma. The
// context primitive (runWithTenantContextAsync / getTenantContext) runs REAL, so
// the scope observed at DB-call time is the genuine bound tenant. The middleware's
// actual row filtering against a real DB is proven in US-011 (Docker-gated).
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { getTenantFromRequest } = vi.hoisted(() => ({ getTenantFromRequest: vi.fn() }));
const { findFirst, update } = vi.hoisted(() => ({ findFirst: vi.fn(), update: vi.fn() }));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/tenant/tenant", () => ({ getTenantFromRequest }));
vi.mock("@/lib/db", () => ({ prisma: { users: { findFirst, update } } }));

import { getTenantContext } from "@/lib/tenant/tenant-context";
import { GET, PATCH } from "@/app/api/customer/profile/route";

function makeUser(over: Record<string, unknown> = {}) {
  return {
    id: "clerk_1",
    email: "cust@store.dev",
    name: "Cust Omer",
    image: "",
    role: "user",
    tenantId: null,
    clerkOrgId: null,
    ...over,
  };
}

const getReq = () =>
  new NextRequest("http://lekkerweed.store/api/customer/profile");
const patchReq = (body: unknown) =>
  new NextRequest("http://lekkerweed.store/api/customer/profile", {
    method: "PATCH",
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(makeUser());
  getTenantFromRequest.mockResolvedValue({ id: "host-tenant" });
});

describe("GET /api/customer/profile — host-tenant scoped (AC-3)", () => {
  it("runs the profile lookup inside the bound host tenant context", async () => {
    let scopeAtQuery: string | null = "unset";
    findFirst.mockImplementation(async () => {
      scopeAtQuery = getTenantContext();
      return { id: "u1", email: "cust@store.dev", tenantId: "host-tenant" };
    });

    const res = await GET(getReq());
    const json = await res.json();

    expect(scopeAtQuery).toBe("host-tenant");
    expect(res.status).toBe(200);
    expect(json.profile).toMatchObject({ id: "u1", tenantId: "host-tenant" });
  });

  it("returns 400 when the session carries no email — no DB query at all", async () => {
    getCurrentUser.mockResolvedValue(makeUser({ email: undefined }));

    const res = await GET(getReq());

    expect(res.status).toBe(400);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("returns 404 when no row matches in the host tenant (foreign customer misses)", async () => {
    findFirst.mockResolvedValue(null);

    const res = await GET(getReq());

    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated — wrapper enforced, handler skipped", async () => {
    getCurrentUser.mockResolvedValue(null);

    const res = await GET(getReq());

    expect(res.status).toBe(401);
    expect(findFirst).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/customer/profile — host-tenant scoped (AC-3)", () => {
  it("finds + updates inside the bound host tenant context", async () => {
    let findScope: string | null = "unset";
    findFirst.mockImplementation(async () => {
      findScope = getTenantContext();
      return { id: "u1" };
    });
    update.mockResolvedValue({ id: "u1", firstName: "New", email: "cust@store.dev" });

    const res = await PATCH(patchReq({ firstName: "New" }));
    const json = await res.json();

    expect(findScope).toBe("host-tenant");
    expect(res.status).toBe(200);
    expect(json.profile).toMatchObject({ id: "u1", firstName: "New" });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "u1" } }),
    );
  });

  it("returns 404 when the row is absent in the host tenant (update skipped)", async () => {
    findFirst.mockResolvedValue(null);

    const res = await PATCH(patchReq({ firstName: "New" }));

    expect(res.status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });
});
