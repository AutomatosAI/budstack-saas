import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock ONLY the auth seam the wrappers depend on (getCurrentUser). This is an
// auth-boundary mock, NOT a database mock — keeps the real Clerk server SDK out
// of the node test while exercising the wrapper logic (AC-11).
vi.mock("@/lib/auth-helper", () => ({ getCurrentUser: vi.fn() }));

import { getCurrentUser } from "@/lib/auth-helper";
import { NextRequest, NextResponse } from "next/server";
import { withTenantAuth, withSuperAdmin, withAuth } from "@/lib/api-auth";

const mockGetCurrentUser = vi.mocked(getCurrentUser);
const req = (path = "/api/test") => new NextRequest(`http://localhost${path}`);

beforeEach(() => {
  mockGetCurrentUser.mockReset();
});

describe("withTenantAuth", () => {
  it("rejects an unauthenticated caller with 401", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const handler = vi.fn();
    const res = await withTenantAuth(handler)(req());
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects an authenticated user with no tenant with 403", async () => {
    mockGetCurrentUser.mockResolvedValue({ role: "TENANT_ADMIN", tenantId: null } as any);
    const handler = vi.fn();
    const res = await withTenantAuth(handler)(req());
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes an authorized tenant admin through with the resolved tenantId", async () => {
    const user = { role: "TENANT_ADMIN", tenantId: "tenant-uuid-123" } as any;
    mockGetCurrentUser.mockResolvedValue(user);
    const handler = vi.fn(async (_req: NextRequest, ctx: { tenantId: string; user: unknown }) => {
      expect(ctx.tenantId).toBe("tenant-uuid-123");
      expect(ctx.user).toBe(user);
      return NextResponse.json({ ok: true });
    });
    const res = await withTenantAuth(handler)(req());
    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });
});

describe("withSuperAdmin", () => {
  it("rejects a non-super-admin caller with 401", async () => {
    mockGetCurrentUser.mockResolvedValue({ role: "TENANT_ADMIN", tenantId: "t1" } as any);
    const handler = vi.fn();
    const res = await withSuperAdmin(handler)(req());
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("passes a SUPER_ADMIN through", async () => {
    mockGetCurrentUser.mockResolvedValue({ role: "SUPER_ADMIN", tenantId: null } as any);
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const res = await withSuperAdmin(handler)(req());
    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });
});

describe("withAuth", () => {
  it("rejects when there is no logged-in user", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await withAuth(vi.fn())(req());
    expect(res.status).toBe(401);
  });

  it("passes any logged-in user through", async () => {
    mockGetCurrentUser.mockResolvedValue({ role: "user", tenantId: null } as any);
    const handler = vi.fn(async () => NextResponse.json({ ok: true }));
    const res = await withAuth(handler)(req());
    expect(handler).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });
});
