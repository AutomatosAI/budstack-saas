import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  planStatusUpdates,
  sweepClientStatuses,
  type MirrorRow,
  type SweptClientStatus,
} from "@/lib/drgreen/client-status-sweep";
import { doctorGreenRequest } from "@/lib/drgreen/doctor-green-api";

vi.mock("@/lib/drgreen/doctor-green-api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/drgreen/doctor-green-api")>();
  return {
    ...actual,
    doctorGreenRequest: vi.fn(),
  };
});

const mockedRequest = vi.mocked(doctorGreenRequest);

const CONFIG = { apiKey: "key", secretKey: "secret" } as any;

function client(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "c-1",
    email: "Ann@Example.com",
    adminApproval: "VERIFIED",
    isKYCVerified: true,
    isActive: true,
    verificationType: "KYC",
    verifiedAt: "2026-08-01T00:00:00.000Z",
    rejectedAt: null,
    ...over,
  };
}

describe("sweepClientStatuses", () => {
  beforeEach(() => {
    mockedRequest.mockReset();
  });

  it("unwraps the single-wrap list envelope and normalises fields", async () => {
    mockedRequest.mockResolvedValueOnce({
      success: true,
      data: { clients: [client()], pageMetaDto: { page: 1 } },
    });

    const swept = await sweepClientStatuses(CONFIG);

    expect(swept).toHaveLength(1);
    expect(swept[0]).toMatchObject({
      clientId: "c-1",
      email: "ann@example.com", // lowercased
      adminApproval: "VERIFIED",
      isKYCVerified: true,
    });
    expect(mockedRequest).toHaveBeenCalledWith("/dapp/clients", {
      config: CONFIG,
      queryParams: { take: 200, page: 1, orderBy: "desc" },
    });
  });

  it("pages until a short page and dedupes overlapping rows", async () => {
    const fullPage = Array.from({ length: 200 }, (_, i) => client({ id: `c-${i}` }));
    mockedRequest
      .mockResolvedValueOnce({ data: { clients: fullPage } })
      .mockResolvedValueOnce({ data: { clients: [client({ id: "c-0" }), client({ id: "c-200" })] } });

    const swept = await sweepClientStatuses(CONFIG);

    expect(mockedRequest).toHaveBeenCalledTimes(2);
    expect(swept).toHaveLength(201); // c-0 not double-counted
  });

  it("returns empty for an empty tenant without further paging", async () => {
    mockedRequest.mockResolvedValueOnce({ data: { clients: [] } });
    const swept = await sweepClientStatuses(CONFIG);
    expect(swept).toEqual([]);
    expect(mockedRequest).toHaveBeenCalledTimes(1);
  });
});

describe("planStatusUpdates", () => {
  const row = (over: Partial<MirrorRow> = {}): MirrorRow => ({
    id: "q-1",
    email: "ann@example.com",
    drGreenClientId: "c-1",
    isKycVerified: false,
    adminApproval: "PENDING",
    ...over,
  });

  const swept = (over: Partial<SweptClientStatus> = {}): SweptClientStatus => ({
    clientId: "c-1",
    email: "ann@example.com",
    adminApproval: "VERIFIED",
    isKYCVerified: true,
    isActive: true,
    verificationType: "KYC",
    verifiedAt: null,
    rejectedAt: null,
    ...over,
  });

  it("updates a changed row matched by client id", () => {
    const updates = planStatusUpdates([swept()], [row()]);
    expect(updates).toEqual([
      { questionnaireId: "q-1", isKycVerified: true, adminApproval: "VERIFIED" },
    ]);
  });

  it("skips rows that are already canonical and unchanged", () => {
    const updates = planStatusUpdates(
      [swept()],
      [row({ isKycVerified: true, adminApproval: "VERIFIED" })],
    );
    expect(updates).toEqual([]);
  });

  it("rewrites the legacy APPROVED literal even when canonically equal", () => {
    const updates = planStatusUpdates(
      [swept()],
      [row({ isKycVerified: true, adminApproval: "APPROVED" })],
    );
    expect(updates).toEqual([
      { questionnaireId: "q-1", isKycVerified: true, adminApproval: "VERIFIED" },
    ]);
  });

  it("falls back to email matching and backfills the missing client id", () => {
    const updates = planStatusUpdates(
      [swept()],
      [row({ drGreenClientId: null, email: "Ann@Example.com" })],
    );
    expect(updates).toEqual([
      {
        questionnaireId: "q-1",
        isKycVerified: true,
        adminApproval: "VERIFIED",
        backfillDrGreenClientId: "c-1",
      },
    ]);
  });

  it("email fallback never rebinds a row already linked to another client", () => {
    const updates = planStatusUpdates(
      [swept({ clientId: "c-OTHER" })],
      [row({ drGreenClientId: "c-1", email: "ann@example.com", isKycVerified: true, adminApproval: "VERIFIED" })],
    );
    expect(updates).toEqual([]);
  });

  it("ignores swept clients with no local row and no canonical approval", () => {
    const updates = planStatusUpdates(
      [swept({ clientId: "c-unknown", email: "nobody@example.com" }), swept({ adminApproval: null })],
      [row({ isKycVerified: true, adminApproval: "VERIFIED" })],
    );
    expect(updates).toEqual([]);
  });

  it("mirrors a rejection", () => {
    const updates = planStatusUpdates(
      [swept({ adminApproval: "REJECTED", isKYCVerified: false })],
      [row({ isKycVerified: true, adminApproval: "VERIFIED" })],
    );
    expect(updates).toEqual([
      { questionnaireId: "q-1", isKycVerified: false, adminApproval: "REJECTED" },
    ]);
  });
});
