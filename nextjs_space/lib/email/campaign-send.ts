/**
 * US-019 — the rules a campaign fan-out obeys, with no I/O in sight.
 *
 * PURE AND BROWSER-SAFE, like `campaign-rules.ts`: the send panel needs the
 * status sets and the refusal copy, the route needs the guards, the worker
 * needs the payload shape, and none of them should drag Prisma or BullMQ in
 * behind them. The database half lives in `campaign-fan-out.ts` and
 * `campaign-recipient-store.ts`.
 */

import type { CampaignRecipientStatus } from "@prisma/client";

import { TRACKING_TOKEN_VARIABLE } from "@/lib/email/email-tracking";

/**
 * Messages per minute a single fan-out is spaced to.
 *
 * A tenant sends through their OWN SMTP (BYO — see the PRD's non-goals), and a
 * Gmail app password dies at roughly 500 messages a day. Blasting a thousand
 * messages the instant an author clicks Send is how a store loses the mailbox
 * it also sends order confirmations from, so the fan-out spaces its jobs by
 * default rather than only when someone remembers to configure it.
 */
export const DEFAULT_CAMPAIGN_RATE_PER_MINUTE = 60;

/** One a minute at the slowest; 3600 is a message a second, which is not a cap. */
const MIN_CAMPAIGN_RATE_PER_MINUTE = 1;
const MAX_CAMPAIGN_RATE_PER_MINUTE = 3600;

const MS_PER_MINUTE = 60_000;

/**
 * The biggest list one click may fan out.
 *
 * Not a product limit — a blast radius. Everything past this point (the
 * recipient rows, the log rows, the queue payloads) is written inside a single
 * request, and a mistake at 50,000 addresses is unrecoverable in a way the same
 * mistake at 5,000 is not. The refusal names the number so it reads as a
 * deliberate ceiling rather than a timeout.
 */
export const CAMPAIGN_MAX_RECIPIENTS = 5000;

/**
 * 5 sends a minute per admin, failing CLOSED. This is the one endpoint on the
 * surface that puts real mail in front of real people, so a Redis outage must
 * cost a retry rather than an unmetered send loop.
 */
export const CAMPAIGN_SEND_RATE_LIMIT = {
  maxRequests: 5,
  windowMs: 60_000,
  failMode: "closed",
} as const;

/** Namespaced so a send never shares a counter with another endpoint. */
export function campaignSendRateLimitKey(scope: string): string {
  return `campaign-send:${scope}`;
}

export const CAMPAIGN_NO_AUDIENCE_MESSAGE =
  "Choose who this campaign goes to before sending it.";

export const CAMPAIGN_EMPTY_AUDIENCE_MESSAGE =
  "Nobody in that audience can be mailed right now — every address is either unconfirmed, without marketing consent, or unsubscribed.";

export const CAMPAIGN_TOO_MANY_RECIPIENTS_MESSAGE = `That audience is larger than ${CAMPAIGN_MAX_RECIPIENTS} people, which is more than one send may fan out. Narrow the audience and send it in parts.`;

export const CAMPAIGN_NOT_SENDABLE_MESSAGE =
  "This campaign is already sending, or has already been sent. Duplicate it to send it again.";

export const CAMPAIGN_NOT_CANCELLABLE_MESSAGE =
  "Only a scheduled or sending campaign can be cancelled.";

/**
 * Machine-matchable, like `SUPPRESSED_LOG_MESSAGE`: the results page (US-026)
 * separates "we tried and it bounced" from "we never tried" on this prefix, so
 * widen the sentence after it rather than reword it.
 */
export const CAMPAIGN_CANCELLED_REASON = "cancelled";
export const CAMPAIGN_CANCELLED_LOG_MESSAGE = `${CAMPAIGN_CANCELLED_REASON}: the campaign was cancelled before this message was sent`;

/** The campaign row vanished between enqueue and send — nothing left to render. */
export const CAMPAIGN_MISSING_LOG_MESSAGE =
  "campaign-missing: the campaign this message belongs to no longer exists";

/**
 * How a person is addressed when the store knows their address and nothing
 * else — which is every newsletter subscriber, by design.
 */
export const CAMPAIGN_NAME_FALLBACK = "there";

/** Recipient states that still owe the campaign an outcome. */
export const CAMPAIGN_UNFINISHED_RECIPIENT_STATUSES = [
  "PENDING",
  "QUEUED",
] as const satisfies readonly CampaignRecipientStatus[];

/**
 * Read the per-tenant cap from the environment, defaulting and clamping rather
 * than trusting it. A typo'd `CAMPAIGN_RATE_PER_MINUTE=0` would otherwise mean
 * an infinite delay per job — a fan-out that silently never sends.
 */
export function campaignRatePerMinute(
  env: Record<string, string | undefined> = process.env,
): number {
  const parsed = Number(env.CAMPAIGN_RATE_PER_MINUTE);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_CAMPAIGN_RATE_PER_MINUTE;
  }
  return Math.min(
    MAX_CAMPAIGN_RATE_PER_MINUTE,
    Math.max(MIN_CAMPAIGN_RATE_PER_MINUTE, Math.floor(parsed)),
  );
}

