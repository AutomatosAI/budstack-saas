/**
 * US-008 — deterministic `email_logs` linkage.
 *
 * The send path used to enqueue the job and write its log row AFTERWARDS, and
 * the worker then had to find that row again by
 * (tenantId, recipient, subject, status=QUEUED). Under concurrency that
 * heuristic mis-attributes: two sends to the same address with the same subject
 * race for one row, and a campaign fan-out (US-019) makes that the normal case
 * rather than the edge case. Worse, the worker can win the race outright and
 * find no row at all, so a delivered email is logged twice — once QUEUED by the
 * request, once SENT by the worker.
 *
 * Now the row is created FIRST and its id travels in the BullMQ payload; the
 * worker updates exactly that row. The heuristic survives for one case only: a
 * job enqueued before this shipped and still in Redis when the new worker boots.
 * Absent `logId` means legacy — the same "versioned by tolerance" rule the
 * `category` field uses.
 *
 * Every function takes `tenantId` explicitly and puts it in the query, so the
 * worker — which runs outside any request context — can call these under
 * `bypassTenantScope()` and stay tenant-correct.
 */

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * The `recipient` column as the send path writes it: the raw envelope, not the
 * parsed addresses `recipientAddresses()` produces for suppression lookups. A
 * legacy multi-recipient job joins with a comma — the shape nodemailer accepts
 * and the shape the heuristic fallback below has to match on.
 */
export function logRecipient(to: string | string[]): string {
  return Array.isArray(to) ? to.join(",") : to;
}

/** Everything needed to reach the log row, deterministically or by fallback. */
export interface EmailLogTarget {
  /** Row created by `createQueuedEmailLog`. Absent on pre-US-008 jobs. */
  readonly logId?: string | null;
  readonly tenantId: string;
  readonly to: string | string[];
  readonly subject: string;
  readonly templateName: string;
}

/** The terminal state of one delivery attempt. */
interface EmailLogOutcome {
  readonly status: "SENT" | "FAILED";
  readonly smtpResponse?: string;
  readonly errorMessage?: string;
  readonly sentAt?: Date;
}

export interface QueuedEmailLogInput {
  readonly tenantId: string;
  readonly to: string | string[];
  readonly subject: string;
  readonly templateName: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Write the QUEUED row and return its id for the job payload.
 *
 * Returns null when the write fails rather than throwing: the caller enqueues
 * regardless, the worker then falls back to the heuristic, and a logging outage
 * never costs a customer their email. `SYSTEM` sends are the recurring case —
 * `email_logs.tenantId` is a foreign key, so a send attributed to no real tenant
 * cannot be logged at all.
 */
export async function createQueuedEmailLog(
  input: QueuedEmailLogInput,
): Promise<string | null> {
  try {
    const row = await prisma.email_logs.create({
      data: {
        tenantId: input.tenantId,
        recipient: logRecipient(input.to),
        subject: input.subject,
        templateName: input.templateName,
        status: "QUEUED",
        metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
      },
      select: { id: true },
    });
    return row.id;
  } catch (error) {
    logger.error("[MailerService] Failed to create initial email log", {
      tenantId: input.tenantId,
      templateName: input.templateName,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Find the row the old way: newest QUEUED row for this tenant/recipient/subject.
 * Only reachable for a job that predates the `logId` payload field.
 */
async function findLegacyQueuedLogId(
  target: EmailLogTarget,
): Promise<string | null> {
  const queued = await prisma.email_logs.findFirst({
    where: {
      tenantId: target.tenantId,
      recipient: logRecipient(target.to),
      subject: target.subject,
      status: "QUEUED",
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return queued?.id ?? null;
}

/**
 * Record the outcome against the job's own row, creating one if it cannot be
 * reached (legacy job with no QUEUED row left, or a row deleted mid-flight).
 *
 * The `logId` update deliberately does NOT filter on `status: QUEUED`: a BullMQ
 * retry after a FAILED attempt has to land on the same row, not fork a second
 * one. `updateMany` rather than `update` so a vanished row is a count of 0 to
 * handle instead of a P2025 to catch, and so `tenantId` can be part of the
 * predicate.
 */
async function finalizeEmailLog(
  target: EmailLogTarget,
  outcome: EmailLogOutcome,
): Promise<void> {
  const linkedId = target.logId
    ? target.logId
    : await findLegacyQueuedLogId(target);

  if (linkedId) {
    const { count } = await prisma.email_logs.updateMany({
      where: { id: linkedId, tenantId: target.tenantId },
      data: { ...outcome },
    });
    if (count > 0) return;
  }

  await prisma.email_logs.create({
    data: {
      tenantId: target.tenantId,
      recipient: logRecipient(target.to),
      subject: target.subject,
      templateName: target.templateName,
      ...outcome,
    },
  });
}

/** Flip the job's row to SENT. */
export async function markEmailLogSent(
  input: EmailLogTarget & { smtpResponse?: string; sentAt?: Date },
): Promise<void> {
  await finalizeEmailLog(input, {
    status: "SENT",
    smtpResponse: input.smtpResponse,
    sentAt: input.sentAt ?? new Date(),
  });
}

/** Flip the job's row to FAILED (also used for expiry and suppression drops). */
export async function markEmailLogFailed(
  input: EmailLogTarget & { errorMessage: string },
): Promise<void> {
  await finalizeEmailLog(input, {
    status: "FAILED",
    errorMessage: input.errorMessage,
  });
}
