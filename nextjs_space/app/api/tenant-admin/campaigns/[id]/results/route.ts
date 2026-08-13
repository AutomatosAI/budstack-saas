import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import {
  CAMPAIGN_FAILURE_SAMPLE_MAX,
  summariseCampaignFailures,
  type CampaignFailureSource,
  type CampaignResults,
  type CampaignResultsHeader,
} from "@/lib/email/campaign-results";
import {
  summariseCampaignStats,
  type CampaignStatusBucket,
} from "@/lib/email/campaign-send";
import { tenantWantsTracking } from "@/lib/email/tracking-store";
import { requirePermissionParams } from "@/lib/permissions/require-permission";
import { parseUuid } from "@/lib/validation/parse-uuid";

const ROUTE = "GET /api/tenant-admin/campaigns/[id]/results";

const NOT_FOUND_MESSAGE = "Campaign not found or access denied";

interface CampaignRow {
  id: string;
  name: string;
  subject: string;
  status: CampaignResultsHeader["status"];
  sentAt: Date | null;
}

/**
 * Why the failed recipients are read before their logs.
 *
 * `email_logs` has no campaign column — the linkage is `campaign_recipients.
 * emailLogId` (US-008/US-019), and it points the other way. Two indexed reads
 * of at most CAMPAIGN_FAILURE_SAMPLE_MAX ids is the whole cost, and `tenantId`
 * is re-asserted on the log read even though the ids came from a campaign this
 * tenant owns: `email_logs` IS a tenant-scoped model, and a linkage column is a
 * weaker guarantee than the filter that would have caught it being wrong.
 */
async function loadFailureReasons(
  campaignId: string,
  tenantId: string,
): Promise<{ sources: CampaignFailureSource[]; sampled: number }> {
  const failed: Array<{ emailLogId: string | null }> =
    await prisma.campaign_recipients.findMany({
      where: { campaignId, status: "FAILED" },
      select: { emailLogId: true },
      orderBy: { id: "asc" },
      take: CAMPAIGN_FAILURE_SAMPLE_MAX,
    });

  const logIds = failed
    .map((row) => row.emailLogId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  // A failure recorded before its log row could be linked still counts as a
  // failure — it lands in the `unknown` group rather than disappearing from
  // the totals the page shows beside it.
  const unlinked = failed.length - logIds.length;

  const logs: CampaignFailureSource[] = logIds.length
    ? await prisma.email_logs.findMany({
        where: { id: { in: logIds }, tenantId },
        select: { errorMessage: true, smtpResponse: true },
      })
    : [];

  return {
    sources: [
      ...logs,
      ...Array.from({ length: unlinked }, () => ({ errorMessage: null })),
    ],
    sampled: failed.length,
  };
}

/**
 * GET /api/tenant-admin/campaigns/[id]/results — US-026.
 *
 * Read-only, and gated on `canViewEmails` like every other campaign endpoint
 * (US-009): the addresses are not in this response, but which of them bounced
 * and who opted out is still the store's customer data.
 */
export const GET = requirePermissionParams(
  "canViewEmails",
  async (_req, { tenantId }, params) => {
    try {
      const id = parseUuid(params.id);

      const campaign: CampaignRow | null = await prisma.campaigns.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          name: true,
          subject: true,
          status: true,
          sentAt: true,
        },
      });

      if (!campaign) {
        return apiError(new Error(NOT_FOUND_MESSAGE), {
          route: ROUTE,
          status: 404,
          safeMessage: NOT_FOUND_MESSAGE,
        });
      }

      // Everything below is keyed on the id that came out of the tenant-scoped
      // read above — `campaign_recipients` carries no tenantId of its own.
      const [
        buckets,
        unsubscribed,
        failuresTotal,
        failures,
        trackingEnabled,
        opened,
        clicked,
      ] = await Promise.all([
          prisma.campaign_recipients.groupBy({
            by: ["status"],
            where: { campaignId: campaign.id },
            _count: { _all: true },
          }) as Promise<CampaignStatusBucket[]>,
          // US-026's attribution: the per-recipient token was minted into THIS
          // campaign's footer, so a stamp here is an opt-out this campaign
          // caused — not merely someone who is now on the suppression list.
          prisma.campaign_recipients.count({
            where: { campaignId: campaign.id, unsubscribedAt: { not: null } },
          }) as Promise<number>,
          prisma.campaign_recipients.count({
            where: { campaignId: campaign.id, status: "FAILED" },
          }) as Promise<number>,
          loadFailureReasons(campaign.id, tenantId),
          // US-027. The setting as it stands NOW: a store that has since turned
          // tracking off gets the two stats hidden rather than shown as zero,
          // and one that turned it on after this campaign went out is told the
          // same way — the counts below are honest either way, but only the
          // flag says whether zero means "nobody" or "we didn't look".
          tenantWantsTracking(tenantId),
          prisma.campaign_recipients.count({
            where: { campaignId: campaign.id, openedAt: { not: null } },
          }) as Promise<number>,
          prisma.campaign_recipients.count({
            where: { campaignId: campaign.id, clickedAt: { not: null } },
          }) as Promise<number>,
        ]);

      const results: CampaignResults = {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          subject: campaign.subject,
          status: campaign.status,
          sentAt: campaign.sentAt?.toISOString() ?? null,
        },
        counts: summariseCampaignStats(buckets),
        unsubscribed,
        trackingEnabled,
        opened,
        clicked,
        failures: summariseCampaignFailures(failures.sources),
        failuresSampled: failures.sampled,
        failuresTotal,
      };

      return NextResponse.json(results);
    } catch (error) {
      return apiError(error, { route: ROUTE });
    }
  },
);
