import { describe, expect, it } from "vitest";

// Email Phase 2 US-021 — the scheduling rules, and the guard that decides
// whether a trigger job may still send.

import {
  CAMPAIGN_SCHEDULE_MAX_HORIZON_MS,
  CAMPAIGN_SCHEDULE_MIN_LEAD_MS,
  CAMPAIGN_SCHEDULE_INVALID_TIME_MESSAGE,
  CAMPAIGN_SCHEDULE_TOO_FAR_MESSAGE,
  CAMPAIGN_SCHEDULE_TOO_SOON_MESSAGE,
  campaignScheduleDelayMs,
  campaignScheduleRateLimitKey,
  scheduledSendDecision,
  validateScheduleTime,
} from "@/lib/email/campaign-schedule";

const NOW = new Date("2026-08-13T09:00:00.000Z");
const JOB = "job-1";

const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

describe("validateScheduleTime", () => {
  it("accepts a time comfortably in the future", () => {
    expect(validateScheduleTime(at(60 * 60 * 1000), NOW)).toBeNull();
  });

  it("accepts the boundaries exactly", () => {
    expect(validateScheduleTime(at(CAMPAIGN_SCHEDULE_MIN_LEAD_MS), NOW)).toBeNull();
    expect(
      validateScheduleTime(at(CAMPAIGN_SCHEDULE_MAX_HORIZON_MS), NOW),
    ).toBeNull();
  });

  it("refuses a time in the past", () => {
    expect(validateScheduleTime(at(-1000), NOW)).toBe(
      CAMPAIGN_SCHEDULE_TOO_SOON_MESSAGE,
    );
  });

  it("refuses 'now', which is a send and not a schedule", () => {
    expect(validateScheduleTime(NOW, NOW)).toBe(
      CAMPAIGN_SCHEDULE_TOO_SOON_MESSAGE,
    );
  });

  it("refuses a time past the horizon the queue can hold", () => {
    expect(
      validateScheduleTime(at(CAMPAIGN_SCHEDULE_MAX_HORIZON_MS + 1000), NOW),
    ).toBe(CAMPAIGN_SCHEDULE_TOO_FAR_MESSAGE);
  });

  it("refuses an unparseable date rather than treating it as zero", () => {
    expect(validateScheduleTime(new Date("not a date"), NOW)).toBe(
      CAMPAIGN_SCHEDULE_INVALID_TIME_MESSAGE,
    );
  });
});

describe("campaignScheduleDelayMs", () => {
  it("is the distance to the send time", () => {
    expect(campaignScheduleDelayMs(at(90_000), NOW)).toBe(90_000);
  });

  it("never goes negative — a delay is a duration", () => {
    expect(campaignScheduleDelayMs(at(-5000), NOW)).toBe(0);
  });
});

describe("campaignScheduleRateLimitKey", () => {
  it("does not share a counter with the send endpoint", () => {
    expect(campaignScheduleRateLimitKey("admin_1")).toBe(
      "campaign-schedule:admin_1",
    );
  });
});

describe("scheduledSendDecision", () => {
  const scheduled = { status: "SCHEDULED" as const, scheduledJobId: JOB };

  it("sends when the campaign is still waiting on this job", () => {
    expect(scheduledSendDecision(scheduled, JOB)).toBe("SEND");
  });

  it("NEVER sends a cancelled campaign", () => {
    expect(
      scheduledSendDecision(
        { status: "CANCELLED", scheduledJobId: JOB },
        JOB,
      ),
    ).toBe("CANCELLED");
  });

  it.each(["DRAFT", "SENDING", "SENT"] as const)(
    "refuses a campaign that has left SCHEDULED (%s)",
    (status) => {
      expect(scheduledSendDecision({ status, scheduledJobId: JOB }, JOB)).toBe(
        "NOT_SCHEDULED",
      );
    },
  );

  it("refuses a campaign that was deleted while it waited", () => {
    expect(scheduledSendDecision(null, JOB)).toBe("MISSING");
  });

  it("refuses a trigger a reschedule replaced, even though the campaign is SCHEDULED", () => {
    // The removal of the old job is a network call that can fail while the
    // write that replaced it succeeded. This is what stops the survivor.
    expect(
      scheduledSendDecision({ status: "SCHEDULED", scheduledJobId: "job-2" }, JOB),
    ).toBe("SUPERSEDED");
  });

  it("refuses a campaign that points at no trigger at all", () => {
    expect(
      scheduledSendDecision({ status: "SCHEDULED", scheduledJobId: null }, JOB),
    ).toBe("SUPERSEDED");
  });
});
