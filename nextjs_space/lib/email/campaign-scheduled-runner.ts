/**
 * US-021 — what a delayed trigger job actually does when its time comes.
 *
 * SERVER ONLY, and written to be called from `scripts/email-worker.ts` without
 * dragging the worker's own concerns in: it returns an outcome and prints
 * nothing, so the worker stays the only place that decides what appears in the
 * logs, and this stays testable without booting a queue.
 *
 * Everything runs inside `bypassTenantScope`, which binds an EXPLICIT null
 * context — the same rule `campaign-recipient-store.ts` follows. The worker has
 * no request context, and every query underneath names its tenantId itself, so
 * this stays legal under TENANT_CONTEXT_STRICT.
 */

import { prisma } from "@/lib/db";
import { dispatchCampaign } from "@/lib/email/campaign-dispatch";
import {
  scheduledSendDecision,
  type ScheduledCampaignRow,
  type ScheduledSendDecision,
} from "@/lib/email/campaign-schedule";
import {
  releaseCampaignSchedule,
  revertScheduleToDraft,
} from "@/lib/email/campaign-schedule-store";
import { bypassTenantScope } from "@/lib/tenant/tenant-scope-policy";

/** The trigger payload. Both ids are required — half a target is unusable. */
export interface ScheduledCampaignTarget {
  readonly campaignId: string;
  readonly tenantId: string;
}

export interface ScheduledSendOutcome {
  readonly decision: ScheduledSendDecision | "UNREADABLE";
  readonly campaignId: string | null;
  /** Messages enqueued. 0 for every outcome that is not a fan-out. */
  readonly queued: number;
  /** The dispatcher's own sentence when it turned the send away. */
  readonly refusal?: string;
}

/** Narrow a job payload to its target, or null if it is not one. */
export function scheduledCampaignTarget(
  data: unknown,
): ScheduledCampaignTarget | null {
  if (typeof data !== "object" || data === null) return null;
  const { campaignId, tenantId } = data as Record<string, unknown>;
  if (typeof campaignId !== "string" || !campaignId) return null;
  if (typeof tenantId !== "string" || !tenantId) return null;
  return { campaignId, tenantId };
}

const nothingSent = (
  decision: ScheduledSendOutcome["decision"],
  campaignId: string | null,
  refusal?: string,
): ScheduledSendOutcome => ({ decision, campaignId, queued: 0, refusal });

/**
 * Run one scheduled campaign.
 *
 * The status is re-read HERE, at send time, rather than trusted from the
 * payload — that is what makes a cancel effective right up to the last second.
 * `scheduledSendDecision` is the guard; `dispatchCampaign` carries the same
 * predicate again in its conditional claim, so even a decision that goes stale
 * between these two lines cannot send a campaign an admin called off.
 */
export async function runScheduledCampaign(
  data: unknown,
  jobId: string,
): Promise<ScheduledSendOutcome> {
  const target = scheduledCampaignTarget(data);
  if (!target) return nothingSent("UNREADABLE", null);

  const { campaignId, tenantId } = target;

  return bypassTenantScope(async () => {
    const campaign: ScheduledCampaignRow | null =
      await prisma.campaigns.findFirst({
        where: { id: campaignId, tenantId },
        select: { status: true, scheduledJobId: true },
      });

    const decision = scheduledSendDecision(campaign, jobId);
    if (decision !== "SEND") return nothingSent(decision, campaignId);

    const result = await dispatchCampaign(campaignId, tenantId);

    if (!result.ok) {
      // It never went out, so it goes back to being a draft — see
      // `revertScheduleToDraft` for why that write is safe under a race.
      await revertScheduleToDraft(campaignId, tenantId);
      return nothingSent("SEND", campaignId, result.message);
    }

    // The campaign is SENDING now and waiting on nothing. `jobId` is excluded
    // because BullMQ will not remove a job that holds an active lock — this one.
    await releaseCampaignSchedule(campaignId, tenantId, jobId);

    return { decision, campaignId, queued: result.queued };
  });
}
