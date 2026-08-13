/**
 * Pure period-window math for the tenant analytics "Revenue Overview" cards.
 * All windows are UTC and half-open: [start, end). Kept free of Prisma so the
 * boundary logic is unit-testable without a database.
 */

export interface PeriodWindow {
  start: Date;
  end: Date;
}

export interface PeriodSpec {
  key: "today" | "week" | "month";
  label: string;
  period: string;
  current: PeriodWindow;
  previous: PeriodWindow;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfUtcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

/**
 * Today-so-far vs yesterday (full day), rolling 7d vs the 7d before, rolling
 * 30d vs the 30d before. Rolling windows abut exactly — no gap, no overlap.
 */
export function revenuePeriods(now: Date): PeriodSpec[] {
  const todayStart = startOfUtcDay(now);
  const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);
  const daysAgo = (n: number) => new Date(now.getTime() - n * DAY_MS);

  return [
    {
      key: "today",
      label: "Today's Revenue",
      period: "vs yesterday",
      current: { start: todayStart, end: now },
      previous: { start: yesterdayStart, end: todayStart },
    },
    {
      key: "week",
      label: "This Week",
      period: "vs prior 7 days",
      current: { start: daysAgo(7), end: now },
      previous: { start: daysAgo(14), end: daysAgo(7) },
    },
    {
      key: "month",
      label: "This Month",
      period: "vs prior 30 days",
      current: { start: daysAgo(30), end: now },
      previous: { start: daysAgo(60), end: daysAgo(30) },
    },
  ];
}

/**
 * Percent change to one decimal place. Null when there is no meaningful
 * baseline (previous <= 0) — the UI renders that as "—", never a fake 0%.
 */
export function percentChange(
  current: number,
  previous: number,
): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
