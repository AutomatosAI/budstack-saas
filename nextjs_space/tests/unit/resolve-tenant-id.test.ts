import { describe, it, expect, vi, beforeEach } from "vitest";

// PRD-205 US-004 (AC-1b / AC-2) — resolveTenantIdFromClerkOrg now delegates to the
// canonical resolveTenant({ kind: 'clerk' }). We override resolveTenant but keep the
// REAL isAmbiguousTenantResolution guard, so the "ambiguous -> null (deny, never a
// silent pick)" path is genuinely exercised, not stubbed.
const { resolveTenant } = vi.hoisted(() => ({ resolveTenant: vi.fn() }));
vi.mock("@/lib/tenant-resolver", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tenant-resolver")>()),
  resolveTenant,
}));

import { resolveTenantIdFromClerkOrg } from "@/lib/resolve-tenant-id";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("resolveTenantIdFromClerkOrg — clerk delegator", () => {
  it("returns the resolved tenant id and passes clerkOrgId + email through", async () => {
    resolveTenant.mockResolvedValueOnce({
      tenantId: "t-1",
      tenant: { id: "t-1", isActive: true },
    });

    const id = await resolveTenantIdFromClerkOrg("org_123", "a@x.io");

    expect(id).toBe("t-1");
    expect(resolveTenant).toHaveBeenCalledWith({
      kind: "clerk",
      clerkOrgId: "org_123",
      email: "a@x.io",
    });
  });

  it("returns null when nothing resolves", async () => {
    resolveTenant.mockResolvedValueOnce(null);
    await expect(resolveTenantIdFromClerkOrg("org_x", "a@x.io")).resolves.toBeNull();
  });

  it("returns null (deny) on an ambiguous resolution — never a silent first-row pick", async () => {
    resolveTenant.mockResolvedValueOnce({
      kind: "ambiguous",
      source: "clerk-email",
      email: "a@x.io",
      candidateCount: 2,
    });
    await expect(resolveTenantIdFromClerkOrg(null, "a@x.io")).resolves.toBeNull();
  });

  it("passes email: undefined through when no email is supplied", async () => {
    resolveTenant.mockResolvedValueOnce({
      tenantId: "t-1",
      tenant: { id: "t-1", isActive: true },
    });
    await resolveTenantIdFromClerkOrg("org_123");
    expect(resolveTenant).toHaveBeenCalledWith({
      kind: "clerk",
      clerkOrgId: "org_123",
      email: undefined,
    });
  });
});
