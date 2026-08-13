/**
 * US-019 — the writes the WORKER makes as a campaign goes out.
 *
 * Every function takes `tenantId` explicitly and puts it in the query itself
 * rather than relying on the lib/db.ts scope layer, exactly like
 * `suppression-store.ts` and for the same reason: the worker runs outside any
 * request, so there is no bound context to inherit. It calls these inside
 * `bypassTenantScope()`, which binds an EXPLICIT null and keeps them legal
 * under TENANT_CONTEXT_STRICT.
 *
 * `campaign_recipients` carries no tenantId and is deliberately absent from the
 * scope set (lib/db.ts) — it is reachable only through its campaign. The
 * campaign is loaded tenant-scoped FIRST, and every recipient write is keyed on
 * the row id that came out of that campaign's own fan-out, which is what keeps
 * these writes inside the tenant.
 */

import type { CampaignRecipientStatus, CampaignStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { summariseCampaignStats } from "@/lib/email/campaign-send";

/** What the worker needs to render and to decide whether to send at all. */
export interface CampaignSendSource {
  readonly id: string;
  readonly status: CampaignStatus;
  readonly subject: string;
  readonly contentHtml: string;
}

/**
 * The campaign this job belongs to, or null if it has been deleted since.
 *
 * Tenant-scoped by the `where`, not by trust: `tenantId` and `campaignId` both
 * come from the job payload, and requiring them to agree means a payload that
 * had been tampered with resolves to nothing rather than to another store's
 * campaign.
 */
export async function loadCampaignForSend(
  campaignId: string,
  tenantId: string,
): Promise<CampaignSendSource | null> {
  const campaign: CampaignSendSource | null =
    await prisma.campaigns.findFirst({
      where: { id: campaignId, tenantId },
      select: { id: true, status: true, subject: true, contentHtml: true },
    });
  return campaign ?? null;
}

export interface RecipientOutcome {
  readonly recipientId: string;
  readonly status: CampaignRecipientStatus;
  /** The email_logs row carrying the detail (US-008). */
  readonly emailLogId?: string | null;
  readonly error?: string | null;
}

/**
 * Record one recipient's outcome.
 *
 * `updateMany` rather than `update` so a row deleted mid-flight (a cancelled
 * campaign being cleaned up) is a count of 0 rather than a P2025 that would
 * fail the job and trigger a retry of an email that was already delivered.
 */
export async function markCampaignRecipient(
  outcome: RecipientOutcome,
): Promise<void> {
  await prisma.campaign_recipients.updateMany({
    where: { id: outcome.recipientId },
    data: {
      status: outcome.status,
      ...(outcome.emailLogId !== undefined && { emailLogId: outcome.emailLogId }),
      ...(outcome.error !== undefined && { error: outcome.error }),
    },
  });
}

/**
 * Flip the campaign to SENT once nobody is still waiting on an outcome.
 *
 * Called after EVERY terminal recipient outcome rather than by a sweeper: the
 * last job to finish is the one that knows the fan-out is over, and asking it
 * costs one indexed aggregate. `status: SENDING` is part of the write, so this
 * is idempotent under concurrency (only one job's update finds the row in that
 * state) and can never resurrect a campaign an admin cancelled mid-send.
 *
 * `stats` is the snapshot at that moment. The recipient rows stay the source of
 * truth — a BullMQ retry can still turn a FAILED row into a SENT one after this
 * runs, which is why the list and the results page count rows rather than read
 * this cache.
 */
export async function finalizeCampaignIfComplete(
  campaignId: string,
  tenantId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const buckets = await prisma.campaign_recipients.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { _all: true },
  });

  const stats = summariseCampaignStats(buckets);
  if (stats.pending > 0) return false;

  const { count } = await prisma.campaigns.updateMany({
    where: { id: campaignId, tenantId, status: "SENDING" },
    data: { status: "SENT", sentAt: now, stats },
  });

  return count > 0;
}
