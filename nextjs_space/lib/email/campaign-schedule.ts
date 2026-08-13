/**
 * US-021 — the rules a scheduled campaign obeys, with no I/O in sight.
 *
 * PURE AND BROWSER-SAFE, like `campaign-rules.ts` and `campaign-send.ts`: the
 * compose screen needs the bounds to put a `min`/`max` on its picker and the
 * refusal copy to explain a rejection, the route needs the same bounds to
 * enforce them, and the worker needs the send-time decision. None of them
 * should drag Prisma or BullMQ in behind them — that half lives in
 * `campaign-schedule-store.ts` and `campaign-scheduled-runner.ts`.
 */

import type { CampaignStatus } from "@prisma/client";

/** The job name the campaign queue's worker listens for. */
export const CAMPAIGN_SCHEDULE_JOB = "campaign-scheduled-send";

/**
 * How far ahead a schedule must be set.
 *
 * A minute, not zero: `datetime-local` is minute-granular, so "now" rounds to a
 * time that is already in the past by the time the request lands, and a delay of
 * zero is not a schedule — it is a send, which has its own button and its own
 * confirmation.
 */
export const CAMPAIGN_SCHEDULE_MIN_LEAD_MS = 60_000;

/**
 * How far ahead a schedule may be set.
 *
 * The delay is held by BullMQ, which is to say by Redis, and a job dated
 * further out than the store is expected to survive is a promise the queue
 * cannot keep. 90 days is well past any newsletter anyone is actually planning
 * and well short of pretending Redis is a database.
 */
export const CAMPAIGN_SCHEDULE_MAX_HORIZON_MS = 90 * 24 * 60 * 60 * 1000;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const CAMPAIGN_SCHEDULE_INVALID_TIME_MESSAGE =
  "That send time could not be read. Pick a date and time from the calendar.";

export const CAMPAIGN_SCHEDULE_TOO_SOON_MESSAGE =
  "Pick a time at least a minute from now. To send straight away, use Send now instead.";

export const CAMPAIGN_SCHEDULE_TOO_FAR_MESSAGE = `A campaign can be scheduled up to ${CAMPAIGN_SCHEDULE_MAX_HORIZON_MS / MS_PER_DAY} days ahead. Choose a nearer date.`;

/**
 * Metered on the same terms as a send (`CAMPAIGN_SEND_RATE_LIMIT`, failing
 * closed) under a key of its own: scheduling writes to Redis, so a Redis
 * outage must cost a retry rather than an unmetered loop of enqueues.
 */
export function campaignScheduleRateLimitKey(scope: string): string {
  return `campaign-schedule:${scope}`;
}

/**
 * Whether this time is one a campaign may be scheduled for — the message to
 * show the author, or null when it is fine.
 *
 * `now` is a parameter rather than a `Date.now()` call so the route and the
 * test decide the same way.
 */
export function validateScheduleTime(at: Date, now: Date): string | null {
  const target = at.getTime();
  if (!Number.isFinite(target)) return CAMPAIGN_SCHEDULE_INVALID_TIME_MESSAGE;

  const lead = target - now.getTime();
  if (lead < CAMPAIGN_SCHEDULE_MIN_LEAD_MS) {
    return CAMPAIGN_SCHEDULE_TOO_SOON_MESSAGE;
  }
  if (lead > CAMPAIGN_SCHEDULE_MAX_HORIZON_MS) {
    return CAMPAIGN_SCHEDULE_TOO_FAR_MESSAGE;
  }
  return null;
}

/**
 * How long the trigger job waits before it fires.
 *
 * Clamped at zero because a delay is a duration, not an instant: a validated
 * time can still round down to the past between the check and the enqueue, and
 * a negative delay is a job BullMQ would never promote.
 */
export function campaignScheduleDelayMs(at: Date, now: Date): number {
  return Math.max(0, at.getTime() - now.getTime());
}

/** The campaign columns the send-time guard reads. */
export interface ScheduledCampaignRow {
  readonly status: CampaignStatus;
  readonly scheduledJobId: string | null;
}

export type ScheduledSendDecision =
  | "SEND"
  /** The campaign was deleted between scheduling and firing. */
  | "MISSING"
  /** An admin called it off while it waited. */
  | "CANCELLED"
  /** It left SCHEDULED some other way — sent by hand, or already sending. */
  | "NOT_SCHEDULED"
  /** A later schedule replaced this trigger and this job outlived its removal. */
  | "SUPERSEDED";

/**
 * Whether this trigger job may still start a fan-out.
 *
 * THE SEND-TIME GUARD, and the reason a cancelled campaign never sends: the
 * decision is made against the campaign row as it stands the moment the job
 * runs, never against anything the payload carried from scheduling time.
 *
 * The `scheduledJobId` comparison is the second half of it. Rescheduling
 * removes the previous delayed job, but a removal is a network call that can
 * fail while the database write that replaced it succeeded — so the surviving
 * job would fire against a campaign that is legitimately still SCHEDULED. It
 * refuses because the campaign is no longer waiting on IT, which is what makes
 * "reschedule" a replacement rather than an addition.
 */
export function scheduledSendDecision(
  campaign: ScheduledCampaignRow | null,
  jobId: string,
): ScheduledSendDecision {
  if (!campaign) return "MISSING";
  if (campaign.status === "CANCELLED") return "CANCELLED";
  if (campaign.status !== "SCHEDULED") return "NOT_SCHEDULED";
  if (campaign.scheduledJobId !== jobId) return "SUPERSEDED";
  return "SEND";
}

/** Why a trigger job did nothing, for the worker's own output. */
export const SCHEDULED_SEND_REASON: Record<
  Exclude<ScheduledSendDecision, "SEND">,
  string
> = {
  MISSING: "the campaign no longer exists",
  CANCELLED: "the campaign was cancelled before its send time",
  NOT_SCHEDULED: "the campaign is no longer scheduled",
  SUPERSEDED: "a later schedule replaced this trigger",
};
