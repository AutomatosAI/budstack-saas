import { NextResponse } from "next/server";

import { apiError, apiValidationError } from "@/lib/api-error";
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
  CAMPAIGN_SEND_RATE_LIMIT,
  CAMPAIGN_TOO_MANY_RECIPIENTS_MESSAGE,
  campaignSendRateLimitKey,
} from "@/lib/email/campaign-send";
import { requirePermissionParams } from "@/lib/permissions/require-permission";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { parseUuid } from "@/lib/validation/parse-uuid";

const ROUTE = "POST /api/tenant-admin/campaigns/[id]/send";

const NOT_FOUND_MESSAGE = "Campaign not found or access denied";
const NO_STORE_MESSAGE = "This store could not be resolved, so nothing was sent.";

/**
 * US-019 — send this campaign, now.
 *
 * The order of the four things this does is the whole story:
 *
 *   1. RESOLVE the audience rule against the lists as they stand this second,
 *      never against anything cached at draft time. Someone who unsubscribed an
 *      hour ago is gone from this send.
 *   2. CLAIM the campaign with a conditional write (DRAFT|SCHEDULED -> SENDING).
 *      Two clicks race here and Postgres decides; the loser gets a 409 and
 *      enqueues nothing, which is what stops a list being mailed twice.
 *   3. MATERIALIZE one recipient row per address, each with its own unsubscribe
 *      token.
 *   4. ENQUEUE one job per recipient, spaced to the per-tenant rate cap.
 *
 * `canEditEmails`, not a send-specific permission: authoring a campaign and
 * sending it are the same job, and US-009 put every campaign mutation behind
 * that one gate.
 */
export const POST = requirePermissionParams(
  "canEditEmails",
  async (_req, { user, tenantId }, params) => {
    try {
      const id = parseUuid(params.id);

      const limit = await checkRateLimit(
        campaignSendRateLimitKey(user.id),
        CAMPAIGN_SEND_RATE_LIMIT,
      );
      if (!limit.success) return limit.response;

      const campaign = await prisma.campaigns.findFirst({
        where: { id, tenantId },
        select: { id: true, status: true, subject: true, audience: true },
      });

      if (!campaign) {
        return apiError(new Error(NOT_FOUND_MESSAGE), {
          route: ROUTE,
          status: 404,
          safeMessage: NOT_FOUND_MESSAGE,
        });
      }

      // The early answer; the claim below carries the same predicate because
      // resolving an audience is not instant and this read is not the write.
      if (
        !(CAMPAIGN_EDITABLE_STATUSES as readonly string[]).includes(
          campaign.status,
        )
      ) {
        return apiError(new Error(CAMPAIGN_NOT_SENDABLE_MESSAGE), {
          route: ROUTE,
          status: 409,
          safeMessage: CAMPAIGN_NOT_SENDABLE_MESSAGE,
        });
      }

      const audience = parseCampaignAudience(campaign.audience);
      if (!audience) {
        return apiValidationError(CAMPAIGN_NO_AUDIENCE_MESSAGE, ROUTE);
      }

      // The unsubscribe link in every footer is built against this store's own
      // canonical host, so a token minted here can only be redeemed here.
      const tenant = await prisma.tenants.findFirst({
        where: { id: tenantId },
        select: { businessName: true, subdomain: true, customDomain: true },
      });
      if (!tenant) {
        return apiError(new Error(NO_STORE_MESSAGE), {
          route: ROUTE,
          status: 404,
          safeMessage: NO_STORE_MESSAGE,
        });
      }

      const { recipients, suppressedCount } = await resolveCampaignAudience(
        audience,
        tenantId,
      );
      if (recipients.length === 0) {
        return apiValidationError(CAMPAIGN_EMPTY_AUDIENCE_MESSAGE, ROUTE);
      }
      if (recipients.length > CAMPAIGN_MAX_RECIPIENTS) {
        return apiValidationError(CAMPAIGN_TOO_MANY_RECIPIENTS_MESSAGE, ROUTE);
      }

      const { count } = await prisma.campaigns.updateMany({
        where: { id, tenantId, status: { in: CAMPAIGN_EDITABLE_STATUSES } },
        data: { status: "SENDING" },
      });
      if (count === 0) {
        return apiError(new Error(CAMPAIGN_NOT_SENDABLE_MESSAGE), {
          route: ROUTE,
          status: 409,
          safeMessage: CAMPAIGN_NOT_SENDABLE_MESSAGE,
        });
      }

      const { queued, ratePerMinute } = await fanOutCampaign({
        campaign: { id, tenantId, subject: campaign.subject },
        tenant,
        recipients,
      });

      return NextResponse.json({
        status: "SENDING",
        queued,
        suppressed: suppressedCount,
        ratePerMinute,
      });
    } catch (error) {
      return apiError(error, { route: ROUTE });
    }
  },
);
