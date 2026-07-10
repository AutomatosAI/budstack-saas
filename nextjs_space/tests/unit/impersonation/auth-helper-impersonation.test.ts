import { describe, it, expect, vi, beforeEach } from "vitest";

// PRD-302 — the getCurrentUser() impersonation seam. This is the security
// contract everything else stands on:
//   1. only a SUPER_ADMIN's cookie is even LOOKED AT (fail-closed),
//   2. a live session swaps ONLY tenantId — identity fields stay the real actor,
//   3. no session ⇒ byte-identical behaviour to pre-PRD-302.
const { currentUser } = vi.hoisted(() => ({ currentUser: vi.fn() }));
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
const { resolveTenant } = vi.hoisted(() => ({ resolveTenant: vi.fn() }));
const { resolveActiveImpersonation } = vi.hoisted(() => ({
  resolveActiveImpersonation: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ currentUser }));
vi.mock("@/lib/db", () => ({ prisma: { users: { findUnique } } }));
vi.mock("@/lib/tenant/tenant-resolver", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tenant/tenant-resolver")>()),
  resolveTenant,
}));
vi.mock("@/lib/impersonation/resolve", () => ({ resolveActiveImpersonation }));

import { getCurrentUser } from "@/lib/auth-helper";

function clerkUser(role: string, id = "clerk_1") {
  return {
    id,
    publicMetadata: { role, tenantId: null },
    emailAddresses: [{ emailAddress: "actor@budstacks.io" }],
    firstName: "Real",
    lastName: "Actor",
    username: "actor",
    imageUrl: "https://img.test/a.png",
  };
}

const ACTIVE_SESSION = {
  sessionId: "sess-1",
  tenantId: "tenant-impersonated",
  tenantBusinessName: "Herb Co",
  tenantSubdomain: "herbco",
  tenantEmail: "owner@herb.co",
  superAdminClerkId: "clerk_1",
  superAdminEmail: "actor@budstacks.io",
  startedAt: new Date(),
  expiresAt: new Date(Date.now() + 3600_000),
};

beforeEach(() => {
  currentUser.mockReset();
  findUnique.mockReset();
  resolveTenant.mockReset();
  resolveActiveImpersonation.mockReset();
  findUnique.mockResolvedValue({ id: "user_row" });
});

describe("getCurrentUser × impersonation (PRD-302)", () => {
  it("SUPER_ADMIN with a live session gets the impersonated tenantId but keeps their own identity", async () => {
    currentUser.mockResolvedValue(clerkUser("SUPER_ADMIN"));
    resolveTenant.mockResolvedValue(null); // super-admin has no tenant of their own
    resolveActiveImpersonation.mockResolvedValue(ACTIVE_SESSION);

    const user = await getCurrentUser();
    expect(user?.tenantId).toBe("tenant-impersonated");
    expect(user?.impersonation?.sessionId).toBe("sess-1");
    // Identity is NOT faked — audit rows record the real actor.
    expect(user?.id).toBe("clerk_1");
    expect(user?.email).toBe("actor@budstacks.io");
    expect(user?.role).toBe("SUPER_ADMIN");
  });

  it("SUPER_ADMIN without a session behaves exactly as before (tenantId null)", async () => {
    currentUser.mockResolvedValue(clerkUser("SUPER_ADMIN"));
    resolveTenant.mockResolvedValue(null);
    resolveActiveImpersonation.mockResolvedValue(null);

    const user = await getCurrentUser();
    expect(user?.tenantId).toBeNull();
    expect(user?.impersonation).toBeNull();
  });

  it("never consults the impersonation cookie for non-super-admin roles", async () => {
    currentUser.mockResolvedValue(clerkUser("TENANT_ADMIN"));
    resolveTenant.mockResolvedValue({
      tenantId: "own-tenant",
      tenant: { id: "own-tenant", isActive: true },
    });

    const user = await getCurrentUser();
    expect(resolveActiveImpersonation).not.toHaveBeenCalled();
    expect(user?.tenantId).toBe("own-tenant");
    expect(user?.impersonation).toBeNull();
  });

  it("impersonation never REPLACES a super-admin's own resolved tenant with a foreign one unless a session is live", async () => {
    currentUser.mockResolvedValue(clerkUser("SUPER_ADMIN"));
    resolveTenant.mockResolvedValue({
      tenantId: "root-own-tenant",
      tenant: { id: "root-own-tenant", isActive: true },
    });
    resolveActiveImpersonation.mockResolvedValue(null);

    const user = await getCurrentUser();
    expect(user?.tenantId).toBe("root-own-tenant");
  });
});