/**
 * When the nth message of this fan-out becomes eligible to send.
 *
 * Delayed-job spacing rather than a worker-side token bucket: the cap belongs
 * to the send, the queue already knows how to hold a job until a timestamp, and
 * a worker that restarts mid-campaign resumes the same schedule instead of
 * re-deciding it. The first message goes immediately, so a small list still
 * feels instant.
 */
export function campaignJobDelayMs(
  index: number,
  ratePerMinute: number,
): number {
  if (index <= 0) return 0;
  return Math.round((index * MS_PER_MINUTE) / ratePerMinute);
}

export interface CampaignVariableInput {
  readonly businessName: string;
  readonly baseUrl: string;
  readonly subdomain: string;
  readonly email: string;
  readonly name?: string | null;
  readonly unsubscribeUrl: string;
  /**
   * US-027's signed recipient token, or nothing when this store has not turned
   * tracking on. Minted in `campaign-fan-out.ts` (it needs node crypto; this
   * module is browser-safe) and passed in as a plain value.
   */
  readonly trackingToken?: string | null;
}

/**
 * What `{{tags}}` are worth for ONE recipient.
 *
 * Values only — never template source. Every one of these is filled through
 * `{{ }}`, which escapes, so a subscriber who signed up as
 * `<script>alert(1)</script>` is a harmless string in the rendered email
 * (`lib/email/email-merge-tags.ts` explains why that separation is load-bearing).
 *
 * The keys mirror `baseSampleVariables()` so what a test send showed the author
 * is what the fan-out fills — minus the ones no campaign can honestly answer
 * (order numbers, reset links), which stay empty rather than invented.
 */
export function campaignRecipientVariables(
  input: CampaignVariableInput,
): Record<string, string> {
  const userName = input.name?.trim() || CAMPAIGN_NAME_FALLBACK;
  return {
    businessName: input.businessName,
    tenantName: input.businessName,
    subdomain: input.subdomain,
    loginUrl: `${input.baseUrl}/auth/signin`,
    userName,
    name: userName,
    email: input.email,
    unsubscribeUrl: input.unsubscribeUrl,
    // Absent rather than empty when tracking is off, so a payload from an
    // untracked store is the same object it was before US-027. A body saved
    // while tracking WAS on still compiles: Handlebars fills a missing key with
    // an empty string, and both routes treat an unverifiable token as "record
    // nothing" while still serving the pixel and following the link.
    ...(input.trackingToken
      ? { [TRACKING_TOKEN_VARIABLE]: input.trackingToken }
      : {}),
  };
}

/** The campaign fields a fan-out job adds to the existing queue payload. */
export interface CampaignJobTarget {
  readonly campaignId: string;
  readonly recipientId: string;
}

/**
 * Narrow a queue payload to its campaign linkage, or null.
 *
 * Null means "not a campaign job", which is every transactional send and every
 * job enqueued before this story — the same versioned-by-tolerance rule
 * `category` and `logId` follow. Both ids are required together: half a linkage
 * is a payload this worker cannot act on, and guessing at the other half would
 * write an outcome onto the wrong recipient row.
 */
export function campaignJobTarget(data: unknown): CampaignJobTarget | null {
  if (typeof data !== "object" || data === null) return null;
  const { campaignId, recipientId } = data as Record<string, unknown>;
  if (typeof campaignId !== "string" || !campaignId) return null;
  if (typeof recipientId !== "string" || !recipientId) return null;
  return { campaignId, recipientId };
}

export interface CampaignStatusBucket {
  readonly status: CampaignRecipientStatus;
  readonly _count: { readonly _all: number };
}

export interface CampaignStats {
  readonly total: number;
  readonly sent: number;
  readonly failed: number;
  readonly suppressed: number;
  readonly pending: number;
}

const EMPTY_STATS: CampaignStats = {
  total: 0,
  sent: 0,
  failed: 0,
  suppressed: 0,
  pending: 0,
};

/** Fold `groupBy(['status'])` buckets for one campaign into its progress. */
export function summariseCampaignStats(
  buckets: readonly CampaignStatusBucket[],
): CampaignStats {
  return buckets.reduce<CampaignStats>((stats, bucket) => {
    const count = bucket._count._all;
    return {
      total: stats.total + count,
      sent: stats.sent + (bucket.status === "SENT" ? count : 0),
      failed: stats.failed + (bucket.status === "FAILED" ? count : 0),
      suppressed: stats.suppressed + (bucket.status === "SUPPRESSED" ? count : 0),
      pending:
        stats.pending +
        ((CAMPAIGN_UNFINISHED_RECIPIENT_STATUSES as readonly string[]).includes(
          bucket.status,
        )
          ? count
          : 0),
    };
  }, EMPTY_STATS);
}
