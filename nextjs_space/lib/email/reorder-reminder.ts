/**
 * US-028 — the rules the reorder-reminder automation obeys, with no I/O in sight.
 *
 * PURE AND BROWSER-SAFE, like `campaign-send.ts` and `campaign-schedule.ts`: the
 * settings screen needs the bounds and the copy, the API route needs the same
 * bounds to enforce them, and the sweep needs the window decision. None of them
 * should drag Prisma or BullMQ in behind them — that half lives in
 * `reorder-reminder-store.ts` and `reorder-reminder-runner.ts`.
 *
 * OFF UNTIL ASKED FOR. Nothing here is enabled by default: an absent setting, a
 * settings blob that will not parse, and an explicit `false` all mean the same
 * thing, because a store that has never mentioned this automation has not
 * consented to it mailing their customers.
 */

import { parseTenantSettings } from "@/lib/tenant/tenant-settings";

/**
 * The event type this automation sends under.
 *
 * NOT reserved (`lib/email/reserved-event-types.ts`), on purpose: unlike
 * "campaign" and "test-send", a store SHOULD be able to point this event at a
 * template of their own. That is the whole reason it appears in the event
 * mapper — the worker's existing lookup keys on this string and swaps in
 * whatever the store mapped, exactly as it does for `orderConfirmation`.
 */
export const REORDER_REMINDER_EVENT = "reorderReminder";

/** `tenants.settings` keys. Absent means off, which is the default. */
export const REORDER_REMINDER_SETTING = "reorderReminderEnabled";
export const REORDER_REMINDER_DAYS_SETTING = "reorderReminderDays";

/**
 * How long after a delivered order the reminder goes out.
 *
 * 60 days is the PRD's figure and roughly a monthly-repeat customer missing one
 * cycle. It is a default rather than a constant because "how long does your
 * product last" is a question only the store can answer.
 */
export const DEFAULT_REORDER_REMINDER_DAYS = 60;

/**
 * A week at the shortest. Anything less mails somebody who has barely opened the
 * box, which is the one direction this feature can actively damage a store —
 * and the reminder is also the window, so a 1-day rule would mail the same
 * person every day they stayed eligible.
 */
export const MIN_REORDER_REMINDER_DAYS = 7;

/** A year at the longest — past that it is not a reminder, it is a cold email. */
export const MAX_REORDER_REMINDER_DAYS = 365;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The most reminders ONE store may have queued by ONE sweep.
 *
 * Not a product limit — a blast radius, the reason `CAMPAIGN_MAX_RECIPIENTS`
 * exists. Every message past this point is a row and a queue payload written
 * inside one job, and at the default 60-a-minute cap 5,000 messages is already
 * most of a day's sending.
 *
 * Truncation is SELF-HEALING and that is what makes it safe: a customer left
 * over is still inside their window tomorrow, so they are simply first in line
 * on the next run rather than dropped. The sweep says how many it left
 * (`ReorderTenantOutcome.deferred`) so a store at the cap is visible in the
 * worker's output instead of looking like it finished.
 */
export const REORDER_MAX_PER_SWEEP = 5000;

/** The job the repeatable scheduler produces, and the worker listens for. */
export const REORDER_REMINDER_JOB = "reorder-reminder-sweep";

/**
 * The scheduler's id. STABLE AND FIXED, which is what makes registration
 * idempotent: `upsertJobScheduler` keys on this string, so every worker in a
 * scaled-out deployment registering the same id on boot converges on ONE
 * scheduler rather than N of them producing N sweeps a day.
 */
export const REORDER_REMINDER_SCHEDULER_ID = "reorder-reminder-daily";

/**
 * Once a day, at 03:00 UTC.
 *
 * A fixed hour rather than an interval, so restarts do not walk the send time
 * around the clock, and an off-peak one because the sweep reads every enabled
 * store's customer base. A reminder is not time-critical to the hour — the
 * window it enforces is measured in weeks.
 */
export const REORDER_REMINDER_CRON = "0 3 * * *";

/** Default subject. `{{businessName}}` is filled by the worker's compile step. */
export const REORDER_REMINDER_SUBJECT = "Time to reorder from {{businessName}}?";

