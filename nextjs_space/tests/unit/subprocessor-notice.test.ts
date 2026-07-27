import { describe, expect, it } from "vitest";
import {
  MIN_NOTICE_DAYS,
  OBJECTION_WINDOW_DAYS,
  addDays,
  earliestEffectiveFrom,
  hasSufficientNotice,
  isObjectionOutOfWindow,
  noticeState,
  shouldActivate,
} from "@/lib/legal/subprocessor-notice";

/**
 * WS3 — the DPA §6 windows.
 *
 * These were prose with no mechanism behind them: 30 days' notice before a new
 * sub-processor processes, 14 days to object. Testing them by waiting a month
 * is not an option, so the rules are pure and the clock is injected.
 */

const ANNOUNCED = new Date("2026-08-01T00:00:00Z");

describe("windows match the DPA", () => {
  it("requires 30 days' notice", () => {
    expect(MIN_NOTICE_DAYS).toBe(30);
  });

  it("gives 14 days to object", () => {
    expect(OBJECTION_WINDOW_DAYS).toBe(14);
  });
});

describe("earliestEffectiveFrom", () => {
  it("is 30 days out", () => {
    expect(earliestEffectiveFrom(ANNOUNCED).toISOString()).toBe(
      "2026-08-31T00:00:00.000Z",
    );
  });
});

describe("hasSufficientNotice", () => {
  it("accepts exactly 30 days", () => {
    expect(hasSufficientNotice(ANNOUNCED, addDays(ANNOUNCED, 30))).toBe(true);
  });

  it("accepts more than 30 days", () => {
    expect(hasSufficientNotice(ANNOUNCED, addDays(ANNOUNCED, 45))).toBe(true);
  });

  it("rejects 29 days", () => {
    expect(hasSufficientNotice(ANNOUNCED, addDays(ANNOUNCED, 29))).toBe(false);
  });

  it("rejects an effective date before the announcement", () => {
    expect(hasSufficientNotice(ANNOUNCED, addDays(ANNOUNCED, -1))).toBe(false);
  });
});

describe("isObjectionOutOfWindow", () => {
  it("accepts an objection on day 14", () => {
    expect(isObjectionOutOfWindow(ANNOUNCED, addDays(ANNOUNCED, 14))).toBe(false);
  });

  it("flags an objection on day 15", () => {
    expect(isObjectionOutOfWindow(ANNOUNCED, addDays(ANNOUNCED, 15))).toBe(true);
  });

  it("accepts an objection raised the same day", () => {
    expect(isObjectionOutOfWindow(ANNOUNCED, ANNOUNCED)).toBe(false);
  });
});

describe("shouldActivate", () => {
  const pending = {
    status: "pending",
    effectiveFrom: addDays(ANNOUNCED, 30),
    announcedAt: ANNOUNCED,
  };

  it("activates on the effective date", () => {
    expect(shouldActivate(pending, addDays(ANNOUNCED, 30))).toBe(true);
  });

  it("does not activate before the effective date", () => {
    expect(shouldActivate(pending, addDays(ANNOUNCED, 29))).toBe(false);
  });

  it("never activates an unannounced entry, whatever the date", () => {
    // Processing must not begin on a vendor operators were never told about.
    expect(
      shouldActivate({ ...pending, announcedAt: null }, addDays(ANNOUNCED, 365)),
    ).toBe(false);
  });

  it("leaves an already-active entry alone", () => {
    expect(
      shouldActivate({ ...pending, status: "active" }, addDays(ANNOUNCED, 30)),
    ).toBe(false);
  });

  it("does not resurrect a retired entry", () => {
    expect(
      shouldActivate({ ...pending, status: "retired" }, addDays(ANNOUNCED, 30)),
    ).toBe(false);
  });
});

describe("noticeState", () => {
  const base = {
    status: "pending",
    effectiveFrom: addDays(ANNOUNCED, 30),
    announcedAt: ANNOUNCED,
  };

  it.each([
    ["in-force", { ...base, status: "active" }, ANNOUNCED],
    ["retired", { ...base, status: "retired" }, ANNOUNCED],
    ["awaiting-announcement", { ...base, announcedAt: null }, ANNOUNCED],
    ["in-notice-period", base, addDays(ANNOUNCED, 5)],
    ["due-to-activate", base, addDays(ANNOUNCED, 31)],
  ])("reports %s", (expected, entry, now) => {
    expect(noticeState(entry, now as Date)).toBe(expected);
  });
});
