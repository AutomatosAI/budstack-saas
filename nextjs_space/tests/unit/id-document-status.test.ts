import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    consultation_questionnaires: {
      update: mocks.update,
      findFirst: mocks.findFirst,
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  ID_DOCUMENT_ERROR_MAX_LENGTH,
  recordIdDocumentOutcome,
  sanitizeIdDocumentError,
} from "@/lib/verification/id-document-status";

beforeEach(() => {
  mocks.update.mockReset().mockResolvedValue({});
  mocks.findFirst.mockReset();
});

describe("sanitizeIdDocumentError (PRD-220 Part B)", () => {
  it("uses the Error message", () => {
    expect(sanitizeIdDocumentError(new Error("boom"))).toBe("boom");
  });

  it("stringifies non-Errors and defaults empties", () => {
    expect(sanitizeIdDocumentError("plain")).toBe("plain");
    expect(sanitizeIdDocumentError("   ")).toBe("Unknown upload error");
  });

  it("truncates to the cap", () => {
    const long = "x".repeat(ID_DOCUMENT_ERROR_MAX_LENGTH + 50);
    const result = sanitizeIdDocumentError(new Error(long));
    expect(result.length).toBe(ID_DOCUMENT_ERROR_MAX_LENGTH);
    expect(result.endsWith("…")).toBe(true);
  });
});

describe("recordIdDocumentOutcome (PRD-220 Part B)", () => {
  it("targets the row by id and persists a sanitized failure", async () => {
    const ok = await recordIdDocumentOutcome({
      questionnaireId: "q-1",
      outcome: "UPLOAD_FAILED",
      error: new Error("signature mismatch"),
    });

    expect(ok).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "q-1" },
      data: expect.objectContaining({
        idDocumentStatus: "UPLOAD_FAILED",
        idDocumentError: "signature mismatch",
        idDocumentUpdatedAt: expect.any(Date),
      }),
    });
  });

  it("clears the error on UPLOADED", async () => {
    await recordIdDocumentOutcome({ questionnaireId: "q-1", outcome: "UPLOADED" });

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "q-1" },
      data: expect.objectContaining({
        idDocumentStatus: "UPLOADED",
        idDocumentError: null,
      }),
    });
  });

  it("falls back to the latest (tenantId, email) row", async () => {
    mocks.findFirst.mockResolvedValue({ id: "q-9" });

    const ok = await recordIdDocumentOutcome({
      tenantId: "t-1",
      email: "Person@Example.com",
      outcome: "UPLOADED",
    });

    expect(ok).toBe(true);
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tenantId: "t-1",
          email: { equals: "Person@Example.com", mode: "insensitive" },
        },
        orderBy: { createdAt: "desc" },
      }),
    );
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "q-9" } }),
    );
  });

  it("returns false when no row matches", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const ok = await recordIdDocumentOutcome({
      tenantId: "t-1",
      email: "nobody@example.com",
      outcome: "UPLOAD_FAILED",
      error: "nope",
    });

    expect(ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("returns false without a target", async () => {
    const ok = await recordIdDocumentOutcome({ outcome: "UPLOADED" });
    expect(ok).toBe(false);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("never throws when persistence fails (best-effort contract)", async () => {
    mocks.update.mockRejectedValue(new Error("db down"));

    await expect(
      recordIdDocumentOutcome({
        questionnaireId: "q-1",
        outcome: "UPLOAD_FAILED",
        error: new Error("original"),
      }),
    ).resolves.toBe(false);
  });
});
