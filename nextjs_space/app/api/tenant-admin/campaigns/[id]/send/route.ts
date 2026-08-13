import { NextResponse } from "next/server";

import { apiError, apiValidationError } from "@/lib/api-error";
import {
  CAMPAIGN_DISPATCH_STATUS,
  dispatchCampaign,
} from "@/lib/email/campaign-dispatch";
import { releaseCampaignSchedule } from "@/lib/email/campaign-schedule-store";
import {
  CAMPAIGN_SEND_RATE_LIMIT,
  campaignSendRateLimitKey,
} from "@/lib/email/campaign-send";
import { requirePermissionParams } from "@/lib/permissions/require-permission";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { parseUuid } from "@/lib/validation/parse-uuid";

const ROUTE = "POST /api/tenant-admin/campaigns/[id]/send";

/**
 * US-019 — send this campaign, now.
 *
 * The four steps that put mail in the queue — resolve the audience, claim the
 * campaign, materialize the recipients, enqueue one job each — live in
 * `lib/email/campaign-dispatch.ts`, because US-021's delayed trigger runs the
 * same path from the worker where there is no request to answer. What stays
 * here is what is genuinely HTTP: the rate limit, and turning a refusal back
 * into the status code it has always had.
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

      const result = await dispatchCampaign(id, tenantId);

      if (!result.ok) {
        const status = CAMPAIGN_DISPATCH_STATUS[result.refusal];
        return status === 400
          ? apiValidationError(result.message, ROUTE)
          : apiError(new Error(result.message), {
              route: ROUTE,
              status,
              safeMessage: result.message,
            });
      }

      // US-021: this campaign is going out now, so it is waiting on nothing.
      // Dropping the trigger here is housekeeping rather than protection — one
      // that survived would find the campaign SENDING and refuse — but a
      // scheduled time that has quietly stopped meaning anything is a lie the
      // compose screen would keep telling.
      await releaseCampaignSchedule(id, tenantId);

      return NextResponse.json({
        status: "SENDING",
        queued: result.queued,
        suppressed: result.suppressed,
        ratePerMinute: result.ratePerMinute,
      });
    } catch (error) {
      return apiError(error, { route: ROUTE });
    }
  },
);
