/**
 * US-019 — turning one campaign into one message per person.
 *
 * SERVER ONLY. The rules are in `campaign-send.ts`; this is where they meet
 * Prisma and BullMQ.
 *
 * ONE MESSAGE PER RECIPIENT, always. Not one `sendMail` with an array of
 * addresses, which would put the store's entire mailing list in the `To:` header
 * of everyone's inbox — the single defect on this surface that cannot be walked
 * back once it has been delivered. Every job below carries exactly one address,
 * and the per-recipient row it carries is what the worker writes the outcome to.
 *
 * Bulk writes rather than the row-at-a-time `createQueuedEmailLog`: a 5,000
 * person audience is 5,000 log rows and 5,000 jobs, and issuing them one round
 * trip at a time inside one HTTP request is a request that does not finish. The
 * ids are therefore minted here so the job payload can carry them without a
 * read-back.
 */

import { randomUUID } from "crypto";

import { prisma } from "@/lib/db";
import type { AudienceRecipient } from "@/lib/email/campaign-audience";
import {
  CAMPAIGN_EMAIL_CATEGORY,
} from "@/lib/email/campaign-rules";
import {
  campaignJobDelayMs,
  campaignRatePerMinute,
  campaignRecipientVariables,
} from "@/lib/email/campaign-send";
import { isEmailTrackingEnabled } from "@/lib/email/email-tracking";
import { generateSubscriberToken } from "@/lib/email/newsletter-subscriptions";
import { buildNewsletterUnsubscribeUrl } from "@/lib/email/newsletter-unsubscribe";
import { CAMPAIGN_TEMPLATE_NAME } from "@/lib/email/reserved-event-types";
import { signRecipientToken } from "@/lib/email/tracking-token";
import { getEmailQueue } from "@/lib/queue";
import { getTenantBaseUrl } from "@/lib/tenant/tenant-utils";

/** The job name the worker already listens for — campaigns are not a new queue. */
const SEND_EMAIL_JOB = "send-email";

export interface FanOutCampaign {
  readonly id: string;
  readonly tenantId: string;
  readonly subject: string;
}

export interface FanOutTenant {
  readonly businessName: string;
  readonly subdomain: string;
  readonly customDomain: string | null;
  /**
   * Raw `tenants.settings`, read only for US-027's tracking switch. Read at
   * FAN-OUT time rather than inherited from the save: a store that turned
   * tracking off after composing the campaign mints no tokens, so its already-
   * saved pixel and links go out inert.
   */
  readonly settings?: unknown;
}

export interface FanOutInput {
  readonly campaign: FanOutCampaign;
  readonly tenant: FanOutTenant;
  readonly recipients: readonly AudienceRecipient[];
}

export interface FanOutResult {
  /** Messages enqueued — one per recipient, by construction. */
  readonly queued: number;
  /** Messages a minute this fan-out was spaced to. */
  readonly ratePerMinute: number;
}

interface PreparedRecipient {
  readonly id: string;
  readonly logId: string;
  readonly email: string;
  readonly userId: string | null;
  readonly unsubscribeToken: string;
  readonly variables: Record<string, string>;
}

/**
 * Everything one recipient needs, decided before anything is written.
 *
 * The unsubscribe token is minted HERE rather than reused from a subscriber
 * row: a campaign also reaches consented customers, who have no subscriber row
 * and therefore no token, and a marketing email whose opt-out link does not
 * resolve is worse than one that was never sent.
 */
