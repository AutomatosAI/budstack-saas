/**
 * US-028 — where the reorder rule meets Prisma and the queue.
 *
 * SERVER ONLY. The rules are in `reorder-reminder.ts`; this is the query that
 * finds who is due, the conditional write that claims them, and the one job per
 * person that follows.
 *
 * Every query takes `tenantId` explicitly and puts it in the `where` itself
 * rather than leaning on the `lib/db.ts` scope layer — the rule
 * `campaign-audience-query.ts` and `segment-query.ts` follow, and for the same
 * reason twice over here: the sweep runs in the worker, where there is no bound
 * context to inherit, and the predicates below filter a RELATION (`orders`),
 * which the scope layer never rewrites. A relation predicate without its own
 * tenantId would reach across stores.
 */

import { randomUUID } from "crypto";

import { prisma } from "@/lib/db";
import {
  dedupeAudienceRecipients,
  excludeSuppressedRecipients,
  type AudienceRecipient,
} from "@/lib/email/campaign-audience";
import {
  campaignJobDelayMs,
  campaignRatePerMinute,
} from "@/lib/email/campaign-send";
import {
  REORDER_MAX_PER_SWEEP,
  REORDER_REMINDER_EVENT,
} from "@/lib/email/reorder-reminder";
import { normalizeEmail } from "@/lib/email/suppression";
import { findSuppressedRecipients } from "@/lib/email/suppression-store";
import { ERASURE_EMAIL_DOMAIN } from "@/lib/gdpr/erasure";
import { generateSubscriberToken } from "@/lib/email/newsletter-subscriptions";
import { getEmailQueue } from "@/lib/queue";

/** The job name the email worker already listens for. */
const SEND_EMAIL_JOB = "send-email";

/** One customer the rule matched, with the columns the send needs. */
export interface ReorderCandidate extends AudienceRecipient {
  /** Always set — a candidate is a customer row, never a bare address. */
  readonly userId: string;
  /** Their existing opt-out credential, or null until the first reminder. */
  readonly reorderReminderToken: string | null;
}

/**
 * The `users` predicate for the whole rule.
 *
 * The same four conditions `isReorderReminderDue` states in prose, expressed so
 * the database answers them instead of the sweep loading every customer:
 *
 *   1. `some` DELIVERED order in this store;
 *   2. `none` DELIVERED since the cutoff — together with (1) that IS "the most
 *      recent delivery is at least N days old", without needing a sort;
 *   3. `none` order of ANY status since the cutoff — the AC's "no newer order";
 *   4. never reminded, or last reminded before the cutoff.
 *
 * Consent is in the predicate and is not optional anywhere: a reminder is
 * marketing, and `marketingConsentAt` is the only record that this customer
 * agreed to receive it. GDPR-erased rows are excluded exactly as the consented-
 * customers audience excludes them — the row survives for order history, but
 * `deleted-<id>@deleted.local` is not an address.
 */
export function buildReorderCandidateWhere(
  tenantId: string,
  cutoff: Date,
): Record<string, unknown> {
  return {
    tenantId,
    role: "PATIENT",
    marketingConsentAt: { not: null },
    NOT: { email: { endsWith: `@${ERASURE_EMAIL_DOMAIN}` } },
    AND: [
      { orders: { some: { tenantId, status: "DELIVERED" } } },
      {
        orders: {
          none: { tenantId, status: "DELIVERED", updatedAt: { gt: cutoff } },
        },
      },
      { orders: { none: { tenantId, createdAt: { gt: cutoff } } } },
      {
        OR: [
          { reorderReminderAt: null },
          { reorderReminderAt: { lte: cutoff } },
        ],
      },
    ],
  };
}

export interface ReorderCandidates {
  readonly candidates: readonly ReorderCandidate[];
  /**
   * True when the query came back full, i.e. this store has more customers due
   * than one sweep will take. The rest keep their place for tomorrow — see
   * REORDER_MAX_PER_SWEEP.
   */
  readonly atCap: boolean;
}

/**
 * Everyone this store may remind right now, up to the per-sweep cap.
 *
 * Ordered longest-waiting first — never reminded before reminded once, and
 * older accounts before newer — so a store permanently at the cap works
 * through its list instead of mailing whichever rows Postgres happened to
 * return. Without it, truncation would be arbitrary AND unfair: the same
 * unlucky customers could be cut off every single day.
 *
 * Suppression (US-004) is applied after the dedupe, so a customer who
 * unsubscribed from an earlier reminder is dropped here rather than relying on
 * the worker's send-time check to catch them — that check is the backstop, and
 * a job that is only ever going to be refused should not be created.
 */
