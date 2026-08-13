import { describe, expect, it } from "vitest";

import {
  REORDER_CUTOFF_FALLBACK_DAYS,
  reorderCutoffDate,
  reorderCutoffDays,
  repeatRate,
  returningShare,
} from "@/lib/analytics/retention";

describe("repeatRate", () => {
  it("is the share of buyers with 2+ orders, to 1dp", () => {
    expect(repeatRate(1, 3)).toBe(33.3);
    expect(repeatRate(3, 3)).toBe(100);
    expect(repeatRate(0, 8)).toBe(0);
  });

  it("is null with no buyers — blank slate, not 0%", () => {
    expect(repeatRate(0, 0)).toBeNull();
  });
});

describe("returningShare", () => {
  it("is the returning slice of window revenue, to 1dp", () => {
    expect(returningShare(75, 100)).toBe(75);
    expect(returningShare(1, 3)).toBe(33.3);
  });

  it("is null when the window had no revenue", () => {
    expect(returningShare(0, 0)).toBeNull();
  });
});

describe("reorderCutoffDays", () => {
  it("falls back to 45 days when there is no reorder history", () => {
    expect(reorderCutoffDays(null)).toBe(REORDER_CUTOFF_FALLBACK_DAYS);
    expect(reorderCutoffDays(0)).toBe(REORDER_CUTOFF_FALLBACK_DAYS);
  });

  it("scales the median by 1.5×", () => {
    expect(reorderCutoffDays(30)).toBe(45);
    expect(reorderCutoffDays(40)).toBe(60);
  });

  it("clamps to [21, 90] so skewed history cannot go absurd", () => {
    expect(reorderCutoffDays(5)).toBe(21);
    expect(reorderCutoffDays(365)).toBe(90);
  });
});

describe("reorderCutoffDate", () => {
  it("subtracts the cutoff from now", () => {
    const now = new Date("2026-08-13T12:00:00.000Z");
    expect(reorderCutoffDate(30, now).toISOString()).toBe(
      "2026-06-29T12:00:00.000Z",
    );
  });
});
