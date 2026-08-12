import { describe, it, expect, vi, beforeEach } from "vitest";

// Email Phase 2 US-008 — deterministic email_logs linkage. The worker itself
// cannot be imported (it constructs a BullMQ Worker and a Redis connection at
// module load), so the whole "which row does this outcome belong to?" decision
// lives in lib/email/email-log-linkage.ts and is asserted here:
//   1. with a logId the outcome lands on THAT row and the heuristic never runs;
//   2. without one — every job enqueued before this story — the legacy
//      (recipient, subject, QUEUED) lookup still works;
//   3. concurrent sends sharing a recipient+subject no longer collide.
const prismaMock = vi.hoisted(() => ({
  email_logs: {
    create: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  createQueuedEmailLog,
  logRecipient,
  markEmailLogFailed,
  markEmailLogSent,
} from "@/lib/email/email-log-linkage";

const TENANT_ID = "tenant-a";
const RECIPIENT = "buyer@example.com";
const SUBJECT = "Your order is on its way";
const TEMPLATE = "order-status-update";
const LOG_ID = "log_123";

const target = {
  tenantId: TENANT_ID,
  to: RECIPIENT,
  subject: SUBJECT,
  templateName: TEMPLATE,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.email_logs.create.mockResolvedValue({ id: LOG_ID });
  prismaMock.email_logs.findFirst.mockResolvedValue(null);
  prismaMock.email_logs.updateMany.mockResolvedValue({ count: 1 });
});

describe("logRecipient — the column the send path writes", () => {
  it("passes a single address through untouched", () => {
    expect(logRecipient(" Buyer@Example.com ")).toBe(" Buyer@Example.com ");
  });

  it("joins a legacy multi-recipient job the way nodemailer reads it", () => {
    expect(logRecipient(["a@x.com", "b@y.com"])).toBe("a@x.com,b@y.com");
  });
});

describe("createQueuedEmailLog — the row is written before the job is queued", () => {
  it("returns the id the payload will carry", async () => {
    const id = await createQueuedEmailLog({
      ...target,
      metadata: { orderId: "ord_1" },
    });

    expect(id).toBe(LOG_ID);
    expect(prismaMock.email_logs.create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT_ID,
        recipient: RECIPIENT,
        subject: SUBJECT,
        templateName: TEMPLATE,
        status: "QUEUED",
        metadata: JSON.stringify({ orderId: "ord_1" }),
      },
      select: { id: true },
    });
  });

  it("omits metadata rather than storing the string 'undefined'", async () => {
    await createQueuedEmailLog(target);

    expect(prismaMock.email_logs.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ metadata: undefined }),
      }),
    );
  });

  it("returns null instead of throwing when the log write fails", async () => {
    // A "SYSTEM" send has no tenants row to reference — the FK rejects it, and
    // losing the log must never cost the customer the email.
    prismaMock.email_logs.create.mockRejectedValue(
      new Error("foreign key constraint"),
    );

    await expect(
      createQueuedEmailLog({ ...target, tenantId: "SYSTEM" }),
    ).resolves.toBeNull();
  });
});

