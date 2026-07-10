import { describe, it, expect, vi, beforeEach } from "vitest";

// PRD-302 — getActiveAdminTenant() is the impersonation-aware "which tenant does
// this admin PAGE render?" resolver. The bug it fixes: pages that looked the
// tenant up by the logged-in user's own email showed the super-admin's HOME
// tenant while the banner showed the impersonated one. These tests lock in:
//   - normal admins → own tenant (unchanged, impersonation never consulted),
//   - impersonating super-admin → the TARGET tenant (never their own),
//   - the impersonated tenant overrides the super-admin's own tenant.
const { currentUser } = vi.hoisted(() => ({ currentUser: vi.fn() }));
const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
const { resolveActiveImpersonation } = vi.hoisted(() => ({
  resolveActiveImpersonation: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ currentUser }));
vi.mock("@/lib/db", () => ({ prisma: { users: { findFirst } } }));
vi.mock("@/lib/impersonation/resolve", () => ({ resolveActiveImpersonation }));

import { getActiveAdminTenant } from "@/lib/tenant/active-admin-tenant";

function clerkUser(role: string, id = "clerk_1", email = "admin@budstacks.io") {
  return {
    id,
    publicMetadata: { role },
    emailAddresses: [{ emailAddress: email }],
  };
}

const IMPERSONATION = {
  sessionId: "sess-1",
  tenantId: "tenant-lekker-weed",
  tenantBusinessName: "Lekker Weed",
  tenantSubdomain: "lekkerweed",
  tenantEmail: "owner@lekker.co",
  superAdminClerkId: "clerk_1",
  superAdminEmail: "admin@budstacks.io",
  startedAt: new Date(),
  expiresAt: new Date(Date.now() + 3600_000),
};

beforeEach(() => {
  currentUser.mockReset();
  findFirst.mockReset();
  resolveActiveImpersonation.mockReset();
});

describe("getActiveAdminTenant", () => {
  it("returns null when there is no Clerk user", async () => {
    currentUser.mockResolvedValue(null);
    expect(await getActiveAdminTenant()).toBeNull();
  });

  it("returns null for a non-admin role (never consults impersonation)", async () => {
    currentUser.mockResolvedValue(clerkUser("PATIENT"));
    expect(await getActiveAdminTenant()).toBeNull();
    expect(resolveActiveImpersonation).not.toHaveBeenCalled();
  });

  it("TENANT_ADMIN → own tenant; impersonation is never consulted", async () => {
    currentUser.mockResolvedValue(clerkUser("TENANT_ADMIN"));
    findFirst.mockResolvedValue({ tenantId: "tenant-own" });
    const active = await getActiveAdminTenant();
    expect(active).toMatchObject({
      role: "TENANT_ADMIN",
      tenantId: "tenant-own",
      isImpersonating: false,
    });
    expect(resolveActiveImpersonation).not.toHaveBeenCalled();
  });

  it("SUPER_ADMIN without a session → own tenant (unchanged behaviour)", async () => {
    currentUser.mockResolvedValue(clerkUser("SUPER_ADMIN"));
    resolveActiveImpersonation.mockResolvedValue(null);
    findFirst.mockResolvedValue({ tenantId: "tenant-healingbuds" });
    const active = await getActiveAdminTenant();
    expect(active).toMatchObject({
      role: "SUPER_ADMIN",
      tenantId: "tenant-healingbuds",
      isImpersonating: false,
    });
  });

  it("SUPER_ADMIN WITH a live session → the impersonated tenant, NOT their own", async () => {
    currentUser.mockResolvedValue(clerkUser("SUPER_ADMIN"));
    resolveActiveImpersonation.mockResolvedValue(IMPERSONATION);
    // Their own users row still points at HealingBuds — must be ignored.
    findFirst.mockResolvedValue({ tenantId: "tenant-healingbuds" });
    const active = await getActiveAdminTenant();
    expect(active).toMatchObject({
      role: "SUPER_ADMIN",
      tenantId: "tenant-lekker-weed",
      isImpersonating: true,
    });
    // The impersonated tenant short-circuits before the own-tenant lookup.
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("returns null for a super-admin with no session and no own tenant", async () => {
    currentUser.mockResolvedValue(clerkUser("SUPER_ADMIN"));
    resolveActiveImpersonation.mockResolvedValue(null);
    findFirst.mockResolvedValue(null);
    expect(await getActiveAdminTenant()).toBeNull();
  });
});