export async function findReorderCandidates(
  tenantId: string,
  cutoff: Date,
  limit: number = REORDER_MAX_PER_SWEEP,
): Promise<ReorderCandidates> {
  const rows: {
    id: string;
    email: string;
    name: string | null;
    reorderReminderToken: string | null;
  }[] = await prisma.users.findMany({
    where: buildReorderCandidateWhere(tenantId, cutoff),
    orderBy: [
      { reorderReminderAt: { sort: "asc", nulls: "first" } },
      { createdAt: "asc" },
    ],
    take: limit,
    select: {
      id: true,
      email: true,
      name: true,
      reorderReminderToken: true,
    },
  });

  const tokens = new Map(
    rows.map((row) => [normalizeEmail(row.email), row.reorderReminderToken]),
  );

  const recipients = dedupeAudienceRecipients(
    rows.map((row) => ({
      email: row.email,
      userId: row.id,
      name: row.name,
    })),
  );

  const suppressed = await findSuppressedRecipients(
    tenantId,
    recipients.map((recipient) => recipient.email),
  );

  const { recipients: kept } = excludeSuppressedRecipients(
    recipients,
    suppressed,
  );

  return {
    candidates: kept
      .filter((recipient): recipient is AudienceRecipient & { userId: string } =>
        Boolean(recipient.userId),
      )
      .map((recipient) => ({
        ...recipient,
        reorderReminderToken: tokens.get(recipient.email) ?? null,
      })),
    // Measured on the ROWS the query returned, not on what survived suppression:
    // a full page means there were more due, whatever this sweep went on to keep.
    atCap: rows.length >= limit,
  };
}

export interface ReorderClaim {
  /** False when another sweep got to this customer first. */
  readonly claimed: boolean;
  /** Their opt-out credential — the existing one, or the one just minted. */
  readonly token: string;
}

/**
 * Claim one customer for this sweep, and make sure they have a token.
 *
 * THE CONDITIONAL WRITE IS THE IDEMPOTENCY GUARD. The window predicate is IN
 * the update rather than checked before it — the same shape as US-019's
 * DRAFT|SCHEDULED -> SENDING claim — so two sweeps running at once (two workers,
 * a manual run alongside the scheduled one) cannot both mail the same person:
 * the second one matches zero rows and is told so.
 *
 * The token is minted on the FIRST reminder and never rotated afterwards,
 * because the link it signs is sitting in a message somebody may open next
 * month. Written in the same statement as the claim so a customer can never end
 * up claimed but tokenless.
 */
export async function claimReorderReminder(
  candidate: ReorderCandidate,
  tenantId: string,
  cutoff: Date,
  now: Date,
): Promise<ReorderClaim> {
  const token = candidate.reorderReminderToken ?? generateSubscriberToken();

  const { count } = await prisma.users.updateMany({
    where: {
      id: candidate.userId,
      tenantId,
      OR: [{ reorderReminderAt: null }, { reorderReminderAt: { lte: cutoff } }],
    },
    data: {
      reorderReminderAt: now,
      reorderReminderToken: token,
      updatedAt: now,
    },
  });

  return { claimed: count > 0, token };
}

export interface ReorderJobInput {
  readonly tenantId: string;
  readonly email: string;
  readonly subject: string;
  /** The tenant-branded fallback body, already filled for this recipient. */
  readonly html: string;
  readonly variables: Record<string, string>;
  /** Position in this store's sweep, for the shared per-minute cap. */
  readonly index: number;
  readonly ratePerMinute: number;
}

/**
 * Queue ONE message for ONE person, with its log row written first.
 *
 * Not `MailerService.send`: the log row's id has to be minted here so the
 * payload can carry it (US-008 linkage), and the `templateName` is the event the
 * worker looks a mapped template up by — which is the whole point of routing
 * this through `reorderReminder` rather than sending fixed HTML.
 *
 * Spaced by the SAME cap a campaign fan-out uses. A store's reminder sweep and
 * its campaigns go out of one BYO SMTP mailbox, and a daily automation that
 * ignored the cap would be the thing that gets that mailbox suspended.
 */
export async function enqueueReorderReminder(
  input: ReorderJobInput,
): Promise<void> {
  const logId = randomUUID();

  await prisma.email_logs.create({
    data: {
      id: logId,
      tenantId: input.tenantId,
      recipient: input.email,
      subject: input.subject,
      templateName: REORDER_REMINDER_EVENT,
      status: "QUEUED",
    },
  });

  await getEmailQueue().add(
    SEND_EMAIL_JOB,
    {
      tenantId: input.tenantId,
      // ONE address. Never an array — see `campaign-fan-out.ts`.
      to: input.email,
      subject: input.subject,
      html: input.html,
      templateName: REORDER_REMINDER_EVENT,
      category: "marketing",
      variables: input.variables,
      logId,
    },
    { delay: campaignJobDelayMs(input.index, input.ratePerMinute) },
  );
}

/** Re-exported so the runner spaces its sweep on the one shared setting. */
export { campaignRatePerMinute as reorderRatePerMinute };
