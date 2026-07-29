import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Dr Green owns whether a client is verified. BudStacks must ask it, every
 * time, and must never answer from its own table.
 *
 * The bug this locks down (observed in production 2026-07-29): checkUserKycStatus
 * short-circuited on the local `consultation_questionnaires.isKycVerified` flag
 * and returned ACTIVE without calling Dr Green. Because the persist step only
 * ever wrote `true` and never `false`, the flag was a one-way latch — once set,
 * the API was never consulted again.
 *
 * A client showed "You're verified — start shopping" from that latch while
 * Dr Green production had no such client at all. They only found out at
 * checkout, where the order failed with a 500.
 */

const findFirst = vi.fn();
const updateMany = vi.fn();
const update = vi.fn();
const usersFindUnique = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    users: { findUnique: (...a: unknown[]) => usersFindUnique(...a), update: vi.fn() },
    consultation_questionnaires: {
      findFirst: (...a: unknown[]) => findFirst(...a),
      updateMany: (...a: unknown[]) => updateMany(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));

const getCurrentUser = vi.fn();
vi.mock("@/lib/auth-helper", () => ({
  getCurrentUser: () => getCurrentUser(),
}));

vi.mock("@/lib/tenant/tenant-config", () => ({
  getTenantDrGreenConfig: vi.fn(async () => ({
    apiKey: "k",
    secretKey: "s",
    apiUrl: "https://api.drgreennft.com/api/v1",
  })),
}));

const fetchClient = vi.fn();
const fetchClientByEmail = vi.fn();
vi.mock("@/lib/drgreen/doctor-green-api", () => ({
  fetchClient: (...a: unknown[]) => fetchClient(...a),
  fetchClientByEmail: (...a: unknown[]) => fetchClientByEmail(...a),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { checkUserKycStatus } from "@/app/actions/kyc-check";

describe("checkUserKycStatus — Dr Green is the source of truth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUser.mockResolvedValue({ id: "u1", email: "a@x.com" });
    usersFindUnique.mockResolvedValue({
      id: "u1",
      drGreenClientId: "83b36bd8",
      tenantId: "t1",
    });
    updateMany.mockResolvedValue({ count: 1 });
  });

  it("does NOT trust a local isKycVerified=true — it asks Dr Green", async () => {
    // Local table says verified. Dr Green says otherwise.
    findFirst.mockResolvedValue({
      isKycVerified: true,
      adminApproval: "APPROVED",
      idDocumentStatus: null,
    });
    fetchClient.mockResolvedValue({
      isActive: false,
      isKYCVerified: false,
      adminApproval: "PENDING",
    });

    const result = await checkUserKycStatus();

    expect(fetchClient).toHaveBeenCalled(); // the short-circuit is gone
    expect(result.kycVerified).toBe(false); // Dr Green wins
  });

  it("mirrors FALSE back to the local row so the latch cannot persist", async () => {
    findFirst.mockResolvedValue({
      isKycVerified: true,
      adminApproval: "APPROVED",
      idDocumentStatus: null,
    });
    fetchClient.mockResolvedValue({
      isActive: false,
      isKYCVerified: false,
      adminApproval: "PENDING",
    });

    await checkUserKycStatus();

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isKycVerified: false }),
      })
    );
  });

  it("still reports verified when Dr Green says so", async () => {
    findFirst.mockResolvedValue({
      isKycVerified: false,
      adminApproval: null,
      idDocumentStatus: null,
    });
    fetchClient.mockResolvedValue({
      isActive: true,
      isKYCVerified: true,
      adminApproval: "VERIFIED",
    });

    const result = await checkUserKycStatus();

    expect(result.kycVerified).toBe(true);
    expect(result.status).toBe("ACTIVE");
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isKycVerified: true }),
      })
    );
  });

  it("clears the local flag on REJECTED instead of returning before the mirror", async () => {
    findFirst.mockResolvedValue({
      isKycVerified: true,
      adminApproval: "APPROVED",
      idDocumentStatus: "UPLOADED",
    });
    fetchClient.mockResolvedValue({
      isActive: false,
      isKYCVerified: false,
      adminApproval: "REJECTED",
      rejectionNote: "ID unreadable",
    });

    const result = await checkUserKycStatus();

    expect(result.status).toBe("REJECTED");
    expect(result.message).toBe("ID unreadable");
    // The mirror ran BEFORE the rejected return — previously it was skipped.
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isKycVerified: false }),
      })
    );
  });

  it("fails CLOSED when Dr Green is unreachable — never falls back to the local flag", async () => {
    findFirst.mockResolvedValue({
      isKycVerified: true,
      adminApproval: "APPROVED",
      idDocumentStatus: null,
    });
    fetchClient.mockRejectedValue(new Error("ECONNREFUSED"));
    fetchClientByEmail.mockResolvedValue(null);

    const result = await checkUserKycStatus();

    // Distinct from "not verified" so the dashboard can say "can't check right
    // now" rather than accusing a real customer of being unverified.
    expect(result.kycVerified).toBe(false);
    expect(result.status).toBe("API_ERROR");
  });
});
