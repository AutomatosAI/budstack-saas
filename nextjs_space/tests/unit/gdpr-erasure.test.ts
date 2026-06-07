import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the DB at the unit boundary (allowed per PRD-213 test plan — a REAL
// Postgres integration test stays Docker-gated). Mock the audit-log sink so we
// can assert the audit metadata without touching the DB.
vi.mock("@/lib/db", () => ({
  prisma: {
    users: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    orders: { findMany: vi.fn() },
    consultations: { findMany: vi.fn() },
    consultation_questionnaires: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn(async () => undefined),
}));

import {
  eraseUser,
  exportUser,
  resolveLocalUser,
  buildAnonymizedUserData,
  isAlreadyErased,
  ERASURE_EMAIL_DOMAIN,
  ERASURE_AUDIT_ACTIONS,
} from "@/lib/gdpr/erasure";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/audit-log";

const mockedPrisma = prisma as unknown as Record<
  string,
  Record<string, ReturnType<typeof vi.fn>>
>;
const mockedAudit = createAuditLog as unknown as ReturnType<typeof vi.fn>;

const LIVE_USER = {
  id: "user-123",
  email: "jane@example.com",
  name: "Jane Doe",
  tenantId: "tenant-1",
  role: "PATIENT",
  drGreenClientId: "dr-green-abc",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedPrisma.users.findUnique.mockResolvedValue(null);
  mockedPrisma.users.findFirst.mockResolvedValue(null);
  mockedPrisma.users.update.mockResolvedValue({});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildAnonymizedUserData", () => {
  it("nulls every direct identifier and severs the Dr Green linkage", () => {
    const data = buildAnonymizedUserData("user-123");

    expect(data.email).toBe(`deleted-user-123@${ERASURE_EMAIL_DOMAIN}`);
    expect(data.name).toBe("Deleted User");
    expect(data.firstName).toBeNull();
    expect(data.lastName).toBeNull();
    expect(data.phone).toBeNull();
    expect(data.address).toBeNull();
    expect(data.resetToken).toBeNull();
    expect(data.resetTokenExpiry).toBeNull();
    expect(data.isActive).toBe(false);
    // AC-4: Dr Green linkage severed.
    expect(data.drGreenClientId).toBeNull();
    expect(data.clerkUserId).toBeNull();
  });

  it("returns a NEW object (no shared reference between calls)", () => {
    const a = buildAnonymizedUserData("user-1");
    const b = buildAnonymizedUserData("user-1");
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe("isAlreadyErased", () => {
  it("detects the deletion-marker email", () => {
    expect(isAlreadyErased({ email: `deleted-x@${ERASURE_EMAIL_DOMAIN}` })).toBe(true);
    expect(isAlreadyErased({ email: "real@example.com" })).toBe(false);
  });
});

describe("resolveLocalUser", () => {
  it("prefers clerkUserId over email", async () => {
    mockedPrisma.users.findUnique.mockResolvedValueOnce(LIVE_USER);

    const user = await resolveLocalUser({
      clerkUserId: "clerk_1",
      email: "jane@example.com",
    });

    expect(user).toEqual(LIVE_USER);
    expect(mockedPrisma.users.findUnique).toHaveBeenCalledWith({
      where: { clerkUserId: "clerk_1" },
      select: expect.any(Object),
    });
    // email fallback not used when clerk match succeeds
    expect(mockedPrisma.users.findFirst).not.toHaveBeenCalled();
  });

  it("falls back to email when no clerkUserId match", async () => {
    mockedPrisma.users.findUnique.mockResolvedValue(null);
    mockedPrisma.users.findFirst.mockResolvedValueOnce(LIVE_USER);

    const user = await resolveLocalUser({
      clerkUserId: "clerk_missing",
      email: "jane@example.com",
    });

    expect(user).toEqual(LIVE_USER);
    expect(mockedPrisma.users.findFirst).toHaveBeenCalledWith({
      where: { email: "jane@example.com" },
      select: expect.any(Object),
    });
  });

  it("returns null when nothing matches", async () => {
    const user = await resolveLocalUser({ clerkUserId: "x", email: "y@z.com" });
    expect(user).toBeNull();
  });
});

describe("eraseUser — anonymisation + linkage severance", () => {
  it("anonymises a live user and clears the Dr Green linkage", async () => {
    mockedPrisma.users.findUnique.mockResolvedValueOnce(LIVE_USER);

    const result = await eraseUser({
      clerkUserId: "clerk_1",
      reason: "clerk_user_deleted",
      clerkDeleted: true,
    });

    expect(result.matchedLocalUser).toBe(true);
    expect(result.anonymized).toBe(true);
    expect(result.drGreenLinkageCleared).toBe(true);
    expect(result.userId).toBe("user-123");

    expect(mockedPrisma.users.update).toHaveBeenCalledWith({
      where: { id: "user-123" },
      data: expect.objectContaining({
        drGreenClientId: null,
        clerkUserId: null,
        isActive: false,
      }),
    });
  });

  it("writes a redacted audit row with the clerk reason + linkage flags", async () => {
    mockedPrisma.users.findUnique.mockResolvedValueOnce(LIVE_USER);

    await eraseUser({ clerkUserId: "clerk_1", reason: "clerk_user_deleted" });

    expect(mockedAudit).toHaveBeenCalledTimes(1);
    const call = mockedAudit.mock.calls[0][0];
    expect(call.action).toBe(ERASURE_AUDIT_ACTIONS.CLERK);
    expect(call.entityType).toBe("User");
    expect(call.entityId).toBe("user-123");
    expect(call.metadata).toMatchObject({
      reason: "clerk_user_deleted",
      matchedLocalUser: true,
      drGreenLinkageCleared: true,
      drGreenRemoteDeletionRequested: false,
    });
  });

  it("maps reason -> audit action for self/admin paths", async () => {
    mockedPrisma.users.findUnique.mockResolvedValue(LIVE_USER);

    await eraseUser({ userId: "user-123", reason: "self_service" });
    expect(mockedAudit.mock.calls[0][0].action).toBe(ERASURE_AUDIT_ACTIONS.SELF);

    mockedAudit.mockClear();
    await eraseUser({
      userId: "user-123",
      reason: "admin_assisted",
      actingAdminId: "admin-9",
    });
    expect(mockedAudit.mock.calls[0][0].action).toBe(ERASURE_AUDIT_ACTIONS.ADMIN);
    expect(mockedAudit.mock.calls[0][0].metadata.actingAdminId).toBe("admin-9");
  });

  it("is idempotent — a second call on an already-erased user does not re-update but still audits", async () => {
    const erased = {
      ...LIVE_USER,
      email: `deleted-user-123@${ERASURE_EMAIL_DOMAIN}`,
      drGreenClientId: null,
    };
    mockedPrisma.users.findUnique.mockResolvedValueOnce(erased);

    const result = await eraseUser({ userId: "user-123", reason: "self_service" });

    expect(result.matchedLocalUser).toBe(true);
    expect(result.anonymized).toBe(false);
    expect(mockedPrisma.users.update).not.toHaveBeenCalled();
    // Still audits the (no-op) erasure.
    expect(mockedAudit).toHaveBeenCalledTimes(1);
    expect(mockedAudit.mock.calls[0][0].metadata.idempotentNoop).toBe(true);
  });

  it("AC-1b: no local user -> writes erasure_noop_user_not_found audit row", async () => {
    mockedPrisma.users.findUnique.mockResolvedValue(null);
    mockedPrisma.users.findFirst.mockResolvedValue(null);

    const result = await eraseUser({
      clerkUserId: "clerk_ghost",
      reason: "clerk_user_deleted",
    });

    expect(result.matchedLocalUser).toBe(false);
    expect(result.anonymized).toBe(false);
    expect(mockedPrisma.users.update).not.toHaveBeenCalled();
    expect(mockedAudit).toHaveBeenCalledTimes(1);
    expect(mockedAudit.mock.calls[0][0].action).toBe(
      ERASURE_AUDIT_ACTIONS.NOOP_NOT_FOUND,
    );
    expect(mockedAudit.mock.calls[0][0].metadata.clerkUserId).toBe("clerk_ghost");
  });

  it("reports drGreenLinkageCleared=false when there was no linkage", async () => {
    mockedPrisma.users.findUnique.mockResolvedValueOnce({
      ...LIVE_USER,
      drGreenClientId: null,
    });

    const result = await eraseUser({ userId: "user-123", reason: "self_service" });
    expect(result.drGreenLinkageCleared).toBe(false);
  });
});

describe("exportUser", () => {
  it("returns the expected shape and writes an audit row with record counts", async () => {
    mockedPrisma.users.findFirst.mockResolvedValueOnce({
      id: "user-123",
      email: "jane@example.com",
      name: "Jane Doe",
      firstName: "Jane",
      lastName: "Doe",
      phone: "123",
      address: null,
      isActive: true,
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-02"),
      tenantId: "tenant-1",
      drGreenClientId: "dr-green-abc",
    });
    mockedPrisma.orders.findMany.mockResolvedValueOnce([{ id: "o1" }, { id: "o2" }]);
    mockedPrisma.consultations.findMany.mockResolvedValueOnce([{ id: "c1" }]);
    mockedPrisma.consultation_questionnaires.findMany.mockResolvedValueOnce([]);

    const result = await exportUser({
      clerkUserId: "clerk_1",
      email: "jane@example.com",
      requestedByClerkId: "clerk_1",
    });

    expect(result).not.toBeNull();
    expect(result?.profile).toMatchObject({ id: "user-123" });
    expect(result?.orders).toHaveLength(2);
    expect(result?.consultations).toHaveLength(1);
    expect(result?.questionnaires).toHaveLength(0);
    expect(result?.notes.length).toBeGreaterThan(0);

    expect(mockedAudit).toHaveBeenCalledTimes(1);
    expect(mockedAudit.mock.calls[0][0].action).toBe(ERASURE_AUDIT_ACTIONS.EXPORTED);
    expect(mockedAudit.mock.calls[0][0].metadata.recordCounts).toEqual({
      orders: 2,
      consultations: 1,
      questionnaires: 0,
    });
  });

  it("returns null and does NOT audit when no user is found", async () => {
    mockedPrisma.users.findFirst.mockResolvedValue(null);

    const result = await exportUser({ email: "ghost@example.com" });

    expect(result).toBeNull();
    expect(mockedAudit).not.toHaveBeenCalled();
  });
});
