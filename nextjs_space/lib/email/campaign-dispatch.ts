/**
 * The US-019 send path, lifted out of its route so US-021 can reach it.
 *
 * SERVER ONLY. Nothing about the sequence changed in the lift — the route still
 * owns the rate limit and the HTTP shape, and this owns the four steps that put
 * mail in the queue:
 *
 *   1. RESOLVE the audience rule against the lists as they stand this second,
 *      never against anything cached at draft time.
 *   2. CLAIM the campaign with a conditional write (DRAFT|SCHEDULED -> SENDING).
 *      Two callers race here and Postgres decides; the loser enqueues nothing.
 *      This is also what makes a cancelled campaign unsendable — CANCELLED is
 *      not in the predicate, so the claim finds no row.
 *   3. MATERIALIZE one recipient row per address.
 *   4. ENQUEUE one job per recipient, spaced to the per-tenant rate cap.
 *
 * It answers with a refusal rather than a Response because its second caller is
 * a BullMQ job (`campaign-scheduled-runner.ts`), which has nobody to return an
 * HTTP status to. `CAMPAIGN_DISPATCH_STATUS` is how the route turns one back
 * into the answer it always gave.
 */

import { prisma } from "@/lib/db";
import { parseCampaignAudience } from "@/lib/email/campaign-audience";
import { resolveCampaignAudience } from "@/lib/email/campaign-audience-query";
import { fanOutCampaign } from "@/lib/email/campaign-fan-out";
import { CAMPAIGN_EDITABLE_STATUSES } from "@/lib/email/campaign-rules";
import {
  CAMPAIGN_EMPTY_AUDIENCE_MESSAGE,
  CAMPAIGN_MAX_RECIPIENTS,
  CAMPAIGN_NO_AUDIENCE_MESSAGE,
  CAMPAIGN_NOT_SENDABLE_MESSAGE,
  CAMPAIGN_TOO_MANY_RECIPIENTS_MESSAGE,
} from "@/lib/email/campaign-send";

export const CAMPAIGN_NOT_FOUND_MESSAGE = "Campaign not found or access denied";

const NO_STORE_MESSAGE = "This store could not be resolved, so nothing was sent.";

export type CampaignDispatchRefusal =
  | "NOT_FOUND"
  | "NO_STORE"
  | "NOT_SENDABLE"
  | "NO_AUDIENCE"
  | "EMPTY_AUDIENCE"
  | "TOO_MANY_RECIPIENTS";

/** The answer each refusal was already giving before it had a name. */
export const CAMPAIGN_DISPATCH_STATUS: Record<CampaignDispatchRefusal, number> =
  {
    NOT_FOUND: 404,
    NO_STORE: 404,
    NOT_SENDABLE: 409,
    NO_AUDIENCE: 400,
    EMPTY_AUDIENCE: 400,
    TOO_MANY_RECIPIENTS: 400,
  };

export interface CampaignDispatchSent {
  readonly ok: true;
  readonly queued: number;
  readonly suppressed: number;
  readonly ratePerMinute: number;
}

export interface CampaignDispatchRefused {
  readonly ok: false;
  readonly refusal: CampaignDispatchRefusal;
  readonly message: string;
}

export type CampaignDispatchResult =
  | CampaignDispatchSent
  | CampaignDispatchRefused;

const refuse = (
  refusal: CampaignDispatchRefusal,
  message: string,
): CampaignDispatchRefused => ({ ok: false, refusal, message });

/**
 * Fan one campaign out to its audience, now.
 *
 * Every query names `tenantId` in its own `where` rather than leaning on the
 * lib/db.ts scope layer, because the scheduled caller runs in the worker with
 * no request context to inherit — the same rule `campaign-recipient-store.ts`
 * follows. Inside a request the scope layer merges the identical tenantId, so
 * both callers issue the same SQL.
 */
export async function dispatchCampaign(
  campaignId: string,
  tenantId: string,
): Promise<CampaignDispatchResult> {
  const campaign = await prisma.campaigns.findFirst({
    where: { id: campaignId, tenantId },
    select: { id: true, status: true, subject: true, audience: true },
  });

  if (!campaign) {
    return refuse("NOT_FOUND", CAMPAIGN_NOT_FOUND_MESSAGE);
  }

  // The early answer; the claim below carries the same predicate because
  // resolving an audience is not instant and this read is not the write.
  if (
    !(CAMPAIGN_EDITABLE_STATUSES as readonly string[]).includes(campaign.status)
  ) {
    return refuse("NOT_SENDABLE", CAMPAIGN_NOT_SENDABLE_MESSAGE);
  }

  const audience = parseCampaignAudience(campaign.audience);
  if (!audience) {
    return refuse("NO_AUDIENCE", CAMPAIGN_NO_AUDIENCE_MESSAGE);
  }

  // The unsubscribe link in every footer is built against this store's own
  // canonical host, so a token minted here can only be redeemed here.
  const tenant = await prisma.tenants.findFirst({
    where: { id: tenantId },
    select: { businessName: true, subdomain: true, customDomain: true },
  });
  if (!tenant) {
    return refuse("NO_STORE", NO_STORE_MESSAGE);
  }

  const { recipients, suppressedCount } = await resolveCampaignAudience(
    audience,
    tenantId,
  );
  if (recipients.length === 0) {
    return refuse("EMPTY_AUDIENCE", CAMPAIGN_EMPTY_AUDIENCE_MESSAGE);
  }
  if (recipients.length > CAMPAIGN_MAX_RECIPIENTS) {
    return refuse("TOO_MANY_RECIPIENTS", CAMPAIGN_TOO_MANY_RECIPIENTS_MESSAGE);
  }

  const { count } = await prisma.campaigns.updateMany({
    where: {
      id: campaignId,
      tenantId,
      status: { in: CAMPAIGN_EDITABLE_STATUSES },
    },
    data: { status: "SENDING" },
  });
  if (count === 0) {
    return refuse("NOT_SENDABLE", CAMPAIGN_NOT_SENDABLE_MESSAGE);
  }

  const { queued, ratePerMinute } = await fanOutCampaign({
    campaign: { id: campaignId, tenantId, subject: campaign.subject },
    tenant,
    recipients,
  });

  return { ok: true, queued, suppressed: suppressedCount, ratePerMinute };
}