describe("markEmailLogSent / markEmailLogFailed — the logId path", () => {
  it("updates exactly the row the job owns, scoped to its tenant", async () => {
    const sentAt = new Date("2026-08-12T10:00:00.000Z");

    await markEmailLogSent({
      ...target,
      logId: LOG_ID,
      smtpResponse: "250 OK",
      sentAt,
    });

    expect(prismaMock.email_logs.updateMany).toHaveBeenCalledWith({
      where: { id: LOG_ID, tenantId: TENANT_ID },
      data: { status: "SENT", smtpResponse: "250 OK", sentAt },
    });
  });

  it("never consults the heuristic when a logId is present", async () => {
    await markEmailLogFailed({
      ...target,
      logId: LOG_ID,
      errorMessage: "connection refused",
    });

    expect(prismaMock.email_logs.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.email_logs.create).not.toHaveBeenCalled();
    expect(prismaMock.email_logs.updateMany).toHaveBeenCalledWith({
      where: { id: LOG_ID, tenantId: TENANT_ID },
      data: { status: "FAILED", errorMessage: "connection refused" },
    });
  });

  it("does not require the row to still be QUEUED, so a retry reuses it", async () => {
    // Attempt 1 failed and left the row FAILED; the BullMQ retry must flip that
    // same row to SENT rather than fork a second one.
    await markEmailLogSent({ ...target, logId: LOG_ID, smtpResponse: "250 OK" });

    const [call] = prismaMock.email_logs.updateMany.mock.calls;
    expect(call[0].where).not.toHaveProperty("status");
  });

  it("stamps sentAt even when the caller does not supply one", async () => {
    await markEmailLogSent({ ...target, logId: LOG_ID });

    const [call] = prismaMock.email_logs.updateMany.mock.calls;
    expect(call[0].data.sentAt).toBeInstanceOf(Date);
  });

  it("records the outcome anyway when the row has vanished", async () => {
    prismaMock.email_logs.updateMany.mockResolvedValue({ count: 0 });

    await markEmailLogFailed({
      ...target,
      logId: LOG_ID,
      errorMessage: "smtp timeout",
    });

    expect(prismaMock.email_logs.create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT_ID,
        recipient: RECIPIENT,
        subject: SUBJECT,
        templateName: TEMPLATE,
        status: "FAILED",
        errorMessage: "smtp timeout",
      },
    });
  });

  it("keeps two concurrent sends of the same subject on their own rows", async () => {
    // The exact case the (recipient, subject) heuristic mis-attributed: same
    // tenant, same recipient, same subject, two jobs in flight.
    await markEmailLogSent({ ...target, logId: "log_a", smtpResponse: "250 A" });
    await markEmailLogFailed({
      ...target,
      logId: "log_b",
      errorMessage: "mailbox full",
    });

    const ids = prismaMock.email_logs.updateMany.mock.calls.map(
      (call) => call[0].where.id,
    );
    expect(ids).toEqual(["log_a", "log_b"]);
    expect(prismaMock.email_logs.findFirst).not.toHaveBeenCalled();
  });

  it("propagates a write failure so the job retries rather than reporting SENT", async () => {
    prismaMock.email_logs.updateMany.mockRejectedValue(
      new Error("connection reset"),
    );

    await expect(
      markEmailLogSent({ ...target, logId: LOG_ID }),
    ).rejects.toThrow("connection reset");
  });
});

describe("legacy fallback — jobs enqueued before US-008 carry no logId", () => {
  it("finds the newest QUEUED row for this tenant/recipient/subject", async () => {
    prismaMock.email_logs.findFirst.mockResolvedValue({ id: "legacy_1" });

    await markEmailLogSent({ ...target, smtpResponse: "250 OK" });

    expect(prismaMock.email_logs.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT_ID,
        recipient: RECIPIENT,
        subject: SUBJECT,
        status: "QUEUED",
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    expect(prismaMock.email_logs.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "legacy_1", tenantId: TENANT_ID },
      }),
    );
  });

  it("matches a legacy multi-recipient job on the joined recipient column", async () => {
    await markEmailLogFailed({
      ...target,
      to: ["a@x.com", "b@y.com"],
      errorMessage: "relay denied",
    });

    expect(prismaMock.email_logs.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ recipient: "a@x.com,b@y.com" }),
      }),
    );
  });

  it("creates the row when no QUEUED row exists to claim", async () => {
    await markEmailLogFailed({ ...target, errorMessage: "no smtp config" });

    expect(prismaMock.email_logs.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.email_logs.create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT_ID,
        recipient: RECIPIENT,
        subject: SUBJECT,
        templateName: TEMPLATE,
        status: "FAILED",
        errorMessage: "no smtp config",
      },
    });
  });

  it("treats a null logId the same as an absent one", async () => {
    await markEmailLogFailed({
      ...target,
      logId: null,
      errorMessage: "expired unsent",
    });

    expect(prismaMock.email_logs.findFirst).toHaveBeenCalledTimes(1);
  });
});
