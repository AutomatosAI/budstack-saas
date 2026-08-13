/**
 * Pure helpers for the retention/reorder analytics block. SQL lives in the
 * analytics route; everything here is arithmetic kept testable without a DB.
 */

export interface RetentionMetrics {
  /** % of buyers with 2+ non-cancelled orders, 1dp. Null until 1+ buyer. */
  repeatRate: number | null;
  /** Median days between consecutive orders, 1dp. Null until a reorder exists. */
  medianReorderDays: number | null;
  /** Buyers whose latest order is older than the reorder cutoff. */
  overdueCustomers: number;
  /** Window-scoped split of revenue between first-ever and repeat orders. */
  newVsReturning: {
    newRevenue: number;
    returningRevenue: number;
    newOrders: number;
    returningOrders: number;
    /** % of window revenue from returning customers, 1dp. Null if no revenue. */
    returningShare: number | null;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function repeatRate(repeaters: number, buyers: number): number | null {
  if (buyers <= 0) return null;
  return round1((repeaters / buyers) * 100);
}

export function returningShare(
  returningRevenue: number,
  totalWindowRevenue: number,
): number | null {
  if (totalWindowRevenue <= 0) return null;
  return round1((returningRevenue / totalWindowRevenue) * 100);
}

/**
 * A customer counts as overdue when their last order is older than 1.5× the
 * store's median reorder cycle, clamped to [21, 90] days so a thin or skewed
 * history can't produce a nonsense threshold. Stores with no reorder history
 * yet fall back to 45 days.
 */
export const REORDER_CUTOFF_FALLBACK_DAYS = 45;
export const REORDER_CUTOFF_MIN_DAYS = 21;
export const REORDER_CUTOFF_MAX_DAYS = 90;

export function reorderCutoffDays(medianReorderDays: number | null): number {
  if (medianReorderDays === null || medianReorderDays <= 0) {
    return REORDER_CUTOFF_FALLBACK_DAYS;
  }
  const scaled = Math.round(medianReorderDays * 1.5);
  return Math.min(
    REORDER_CUTOFF_MAX_DAYS,
    Math.max(REORDER_CUTOFF_MIN_DAYS, scaled),
  );
}

export function reorderCutoffDate(
  medianReorderDays: number | null,
  now: Date,
): Date {
  const days = reorderCutoffDays(medianReorderDays);
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
