import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

// PRD-302 AC-5 — the api-auth wrappers must BIND the impersonation audit context
// around the handler whenever the caller is an impersonating super-admin, so
// createAuditLog auto-stamps impersonationSessionId. This is the property the
// security review flagged as untested: it must hold for EVERY wrapper, not just
// the tenant-admin ones (customer mutations run through withAuth).
//
// Module-boundary mocks: the two resolvers. The real impersonation ALS + tenant
// ALS run so we observe what the handler actually sees.
vi.mock("@/lib/auth-helper", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/tenant/tenant", () => ({ getTenantFromRequest: vi.fn() }));

import { getCurrentUser } from "@/lib/auth-helper";
import { getTenantFromRequest } from "@/lib/tenant/tenant";
import { getImpersonationContext } from "@/lib/impersonation/context";
import {
  withTenantAuth,
  withTenantAuthParams,
  withSuperAdmin,
  withAuth,
} from "@/lib/api-auth";

const mockedUser = vi.mocked(getCurrentUser);
const mockedHost = vi.mocked(getTenantFromRequest);

type AuthUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

const IMPERSONATION = {
  sessionId: "sess-42",
  tenantId: "tenant-impersonated",
  tenantBusinessName: "Herb Co",
  tenantSubdomain: "herbco",
  tenantEmail: "owner@herb.co",
  superAdminClerkId: "clerk_super",
  superAdminEmail: "support@budstacks.io",
  startedAt: new Date(),
  expiresAt: new Date(Date.now() + 3600_000),
};

function superAdmin(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "clerk_super",
    email: "support@budstacks.io",
    name: "Support",
    image: "",
    role: "SUPER_ADMIN",
    tenantId: "tenant-impersonated",
    clerkOrgId: null,
    impersonation: IMPERSONATION,
    ...overrides,
  } as AuthUser;
}

const req = () => new NextRequest("http://apex.test/api");

beforeEach(() => {
  mockedUser.mockReset();
  mockedHost.mockReset();
  mockedHost.mockResolvedValue(null as any);
});

describe("api-auth wrappers × impersonation stamping (AC-5)", () => {
  it("withTenantAuth binds the session context for an impersonating super-admin", async () => {
    mockedUser.mockResolvedValue(superAdmin());
    let seen: string | null = null;
    const handler = withTenantAuth(async () => {
      seen = getImpersonationContext()?.sessionId ?? null;
      return NextResponse.json({});
    });
    await handler(req());
    expect(seen).toBe("sess-42");
  });

  it("withTenantAuthParams binds the session context", async () => {
    mockedUser.mockResolvedValue(superAdmin());
    let seen: string | null = null;
    const handler = withTenantAuthParams(async () => {
      seen = getImpersonationContext()?.sessionId ?? null;
      return NextResponse.json({});
    });
    await handler(req(), { params: {} });
    expect(seen).toBe("sess-42");
  });

  it("withAuth binds the session context — customer mutations are covered", async () => {
    mockedUser.mockResolvedValue(superAdmin());
    let seen: string | null = null;
    const handler = withAuth(async () => {
      seen = getImpersonationContext()?.sessionId ?? null;
      return NextResponse.json({});
    });
    await handler(req(), { params: {} });
    expect(seen).toBe("sess-42");
  });

  it("withSuperAdmin binds the session context (console actions mid-session)", async () => {
    mockedUser.mockResolvedValue(superAdmin());
    let seen: string | null = null;
    const handler = withSuperAdmin(async () => {
      seen = getImpersonationContext()?.sessionId ?? null;
      return NextResponse.json({});
    });
    await handler(req());
    expect(seen).toBe("sess-42");
  });

  it("does NOT bind any context for a normal (non-impersonating) admin", async () => {
    mockedUser.mockResolvedValue(
      superAdmin({ role: "TENANT_ADMIN", tenantId: "tenant-A", impersonation: null }),
    );
    let seen: string | null | "unset" = "unset";
    const handler = withTenantAuth(async () => {
      seen = getImpersonationContext()?.sessionId ?? null;
      return NextResponse.json({});
    });
    await handler(req());
    expect(seen).toBeNull();
  });

  it("tears the context down after the handler settles", async () => {
    mockedUser.mockResolvedValue(superAdmin());
    const handler = withTenantAuth(async () => NextResponse.json({}));
    await handler(req());
    expect(getImpersonationContext()).toBeNull();
  });
});