export const REORDER_REMINDER_DAYS_MESSAGE = `Choose between ${MIN_REORDER_REMINDER_DAYS} and ${MAX_REORDER_REMINDER_DAYS} days.`;

/** The rule as the sweep reads it. */
export interface ReorderReminderRule {
  readonly enabled: boolean;
  readonly days: number;
}

/** A whole number inside [min, max]. Rejects NaN, Infinity and 1.5 alike. */
function boundedDays(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= MIN_REORDER_REMINDER_DAYS && value <= MAX_REORDER_REMINDER_DAYS
    ? value
    : null;
}

/**
 * This store's rule, read from its `settings` blob.
 *
 * A days value that is missing, out of bounds or not a number falls back to the
 * default rather than disabling the automation: the switch is what says whether
 * to send, and an unreadable interval is a configuration problem, not consent
 * being withdrawn. It falls back UP to 60 days, which is the conservative
 * direction — a shorter window mails people sooner.
 */
export function resolveReorderReminderRule(
  settings: unknown,
  tenantId?: string,
): ReorderReminderRule {
  const parsed = parseTenantSettings(settings, { tenantId });
  return {
    enabled: parsed[REORDER_REMINDER_SETTING] === true,
    days:
      boundedDays(parsed[REORDER_REMINDER_DAYS_SETTING]) ??
      DEFAULT_REORDER_REMINDER_DAYS,
  };
}

/**
 * The instant `days` before `now` — the line every part of the rule is drawn
 * against.
 *
 * ONE cutoff for all four questions (is the delivery old enough, has there been
 * a newer order, was this customer reminded recently, may they be claimed) so
 * the window cannot mean two slightly different things in two queries.
 */
export function reorderCutoff(now: Date, days: number): Date {
  return new Date(now.getTime() - days * MS_PER_DAY);
}

/** What the window decision needs to know about one customer. */
export interface ReorderCandidateHistory {
  /**
   * When this customer's most recent DELIVERED order reached that state.
   *
   * `orders` records no `deliveredAt`, so the sweep reads `updatedAt` on the
   * delivered row — the closest thing to when the status was written. It moves
   * if an admin later edits the order, which can only push a reminder LATER,
   * and later is the harmless direction: the failure this feature must not have
   * is mailing "time to reorder?" to somebody whose parcel just arrived.
   */
  readonly lastDeliveredAt: Date | null;
  /** When this customer last ordered ANYTHING, whatever its status. */
  readonly lastOrderAt: Date | null;
  /** When the automation last mailed them, or null for never. */
  readonly lastRemindedAt: Date | null;
}

/**
 * Is this customer due a reminder right now?
 *
 * Four conditions, and each one is a different way of being wrong:
 *
 *   1. they have a DELIVERED order at all — nothing to reorder otherwise;
 *   2. that delivery is at least `days` old — the window itself;
 *   3. they have not ordered again since the cutoff — the AC's "no newer
 *      order", checked against EVERY order and not just delivered ones, because
 *      someone whose next order is still in transit has already reordered;
 *   4. they were not reminded within the window — once per customer per window.
 *
 * `now` and `days` are parameters rather than ambient state so the sweep, the
 * database query and the test all draw the line in the same place.
 *
 * This is the readable statement of the rule; `buildReorderCandidateWhere`
 * expresses the same four conditions as a Prisma predicate so the sweep does not
 * load a store's entire customer base to fold it here. They are checked against
 * each other in `tests/unit/reorder-reminder.test.ts`.
 */
export function isReorderReminderDue(
  history: ReorderCandidateHistory,
  now: Date,
  days: number,
): boolean {
  const cutoff = reorderCutoff(now, days).getTime();

  if (!history.lastDeliveredAt) return false;
  if (history.lastDeliveredAt.getTime() > cutoff) return false;
  if (history.lastOrderAt && history.lastOrderAt.getTime() > cutoff) return false;
  if (history.lastRemindedAt && history.lastRemindedAt.getTime() > cutoff) {
    return false;
  }
  return true;
}
