import { describe, it, expect, vi, beforeEach } from "vitest";

// PRD-302 — resolveActiveImpersonation cookie→session plumbing.
//
// Module-boundary mocks: next/headers (cookie jar), the prisma client, and the
// logger. The validity RULES stay real — rejectSessionRow is imported by the
// module under test, so ended/expired/foreign/tenant-dead paths are classified
// by production code (mirrors auth-helper.test.ts conventions).
const { cookiesMock } = vi.hoisted(() => ({ cookiesMock: vi.fn() }));
const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
const { warn } = vi.hoisted(() => ({ warn: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: cookiesMock }));
vi.mock("@/lib/db", () => ({
  prisma: { impersonation_sessions: { findFirst } },
}));
vi.mock("@/lib/logger", () => ({
  logger: { warn, info: vi.fn(), error: vi.fn() },
}));

import { resolveActiveImpersonation } from "@/lib/impersonation/resolve";
import { hashImpersonationToken } from "@/lib/impersonation/token";

const RAW = "a".repeat(64);
const FUTURE = new Date(Date.now() + 60 * 60 * 1000);
const PAST = new Date(Date.now() - 60 * 1000);

function jarWith(value: string | undefined) {
  return {
    get: (name: string) =>
      name === "bs_impersonation" && value !== undefined
        ? { name, value }
        : undefined,
  };
}

function dbRow(over: Record<string, unknown> = {}) {
  return {
    id: "sess-1",
    superAdminClerkId: "clerk_admin",
    superAdminEmail: "support@budstacks.io",
    tenantId: "tenant-1",
    tenantEmail: "owner@herb.co",
    startedAt: new Date("2026-07-10T10:00:00.000Z"),
    expiresAt: FUTURE,
    endedAt: null,
    tenants: {
      businessName: "Herb Co",
      subdomain: "herbco",
      isActive: true,
      deletedAt: null,
    },
    ...over,
  };
}

beforeEach(() => {
  cookiesMock.mockReset();
  findFirst.mockReset();
  warn.mockReset();
});

describe("resolveActiveImpersonation", () => {
  it("returns null with no cookie — and never touches the DB", async () => {
    cookiesMock.mockReturnValue(jarWith(undefined));
    expect(await resolveActiveImpersonation("clerk_admin")).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("returns null when cookies() throws (outside request scope)", async () => {
    cookiesMock.mockImplementation(() => {
      throw new Error("outside request scope");
    });
    expect(await resolveActiveImpersonation("clerk_admin")).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("looks the session up by TOKEN HASH, never the raw token", async () => {
    cookiesMock.mockReturnValue(jarWith(RAW));
    findFirst.mockResolvedValue(dbRow());
    await resolveActiveImpersonation("clerk_admin");
    const where = findFirst.mock.calls[0][0].where;
    expect(where.tokenHash).toBe(hashImpersonationToken(RAW));
    expect(JSON.stringify(where)).not.toContain(RAW);
  });

  it("maps a live owned session to ActiveImpersonation", async () => {
    cookiesMock.mockReturnValue(jarWith(RAW));
    findFirst.mockResolvedValue(dbRow());
    const active = await resolveActiveImpersonation("clerk_admin");
    expect(active).toMatchObject({
      sessionId: "sess-1",
      tenantId: "tenant-1",
      tenantBusinessName: "Herb Co",
      tenantSubdomain: "herbco",
      tenantEmail: "owner@herb.co",
      superAdminClerkId: "clerk_admin",
      superAdminEmail: "support@budstacks.io",
    });
  });

  it("rejects a session owned by a different Clerk user and logs the anomaly", async () => {
    cookiesMock.mockReturnValue(jarWith(RAW));
    findFirst.mockResolvedValue(dbRow({ superAdminClerkId: "clerk_other" }));
    expect(await resolveActiveImpersonation("clerk_admin")).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("rejects expired sessions quietly (no anomaly log)", async () => {
    cookiesMock.mockReturnValue(jarWith(RAW));
    findFirst.mockResolvedValue(dbRow({ expiresAt: PAST }));
    expect(await resolveActiveImpersonation("clerk_admin")).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("rejects ended sessions", async () => {
    cookiesMock.mockReturnValue(jarWith(RAW));
    findFirst.mockResolvedValue(dbRow({ endedAt: PAST }));
    expect(await resolveActiveImpersonation("clerk_admin")).toBeNull();
  });

  it("rejects sessions against an inactive or soft-deleted tenant", async () => {
    cookiesMock.mockReturnValue(jarWith(RAW));
    findFirst.mockResolvedValue(
      dbRow({
        tenants: {
          businessName: "Herb Co",
          subdomain: "herbco",
          isActive: false,
          deletedAt: null,
        },
      }),
    );
    expect(await resolveActiveImpersonation("clerk_admin")).toBeNull();
  });

  it("returns null for an unknown token", async () => {
    cookiesMock.mockReturnValue(jarWith(RAW));
    findFirst.mockResolvedValue(null);
    expect(await resolveActiveImpersonation("clerk_admin")).toBeNull();
  });
});
