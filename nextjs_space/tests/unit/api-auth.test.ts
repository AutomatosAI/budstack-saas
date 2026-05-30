import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// PRD-203 US-003 — the api-auth wrappers must BIND tenant context (PRD-202's
// runWithTenantContextAsync) around the handler, not just check the role.
//
// Module-boundary mocks (allowed): getCurrentUser (auth resolver) and
// getTenantFromRequest (host resolver) are stubbed so no Clerk / DB is needed.
// The context primitive (runWithTenantContextAsync / getTenantContext /
// hasTenantContext) runs REAL — these tests prove each wrapper binds the right
// scope: withTenantAuth -> user.tenantId, withSuperAdmin -> explicit null,
// withAuth -> host tenant (and forwards Next's { params }).
vi.mock("@/lib/auth-helper", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/tenant", () => ({ getTenantFromRequest: vi.fn() }));

import { getCurrentUser } from "@/lib/auth-helper";
import { getTenantFromRequest } from "@/lib/tenant";
import { getTenantContext, hasTenantContext } from "@/lib/tenant-context";
import {
  withTenantAuth,
  withTenantAuthParams,
  withSuperAdmin,
  withSuperAdminParams,
  withAuth,
} from "@/lib/api-auth";

type AuthUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

const mockedUser = vi.mocked(getCurrentUser);
const mockedHost = vi.mocked(getTenantFromRequest);

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "user_1",
    email: "a@test.dev",
    name: "Test User",
    image: "",
    role: "TENANT_ADMIN",
    tenantId: "tenant-A",
    clerkOrgId: "org_1",
    ...overrides,
  };
}

// Mirror the repo's resolver-cast convention (with-tenant-context.test.ts).
const hostTenant = (id: string | null) =>
  (async () => (id ? { id } : null)) as typeof getTenantFromRequest;

const req = () => new NextRequest("http://store.test/api");
const ok = async () => NextResponse.json({});

beforeEach(() => {
  vi.clearAllMocks();
  mockedHost.mockImplementation(hostTenant(null));
});

describe("withTenantAuth — binds the user's tenant around the handler", () => {
  it("runs the handler inside runWithTenantContextAsync(user.tenantId)", async () => {
    mockedUser.mockResolvedValue(makeUser({ role: "TENANT_ADMIN", tenantId: "tenant-A" }));
    let seen: string | null = "unset";
    const wrapped = withTenantAuth(async (_r, { tenantId }) => {
      seen = getTenantContext();
      return NextResponse.json({ tenantId });
    });

    const res = await wrapped(req());

    expect(seen).toBe("tenant-A");
    expect(res.status).toBe(200);
    // Torn down after the handler settles — no leak into the caller.
    expect(getTenantContext()).toBeNull();
    expect(hasTenantContext()).toBe(false);
  });

  it("returns 401 (handler never runs) when there is no user", async () => {
    mockedUser.mockResolvedValue(null);
    const handler = vi.fn(ok);
    const res = await withTenantAuth(handler)(req());
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 401 when the role is neither TENANT_ADMIN nor SUPER_ADMIN", async () => {
    mockedUser.mockResolvedValue(makeUser({ role: "user" }));
    const handler = vi.fn(ok);
    const res = await withTenantAuth(handler)(req());
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns 403 when the user has no tenantId", async () => {
    mockedUser.mockResolvedValue(makeUser({ role: "TENANT_ADMIN", tenantId: null }));
    const handler = vi.fn(ok);
    const res = await withTenantAuth(handler)(req());
    expect(res.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("withSuperAdmin — binds an explicit null (deliberate cross-tenant scope)", () => {
  it("runs the handler inside runWithTenantContextAsync(null) with context bound", async () => {
    mockedUser.mockResolvedValue(makeUser({ role: "SUPER_ADMIN" }));
    let seenId: string | null = "unset";
    let bound = false;
    const wrapped = withSuperAdmin(async () => {
      seenId = getTenantContext();
      bound = hasTenantContext();
      return NextResponse.json({});
    });

    await wrapped(req());

    // Explicit null: id is null but a context WAS bound — the middleware treats
    // this as a deliberate system/super-admin query, not the unbound-leak bug.
    expect(seenId).toBeNull();
    expect(bound).toBe(true);
  });

  it("returns 401 for a non-super-admin (a tenant admin is not enough)", async () => {
    mockedUser.mockResolvedValue(makeUser({ role: "TENANT_ADMIN" }));
    const handler = vi.fn(ok);
    const res = await withSuperAdmin(handler)(req());
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("withAuth — binds the host tenant and forwards { params }", () => {
  it("binds the host-resolved tenant and passes Next's params as the 3rd arg", async () => {
    mockedUser.mockResolvedValue(makeUser({ role: "user", tenantId: null }));
    mockedHost.mockImplementation(hostTenant("host-tenant"));
    let seen: string | null = "unset";
    let receivedParams: unknown = null;
    const wrapped = withAuth(async (_r, _ctx, params) => {
      seen = getTenantContext();
      receivedParams = params;
      return NextResponse.json({});
    });

    await wrapped(req(), { params: { slug: "lekkerweed" } });

    expect(seen).toBe("host-tenant");
    expect(receivedParams).toEqual({ slug: "lekkerweed" });
  });

  it("binds an explicit null when the host resolves to no tenant", async () => {
    mockedUser.mockResolvedValue(makeUser({ role: "user", tenantId: null }));
    mockedHost.mockImplementation(hostTenant(null));
    let seenId: string | null = "unset";
    let bound = false;
    await withAuth(async () => {
      seenId = getTenantContext();
      bound = hasTenantContext();
      return NextResponse.json({});
    })(req());

    expect(seenId).toBeNull();
    expect(bound).toBe(true);
  });

  it("passes an empty params object for a non-param route (no route context)", async () => {
    mockedUser.mockResolvedValue(makeUser({ role: "user", tenantId: null }));
    let receivedParams: unknown = null;
    await withAuth(async (_r, _ctx, params) => {
      receivedParams = params;
      return NextResponse.json({});
    })(req());

    expect(receivedParams).toEqual({});
  });

  it("returns 401 (handler never runs) when there is no user", async () => {
    mockedUser.mockResolvedValue(null);
    const handler = vi.fn(ok);
    const res = await withAuth(handler)(req());
    expect(res.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe("params variants — forward params AND bind the same scope", () => {
  it("withTenantAuthParams binds user.tenantId and forwards params", async () => {
    mockedUser.mockResolvedValue(makeUser({ role: "TENANT_ADMIN", tenantId: "tenant-A" }));
    let seen: string | null = "unset";
    let receivedParams: unknown = null;
    const wrapped = withTenantAuthParams(async (_r, _ctx, params) => {
      seen = getTenantContext();
      receivedParams = params;
      return NextResponse.json({});
    });

    await wrapped(req(), { params: { id: "p1" } });

    expect(seen).toBe("tenant-A");
    expect(receivedParams).toEqual({ id: "p1" });
  });

  it("withSuperAdminParams binds null and forwards params", async () => {
    mockedUser.mockResolvedValue(makeUser({ role: "SUPER_ADMIN" }));
    let seenId: string | null = "unset";
    let bound = false;
    let receivedParams: unknown = null;
    const wrapped = withSuperAdminParams(async (_r, _ctx, params) => {
      seenId = getTenantContext();
      bound = hasTenantContext();
      receivedParams = params;
      return NextResponse.json({});
    });

    await wrapped(req(), { params: { id: "t1" } });

    expect(seenId).toBeNull();
    expect(bound).toBe(true);
    expect(receivedParams).toEqual({ id: "t1" });
  });
});
