import { describe, expect, it } from "vitest";

import {
  percentChange,
  revenuePeriods,
  startOfUtcDay,
} from "@/lib/analytics/period-metrics";

/**
 * The Revenue Overview cards previously showed fabricated values
 * (recentRevenue × 0.1 with a hardcoded +12.5%). These tests pin the real
 * period math that replaced them: UTC half-open windows that abut exactly,
 * and a delta that renders "—" (null) instead of a fake percentage when
 * there is no baseline.
 */

const NOW = new Date("2026-08-13T15:30:45.123Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("startOfUtcDay", () => {
  it("truncates to UTC midnight regardless of time of day", () => {
    expect(startOfUtcDay(NOW).toISOString()).toBe("2026-08-13T00:00:00.000Z");
  });

  it("is idempotent at exactly midnight", () => {
    const midnight = new Date("2026-08-13T00:00:00.000Z");
    expect(startOfUtcDay(midnight).getTime()).toBe(midnight.getTime());
  });
});

describe("revenuePeriods", () => {
  const [today, week, month] = revenuePeriods(NOW);

  it("today = UTC-midnight-to-now vs the full previous day", () => {
    expect(today.current.start.toISOString()).toBe("2026-08-13T00:00:00.000Z");
    expect(today.current.end.getTime()).toBe(NOW.getTime());
    expect(today.previous.start.toISOString()).toBe("2026-08-12T00:00:00.000Z");
    expect(today.previous.end.toISOString()).toBe("2026-08-13T00:00:00.000Z");
  });

  it("rolling windows are exactly 7 and 30 days long", () => {
    expect(week.current.end.getTime() - week.current.start.getTime()).toBe(
      7 * DAY_MS,
    );
    expect(month.current.end.getTime() - month.current.start.getTime()).toBe(
      30 * DAY_MS,
    );
  });

  it("previous windows abut the current ones — no gap, no overlap", () => {
    for (const spec of [today, week, month]) {
      expect(spec.previous.end.getTime()).toBe(spec.current.start.getTime());
    }
  });

  it("previous rolling windows match their current length", () => {
    expect(week.previous.end.getTime() - week.previous.start.getTime()).toBe(
      7 * DAY_MS,
    );
    expect(month.previous.end.getTime() - month.previous.start.getTime()).toBe(
      30 * DAY_MS,
    );
  });

  it("labels the periods honestly (prior-period, not calendar)", () => {
    expect(today.period).toBe("vs yesterday");
    expect(week.period).toBe("vs prior 7 days");
    expect(month.period).toBe("vs prior 30 days");
  });
});

describe("percentChange", () => {
  it("computes growth to one decimal place", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(100, 150)).toBe(-33.3);
    expect(percentChange(102.5, 100)).toBe(2.5);
  });

  it("rounds, not truncates", () => {
    expect(percentChange(100.06, 100)).toBe(0.1);
  });

  it("returns null when the baseline is zero — never Infinity or a fake 0%", () => {
    expect(percentChange(500, 0)).toBeNull();
    expect(percentChange(0, 0)).toBeNull();
  });

  it("returns null for a negative baseline (refund-heavy prior period)", () => {
    expect(percentChange(100, -50)).toBeNull();
  });

  it("reports a full drop as -100%", () => {
    expect(percentChange(0, 200)).toBe(-100);
  });
});
