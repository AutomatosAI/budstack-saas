import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// PRD-203 US-004 — getCurrentUser() hardening (AC-2 / AC-2a).
//
// Module-boundary mocks (allowed): Clerk's currentUser, the prisma client, and
// the canonical resolveTenant. We KEEP the REAL isAmbiguousTenantResolution
// guard (spread importOriginal) so the ambiguous -> 403 path is genuinely
// classified by production code, not stubbed — mirroring resolve-tenant-id.test.ts.
const { currentUser } = vi.hoisted(() => ({ currentUser: vi.fn() }));
const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
const { resolveTenant } = vi.hoisted(() => ({ resolveTenant: vi.fn() }));

vi.mock("@clerk/nextjs/server", () => ({ currentUser }));
vi.mock("@/lib/db", () => ({ prisma: { users: { findUnique } } }));
vi.mock("@/lib/tenant-resolver", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tenant-resolver")>()),
  resolveTenant,
}));

import {
  getCurrentUser,
  AmbiguousTenantError,
  UserNotProvisionedError,
} from "@/lib/auth-helper";

// Minimal structural stand-in for the fields getCurrentUser reads off a Clerk
// User. The mocked currentUser() return is untyped (any), so no cast is needed.
interface FakeClerkUser {
  id: string;
  publicMetadata: { role?: string; tenantId?: string | null };
  emailAddresses: Array<{ emailAddress: string }>;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  imageUrl: string;
}

function makeClerkUser(
  over: {
    id?: string;
    role?: string;
    clerkOrgId?: string | null;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
  } = {},
): FakeClerkUser {
  const {
    id = "clerk_1",
    role = "user",
    clerkOrgId = null,
    email = "a@test.dev",
    firstName = "Test",
    lastName = "User",
    username = "testuser",
  } = over;
  return {
    id,
    // Clerk stores the org id under publicMetadata.tenantId (see auth-helper).
    publicMetadata: { role, tenantId: clerkOrgId },
    emailAddresses: email == null ? [] : [{ emailAddress: email }],
    firstName,
    lastName,
    username,
    imageUrl: "https://img.test/a.png",
  };
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe("getCurrentUser — session gate", () => {
  it("returns null when there is no Clerk session", async () => {
    currentUser.mockResolvedValue(null);

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(resolveTenant).not.toHaveBeenCalled();
  });

  it("returns null (not a caught 500) when currentUser() throws an expired/invalid token", async () => {
    currentUser.mockRejectedValue(new Error("token expired"));

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(resolveTenant).not.toHaveBeenCalled();
  });
});

describe("getCurrentUser — tenant resolution (AC-2)", () => {
  it("returns the user scoped to the resolved tenant and skips the provisioning probe", async () => {
    currentUser.mockResolvedValue(
      makeClerkUser({
        id: "clerk_42",
        role: "TENANT_ADMIN",
        clerkOrgId: "org_1",
        email: "admin@acme.dev",
      }),
    );
    resolveTenant.mockResolvedValue({ tenantId: "t-1", tenant: { id: "t-1", isActive: true } });

    const result = await getCurrentUser();

    expect(result).toMatchObject({
      id: "clerk_42",
      email: "admin@acme.dev",
      role: "TENANT_ADMIN",
      tenantId: "t-1",
      clerkOrgId: "org_1",
      name: "Test User",
    });
    expect(resolveTenant).toHaveBeenCalledWith({
      kind: "clerk",
      clerkOrgId: "org_1",
      email: "admin@acme.dev",
    });
    // A resolved tenant already implies a provisioned row — no extra query.
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("throws AmbiguousTenantError (403) when the email maps to >1 active tenant — never a silent pick", async () => {
    currentUser.mockResolvedValue(makeClerkUser({ email: "shared@acme.dev" }));
    resolveTenant.mockResolvedValue({
      kind: "ambiguous",
      source: "clerk-email",
      email: "shared@acme.dev",
      candidateCount: 2,
    });

    const err = await getCurrentUser().catch((e) => e);

    expect(err).toBeInstanceOf(AmbiguousTenantError);
    expect(err.status).toBe(403);
    // We refuse to authenticate — no provisioning probe against an arbitrary tenant.
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe("getCurrentUser — provisioning race (AC-2a)", () => {
  it("throws UserNotProvisionedError (409) for a valid session with no DB row yet", async () => {
    currentUser.mockResolvedValue(makeClerkUser({ id: "clerk_new", email: "fresh@acme.dev" }));
    resolveTenant.mockResolvedValue(null);
    findUnique.mockResolvedValue(null);

    const err = await getCurrentUser().catch((e) => e);

    expect(err).toBeInstanceOf(UserNotProvisionedError);
    expect(err.status).toBe(409);
    expect(findUnique).toHaveBeenCalledWith({
      where: { email: "fresh@acme.dev" },
      select: { id: true },
    });
    // Audit event carries only the Clerk id (no PII) — see auth-helper.
    expect(warnSpy).toHaveBeenCalledWith(
      "auth.user_not_provisioned",
      expect.stringContaining("auth.user_not_provisioned"),
    );
  });

  it("returns the user (tenantId null) when a row exists but no tenant resolved (e.g. super-admin / unassigned)", async () => {
    currentUser.mockResolvedValue(
      makeClerkUser({ id: "clerk_super", role: "SUPER_ADMIN", email: "root@acme.dev" }),
    );
    resolveTenant.mockResolvedValue(null);
    findUnique.mockResolvedValue({ id: "user_root" });

    const result = await getCurrentUser();

    expect(result).toMatchObject({ id: "clerk_super", role: "SUPER_ADMIN", tenantId: null });
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("returns the user (tenantId null) and skips the probe when there is no email to key on", async () => {
    currentUser.mockResolvedValue(makeClerkUser({ email: null }));
    resolveTenant.mockResolvedValue(null);

    const result = await getCurrentUser();

    expect(result).toMatchObject({ tenantId: null });
    expect(result?.email).toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });
});
