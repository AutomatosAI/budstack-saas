import { describe, expect, it } from "vitest";

// Email Phase 2 US-019 — the pure half of a fan-out: the rate cap, the
// per-recipient variable set, the payload narrowing the worker does, and the
// progress fold. No prisma, no BullMQ, no environment mutation.

import {
  CAMPAIGN_NAME_FALLBACK,
  DEFAULT_CAMPAIGN_RATE_PER_MINUTE,
  campaignJobDelayMs,
  campaignJobTarget,
  campaignRatePerMinute,
  campaignRecipientVariables,
  summariseCampaignStats,
} from "@/lib/email/campaign-send";

const VARIABLE_INPUT = {
  businessName: "Healing Buds",
  baseUrl: "https://healingbuds.example",
  subdomain: "healingbuds",
  email: "jane@example.com",
  unsubscribeUrl: "https://healingbuds.example/unsub?token=abc",
};

describe("campaignRatePerMinute", () => {
  it("defaults when the cap is unset", () => {
    expect(campaignRatePerMinute({})).toBe(DEFAULT_CAMPAIGN_RATE_PER_MINUTE);
  });

  it("reads a configured cap", () => {
    expect(campaignRatePerMinute({ CAMPAIGN_RATE_PER_MINUTE: "120" })).toBe(120);
  });

  it.each(["0", "-5", "not-a-number", ""])(
    "falls back rather than trusting %s",
    (value) => {
      // A zero or negative rate would divide into an infinite (or negative)
      // delay per job — a fan-out that silently never sends.
      expect(campaignRatePerMinute({ CAMPAIGN_RATE_PER_MINUTE: value })).toBe(
        DEFAULT_CAMPAIGN_RATE_PER_MINUTE,
      );
    },
  );

  it("clamps a cap that is not a cap", () => {
    expect(campaignRatePerMinute({ CAMPAIGN_RATE_PER_MINUTE: "999999" })).toBe(
      3600,
    );
  });
});

describe("campaignJobDelayMs", () => {
  it("sends the first message immediately", () => {
    expect(campaignJobDelayMs(0, 60)).toBe(0);
  });

  it("spaces the rest evenly across the minute", () => {
    expect(campaignJobDelayMs(1, 60)).toBe(1000);
    expect(campaignJobDelayMs(59, 60)).toBe(59_000);
    // 60 a minute means the 61st message is a minute behind the first.
    expect(campaignJobDelayMs(60, 60)).toBe(60_000);
  });

  it("halves the spacing when the cap doubles", () => {
    expect(campaignJobDelayMs(10, 120)).toBe(campaignJobDelayMs(5, 60));
  });
});

describe("campaignRecipientVariables", () => {
  it("carries the recipient's own unsubscribe link", () => {
    const variables = campaignRecipientVariables(VARIABLE_INPUT);
    expect(variables.unsubscribeUrl).toBe(VARIABLE_INPUT.unsubscribeUrl);
    expect(variables.email).toBe("jane@example.com");
  });

  it("names a customer, and greets a bare address politely", () => {
    expect(
      campaignRecipientVariables({ ...VARIABLE_INPUT, name: "Jane Doe" })
        .userName,
    ).toBe("Jane Doe");
    // A subscriber gave an address and nothing else.
    expect(campaignRecipientVariables(VARIABLE_INPUT).userName).toBe(
      CAMPAIGN_NAME_FALLBACK,
    );
    expect(
      campaignRecipientVariables({ ...VARIABLE_INPUT, name: "   " }).userName,
    ).toBe(CAMPAIGN_NAME_FALLBACK);
  });

  it("keeps every value a string, never template source", () => {
    // Handlebars escapes values; it does not escape source. The whole safety
    // argument for merge tags rests on subscriber-controlled text only ever
    // arriving here as a value.
    const variables = campaignRecipientVariables({
      ...VARIABLE_INPUT,
      name: "{{#each items}}",
    });
    expect(typeof variables.userName).toBe("string");
    expect(variables.userName).toBe("{{#each items}}");
  });
});

describe("campaignJobTarget", () => {
  it("narrows a fan-out payload", () => {
    expect(
      campaignJobTarget({ campaignId: "c1", recipientId: "r1", to: "a@b.c" }),
    ).toEqual({ campaignId: "c1", recipientId: "r1" });
  });

  it("reads a transactional or legacy payload as not-a-campaign", () => {
    // Versioned by tolerance: every job enqueued before US-019 carries neither
    // field, and must keep behaving exactly as it did.
    expect(campaignJobTarget({ to: "a@b.c", subject: "Hi" })).toBeNull();
    expect(campaignJobTarget(null)).toBeNull();
    expect(campaignJobTarget("nonsense")).toBeNull();
  });

  it("refuses half a linkage", () => {
    // Guessing at the missing half would write an outcome onto another
    // recipient's row.
    expect(campaignJobTarget({ campaignId: "c1" })).toBeNull();
    expect(campaignJobTarget({ recipientId: "r1" })).toBeNull();
    expect(campaignJobTarget({ campaignId: "c1", recipientId: "" })).toBeNull();
    expect(campaignJobTarget({ campaignId: 7, recipientId: "r1" })).toBeNull();
  });
});

describe("summariseCampaignStats", () => {
  const bucket = (status: string, count: number) =>
    ({ status, _count: { _all: count } }) as never;

  it("counts an empty campaign as finished nothing", () => {
    expect(summariseCampaignStats([])).toEqual({
      total: 0,
      sent: 0,
      failed: 0,
      suppressed: 0,
      pending: 0,
    });
  });

  it("separates suppressed from failed", () => {
    // A suppressed address is an opt-out being honoured, not a delivery
    // problem — the two must never be added together.
    expect(
      summariseCampaignStats([
        bucket("SENT", 8),
        bucket("FAILED", 1),
        bucket("SUPPRESSED", 3),
      ]),
    ).toEqual({ total: 12, sent: 8, failed: 1, suppressed: 3, pending: 0 });
  });

  it("counts PENDING and QUEUED as still owing an outcome", () => {
    const stats = summariseCampaignStats([
      bucket("SENT", 2),
      bucket("QUEUED", 5),
      bucket("PENDING", 1),
    ]);
    // pending > 0 is exactly what stops a campaign flipping to SENT early.
    expect(stats.pending).toBe(6);
    expect(stats.total).toBe(8);
  });
});
