/**
 * US-021 — where a schedule meets Redis and Postgres.
 *
 * SERVER ONLY. The rules are in `campaign-schedule.ts`; this is the pair of
 * writes that keep the delayed job and the campaign row saying the same thing.
 *
 * The invariant both functions defend: a campaign points at AT MOST ONE trigger
 * job, and that job is the only one allowed to fan it out. Redis and Postgres
 * cannot be written atomically, so the pointer is authoritative and the job is
 * not — every trigger checks whether the campaign is still waiting on it before
 * it does anything (`scheduledSendDecision`). Removing a superseded job is
 * therefore housekeeping, and a removal that fails costs nothing.
 */

import { randomUUID } from "crypto";

import { prisma } from "@/lib/db";
import { CAMPAIGN_EDITABLE_STATUSES } from "@/lib/email/campaign-rules";
import {
  CAMPAIGN_SCHEDULE_JOB,
  campaignScheduleDelayMs,
} from "@/lib/email/campaign-schedule";
import { getCampaignQueue } from "@/lib/queue";

export interface ScheduleCampaignInput {
  readonly campaignId: string;
  readonly tenantId: string;
  readonly scheduledAt: Date;
  /** Injected by the route so validation and enqueue agree on "now". */
  readonly now?: Date;
}

export interface ScheduleCampaignResult {
  /** False when the campaign left DRAFT|SCHEDULED between the read and the write. */
  readonly ok: boolean;
  readonly jobId: string;
}

/** Remove a delayed trigger, tolerating one that has already gone. */
async function removeJob(jobId: string): Promise<void> {
  try {
    await getCampaignQueue().remove(jobId);
  } catch {
    // A job that is missing, finished or locked is a job that no longer needs
    // removing. Every trigger re-checks the campaign before it sends, so the
    // one case this swallows — a job still in Redis — is refused at send time.
  }
}

/**
 * Drop whatever trigger this campaign is waiting on and forget it.
 *
 * Called on cancel and after a manual send, so a campaign that has left
 * SCHEDULED is not still pointing at a job. `exceptJobId` is for the trigger
 * calling this about ITSELF while it runs: BullMQ will not remove a job that
 * holds an active lock, so the pointer is cleared and the queue left alone.
 *
 * `scheduledAt` is deliberately left in place — it is the record of when the
 * campaign was meant to go out, which stays true even once it is not going.
 */
export async function releaseCampaignSchedule(
  campaignId: string,
  tenantId: string,
  exceptJobId?: string,
): Promise<void> {
  const campaign: { scheduledJobId: string | null } | null =
    await prisma.campaigns.findFirst({
      where: { id: campaignId, tenantId },
      select: { scheduledJobId: true },
    });

  const jobId = campaign?.scheduledJobId;
  if (!jobId) return;

  if (jobId !== exceptJobId) {
    await removeJob(jobId);
  }

  await prisma.campaigns.updateMany({
    where: { id: campaignId, tenantId, scheduledJobId: jobId },
    data: { scheduledJobId: null },
  });
}

/**
 * Point a campaign at a new trigger, replacing any it already had.
 *
 * Enqueue BEFORE the write, and roll the enqueue back if the write loses the
 * race, because the two orderings fail differently: this way a crash between
 * them leaves an orphan job that fires and refuses (the campaign never adopted
 * it), while the reverse would leave a campaign marked SCHEDULED waiting on a
 * job that does not exist — a send that silently never happens.
 *
 * The status predicate is IN the write for the same reason it is in US-019's
 * claim: `assertSchedulable` in the route and this update are separate round
 * trips, and a send or a cancel can land between them.
 */
export async function scheduleCampaignSend(
  input: ScheduleCampaignInput,
): Promise<ScheduleCampaignResult> {
  const { campaignId, tenantId, scheduledAt, now = new Date() } = input;

  await releaseCampaignSchedule(campaignId, tenantId);

  const jobId = randomUUID();
  await getCampaignQueue().add(
    CAMPAIGN_SCHEDULE_JOB,
    { campaignId, tenantId },
    { jobId, delay: campaignScheduleDelayMs(scheduledAt, now) },
  );

  const { count } = await prisma.campaigns.updateMany({
    where: {
      id: campaignId,
      tenantId,
      status: { in: CAMPAIGN_EDITABLE_STATUSES },
    },
    data: { status: "SCHEDULED", scheduledAt, scheduledJobId: jobId },
  });

  if (count === 0) {
    await removeJob(jobId);
    return { ok: false, jobId };
  }

  return { ok: true, jobId };
}

/**
 * Hand a campaign back to its author after its trigger fired and refused.
 *
 * A campaign whose scheduled send was turned away — an audience that emptied
 * out overnight, a store that vanished — must not sit at SCHEDULED forever
 * pointing at a job that has already run and will never run again. It never
 * went, so it is a draft.
 *
 * `status: "SCHEDULED"` is the whole safety of this write. If a manual send won
 * the race and the campaign is SENDING, this matches nothing — reverting a
 * campaign that is mid fan-out to DRAFT would re-open it for editing and for a
 * second send while its jobs are still in the queue.
 */
export async function revertScheduleToDraft(
  campaignId: string,
  tenantId: string,
): Promise<void> {
  await prisma.campaigns.updateMany({
    where: { id: campaignId, tenantId, status: "SCHEDULED" },
    data: { status: "DRAFT", scheduledJobId: null },
  });
}
