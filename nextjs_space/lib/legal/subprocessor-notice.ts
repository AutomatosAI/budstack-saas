/**
 * Notice and objection rules for the sub-processor register.
 *
 * The DPA (§6) makes two promises to operators: at least 30 days' notice before
 * a new sub-processor starts processing, and 14 days from announcement to
 * object. Both were prose with no mechanism behind them. These are the rules
 * that give them effect.
 *
 * Pure — no database, no clock of its own — so the windows can be tested
 * exhaustively rather than by waiting a month.
 *
 * See docs/PRDS/prd-data-protection-remediation.md (WS3, US-012/013/014).
 */

/** DPA §6: minimum advance notice before a sub-processor may begin processing. */
export const MIN_NOTICE_DAYS = 30;

/** DPA §6: how long an operator has to object after announcement. */
export const OBJECTION_WINDOW_DAYS = 14;

export type SubprocessorStatus = "pending" | "active" | "retired";

/**
 * A register row.
 *
 * Declared by hand because `prisma` is exported as `any` (lib/db.ts), so query
 * results carry no type and every callback parameter over them lands as an
 * implicit `any`. Annotating the query result restores checking at the one
 * boundary that matters.
 */
export interface SubprocessorRecord {
  id: string;
  name: string;
  purpose: string;
  region: string;
  transferMechanism: string;
  dpaUrl: string | null;
  status: string;
  effectiveFrom: Date;
  announcedAt: Date | null;
  retiredAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / DAY_MS;
}

/** The earliest compliant effective date for something announced now. */
export function earliestEffectiveFrom(now: Date): Date {
  return addDays(now, MIN_NOTICE_DAYS);
}

/**
 * Whether `effectiveFrom` gives operators the notice the DPA promises.
 *
 * Measured from announcement, not from creation: a record that sits unannounced
 * for a fortnight has given nobody anything.
 */
export function hasSufficientNotice(announcedAt: Date, effectiveFrom: Date): boolean {
  return daysBetween(announcedAt, effectiveFrom) >= MIN_NOTICE_DAYS;
}

/** Whether an objection arrived after the DPA's 14-day window. */
export function isObjectionOutOfWindow(announcedAt: Date, raisedAt: Date): boolean {
  return daysBetween(announcedAt, raisedAt) > OBJECTION_WINDOW_DAYS;
}

/**
 * Whether a pending entry has reached its effective date and should flip to
 * active. Unannounced entries never activate — processing must not begin on a
 * vendor operators were never told about, whatever the date says.
 */
export function shouldActivate(
  entry: { status: string; effectiveFrom: Date; announcedAt: Date | null },
  now: Date,
): boolean {
  if (entry.status !== "pending") return false;
  if (!entry.announcedAt) return false;
  return now >= entry.effectiveFrom;
}

/** Human-readable summary of where a pending entry is in its notice period. */
export function noticeState(
  entry: { status: string; effectiveFrom: Date; announcedAt: Date | null },
  now: Date,
): "in-force" | "retired" | "awaiting-announcement" | "in-notice-period" | "due-to-activate" {
  if (entry.status === "active") return "in-force";
  if (entry.status === "retired") return "retired";
  if (!entry.announcedAt) return "awaiting-announcement";
  return now >= entry.effectiveFrom ? "due-to-activate" : "in-notice-period";
}