function prepareRecipients(input: FanOutInput): PreparedRecipient[] {
  const baseUrl = getTenantBaseUrl(input.tenant);
  const tracking = isEmailTrackingEnabled(
    input.tenant.settings,
    input.campaign.tenantId,
  );

  return input.recipients.map((recipient: AudienceRecipient) => {
    const unsubscribeToken = generateSubscriberToken();
    const id = randomUUID();
    return {
      id,
      logId: randomUUID(),
      email: recipient.email,
      userId: recipient.userId,
      unsubscribeToken,
      variables: campaignRecipientVariables({
        businessName: input.tenant.businessName,
        baseUrl,
        subdomain: input.tenant.subdomain,
        email: recipient.email,
        name: recipient.name,
        unsubscribeUrl: buildNewsletterUnsubscribeUrl(
          input.tenant,
          unsubscribeToken,
        ),
        // US-027. SIGNED, not stored: the recipient row's own id is what the
        // token names, so there is no second credential to keep and nothing in
        // the URL that identifies a person to anyone who cannot already read
        // this database. Deliberately NOT the unsubscribe token above — a
        // pixel URL passes through image proxies and provider logs, and an
        // opt-out credential has no business travelling that way.
        trackingToken: tracking ? signRecipientToken(id) : null,
      }),
    };
  });
}

/**
 * Materialize the recipient rows and their QUEUED log rows.
 *
 * `skipDuplicates` for the unique (campaignId, email): the audience is deduped
 * before it gets here, so this only fires when a campaign is being re-fanned —
 * in which case the earlier row, and the outcome already recorded on it, is the
 * one worth keeping.
 */
async function materialize(
  campaign: FanOutCampaign,
  prepared: readonly PreparedRecipient[],
): Promise<void> {
  await prisma.campaign_recipients.createMany({
    data: prepared.map((recipient) => ({
      id: recipient.id,
      campaignId: campaign.id,
      email: recipient.email,
      userId: recipient.userId,
      status: "QUEUED" as const,
      unsubscribeToken: recipient.unsubscribeToken,
    })),
    skipDuplicates: true,
  });

  // US-008 linkage, in bulk: the id travels in the payload so the worker
  // updates this exact row rather than guessing at (recipient, subject).
  await prisma.email_logs.createMany({
    data: prepared.map((recipient) => ({
      id: recipient.logId,
      tenantId: campaign.tenantId,
      recipient: recipient.email,
      subject: campaign.subject,
      templateName: CAMPAIGN_TEMPLATE_NAME,
      status: "QUEUED" as const,
      metadata: JSON.stringify({
        campaignId: campaign.id,
        recipientId: recipient.id,
      }),
    })),
  });
}

/**
 * Fan a campaign out to its resolved audience.
 *
 * The caller has already claimed the campaign (DRAFT|SCHEDULED -> SENDING) so a
 * double click cannot reach this twice. If the enqueue fails part way the
 * campaign stays SENDING with rows that never complete — deliberately, because
 * the alternative is releasing it back to DRAFT while some of its jobs are
 * already in Redis and letting the next click mail those people twice. Cancel
 * is the way out of that state.
 *
 * No `html` in the payload. The worker renders `campaigns.contentHtml` against
 * the per-recipient variables below, which is what keeps a 5,000 person send
 * out of Redis as 5,000 copies of the same email body.
 */
export async function fanOutCampaign(
  input: FanOutInput,
): Promise<FanOutResult> {
  const prepared = prepareRecipients(input);
  await materialize(input.campaign, prepared);

  const ratePerMinute = campaignRatePerMinute();

  await getEmailQueue().addBulk(
    prepared.map((recipient, index) => ({
      name: SEND_EMAIL_JOB,
      data: {
        tenantId: input.campaign.tenantId,
        // ONE address. Never an array — see the module note.
        to: recipient.email,
        subject: input.campaign.subject,
        templateName: CAMPAIGN_TEMPLATE_NAME,
        category: CAMPAIGN_EMAIL_CATEGORY,
        logId: recipient.logId,
        campaignId: input.campaign.id,
        recipientId: recipient.id,
        variables: recipient.variables,
      },
      opts: { delay: campaignJobDelayMs(index, ratePerMinute) },
    })),
  );

  return { queued: prepared.length, ratePerMinute };
}
