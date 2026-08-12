import { describe, it, expect, vi, beforeEach } from "vitest";

// Email Phase 2 US-004 — the send-time suppression gate the worker consults
// before every job. The worker itself cannot be imported (it constructs a
// BullMQ Worker and a Redis connection at module load), so the whole decision
// lives in resolveSuppressionBlock and is asserted here instead:
//   1. a marketing job to a suppressed address is blocked;
//   2. a transactional job is untouched and never even queries;
//   3. a job with no `category` — every payload enqueued before this story —
//      is treated as transactional.
const prismaMock = vi.hoisted(() => ({
  email_suppressions: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  DEFAULT_EMAIL_CATEGORY,
  SUPPRESSED_LOG_MESSAGE,
  SUPPRESSED_LOG_REASON,
  normalizeEmail,
  recipientAddresses,
  resolveEmailCategory,
  shouldCheckSuppression,
} from "@/lib/email/suppression";
import {
  findSuppressedRecipients,
  resolveSuppressionBlock,
  suppressEmail,
} from "@/lib/email/suppression-store";

const TENANT_ID = "tenant-a";
const SUBSCRIBER = "gone@example.com";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.email_suppressions.findMany.mockResolvedValue([]);
  prismaMock.email_suppressions.create.mockResolvedValue({ id: "sup_1" });
});

describe("resolveEmailCategory — absence means transactional", () => {
  it("keeps the two known categories", () => {
    expect(resolveEmailCategory("marketing")).toBe("marketing");
    expect(resolveEmailCategory("transactional")).toBe("transactional");
  });

  it.each([undefined, null, "", "MARKETING", "promo", 42, {}, []])(
    "defaults %s to transactional",
    (value) => {
      expect(resolveEmailCategory(value)).toBe(DEFAULT_EMAIL_CATEGORY);
      expect(resolveEmailCategory(value)).toBe("transactional");
    },
  );

  it("gates only marketing", () => {
    expect(shouldCheckSuppression("marketing")).toBe(true);
    expect(shouldCheckSuppression("transactional")).toBe(false);
    expect(shouldCheckSuppression(undefined)).toBe(false);
  });
});

describe("recipientAddresses — every shape a queued `to` has taken", () => {
  it("normalises a single address", () => {
    expect(recipientAddresses("  Person@Example.COM ")).toEqual([
      "person@example.com",
    ]);
  });

  it("handles a legacy array payload", () => {
    expect(recipientAddresses(["A@x.com", "b@y.com"])).toEqual([
      "a@x.com",
      "b@y.com",
    ]);
  });

  it("splits the comma-separated form nodemailer accepts", () => {
    expect(recipientAddresses("a@x.com, b@y.com")).toEqual([
      "a@x.com",
      "b@y.com",
    ]);
  });

  it("de-duplicates addresses that differ only by case", () => {
    expect(recipientAddresses(["a@x.com", "A@X.com"])).toEqual(["a@x.com"]);
  });

  it("unwraps the RFC 5322 display-name form a campaign send may produce", () => {
    // Missing an address here fails OPEN — it mails someone who opted out.
    expect(recipientAddresses('"Jane Doe" <Jane@Example.com>')).toEqual([
      "jane@example.com",
    ]);
    expect(recipientAddresses("Jane Doe <jane@example.com>")).toEqual([
      "jane@example.com",
    ]);
  });

  it("survives a display name containing the separator comma", () => {
    expect(recipientAddresses('"Doe, Jane" <jane@example.com>')).toEqual([
      "jane@example.com",
    ]);
  });

  it("drops display-name fragments that are not addresses", () => {
    expect(recipientAddresses("Jane Doe")).toEqual([]);
  });

  it.each([undefined, null, "", 7, [null, ""], {}])(
    "yields nothing for %s rather than guessing",
    (value) => {
      expect(recipientAddresses(value)).toEqual([]);
    },
  );

  it("agrees with normalizeEmail", () => {
    expect(recipientAddresses(" X@Y.COM ")[0]).toBe(normalizeEmail(" X@Y.COM "));
  });
});

describe("resolveSuppressionBlock — may this job be sent?", () => {
  it("blocks a marketing job addressed to a suppressed recipient", async () => {
    prismaMock.email_suppressions.findMany.mockResolvedValue([
      { email: SUBSCRIBER },
    ]);

    const result = await resolveSuppressionBlock({
      tenantId: TENANT_ID,
      to: SUBSCRIBER,
      category: "marketing",
    });

    expect(result.blocked).toBe(true);
    expect(result.suppressed).toEqual([SUBSCRIBER]);
  });

  it("lets a marketing job through when nobody on it is suppressed", async () => {
    const result = await resolveSuppressionBlock({
      tenantId: TENANT_ID,
      to: "still-subscribed@example.com",
      category: "marketing",
    });

    expect(result.blocked).toBe(false);
    expect(prismaMock.email_suppressions.findMany).toHaveBeenCalledTimes(1);
  });

  it("leaves a transactional send completely alone — no block, no query", async () => {
    prismaMock.email_suppressions.findMany.mockResolvedValue([
      { email: SUBSCRIBER },
    ]);

    const result = await resolveSuppressionBlock({
      tenantId: TENANT_ID,
      to: SUBSCRIBER,
      category: "transactional",
    });

    expect(result.blocked).toBe(false);
    expect(prismaMock.email_suppressions.findMany).not.toHaveBeenCalled();
  });

  it("treats a legacy payload with no category as transactional", async () => {
    prismaMock.email_suppressions.findMany.mockResolvedValue([
      { email: SUBSCRIBER },
    ]);

    const result = await resolveSuppressionBlock({
      tenantId: TENANT_ID,
      to: SUBSCRIBER,
      category: undefined,
    });

    expect(result.blocked).toBe(false);
    expect(prismaMock.email_suppressions.findMany).not.toHaveBeenCalled();
  });

  it("scopes the lookup to the job's tenant and the normalised addresses", async () => {
    await resolveSuppressionBlock({
      tenantId: TENANT_ID,
      to: " Gone@Example.com ",
      category: "marketing",
    });

    expect(prismaMock.email_suppressions.findMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_ID, email: { in: [SUBSCRIBER] } },
      select: { email: true },
    });
  });

  it("blocks the whole job when only one of several recipients is suppressed", async () => {
    prismaMock.email_suppressions.findMany.mockResolvedValue([
      { email: SUBSCRIBER },
    ]);

    const result = await resolveSuppressionBlock({
      tenantId: TENANT_ID,
      to: ["ok@example.com", SUBSCRIBER],
      category: "marketing",
    });

    // One sendMail cannot drop a single address from its envelope, so a partial
    // send would silently change who the message went to.
    expect(result.blocked).toBe(true);
  });

  it("does not query for a marketing job with no parseable recipient", async () => {
    const result = await resolveSuppressionBlock({
      tenantId: TENANT_ID,
      to: null,
      category: "marketing",
    });

    expect(result.blocked).toBe(false);
    expect(prismaMock.email_suppressions.findMany).not.toHaveBeenCalled();
  });

  it("propagates a lookup failure so the job retries rather than sends", async () => {
    prismaMock.email_suppressions.findMany.mockRejectedValue(
      new Error("connection reset"),
    );

    await expect(
      resolveSuppressionBlock({
        tenantId: TENANT_ID,
        to: SUBSCRIBER,
        category: "marketing",
      }),
    ).rejects.toThrow("connection reset");
  });

  it("labels the failure with a prefix the log pages can match on", () => {
    expect(SUPPRESSED_LOG_REASON).toBe("suppressed");
    expect(SUPPRESSED_LOG_MESSAGE.startsWith(SUPPRESSED_LOG_REASON)).toBe(true);
  });
});

describe("findSuppressedRecipients", () => {
  it("short-circuits an empty list without a query", async () => {
    expect(await findSuppressedRecipients(TENANT_ID, [])).toEqual([]);
    expect(prismaMock.email_suppressions.findMany).not.toHaveBeenCalled();
  });
});

describe("suppressEmail", () => {
  it("stores the normalised address with its reason", async () => {
    await suppressEmail({
      tenantId: TENANT_ID,
      email: " Gone@Example.com ",
      reason: "unsubscribed",
    });

    expect(prismaMock.email_suppressions.create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT_ID,
        email: SUBSCRIBER,
        reason: "unsubscribed",
      },
    });
  });

  it("is idempotent — a second suppression is a no-op, not an error", async () => {
    prismaMock.email_suppressions.create.mockRejectedValue({ code: "P2002" });

    await expect(
      suppressEmail({
        tenantId: TENANT_ID,
        email: SUBSCRIBER,
        reason: "bounced",
      }),
    ).resolves.toBeUndefined();
  });

  it("still surfaces a real write failure", async () => {
    prismaMock.email_suppressions.create.mockRejectedValue(
      new Error("disk full"),
    );

    await expect(
      suppressEmail({
        tenantId: TENANT_ID,
        email: SUBSCRIBER,
        reason: "manual",
      }),
    ).rejects.toThrow("disk full");
  });
});
