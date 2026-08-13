import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, apiError, apiValidationError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { parseCampaignAudience } from "@/lib/email/campaign-audience";
import { CAMPAIGN_NOT_FOUND_MESSAGE } from "@/lib/email/campaign-dispatch";
import {
  CAMPAIGN_LOCKED_MESSAGE,
  isCampaignEditable,
} from "@/lib/email/campaign-rules";
import {
  campaignScheduleRateLimitKey,
  validateScheduleTime,
} from "@/lib/email/campaign-schedule";
import { scheduleCampaignSend } from "@/lib/email/campaign-schedule-store";
import {
  CAMPAIGN_NO_AUDIENCE_MESSAGE,
  CAMPAIGN_NOT_SENDABLE_MESSAGE,
  CAMPAIGN_SEND_RATE_LIMIT,
} from "@/lib/email/campaign-send";
import { requirePermissionParams } from "@/lib/permissions/require-permission";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { parseJsonBody } from "@/lib/validation/body";
import { parseUuid } from "@/lib/validation/parse-uuid";

const ROUTE = "POST /api/tenant-admin/campaigns/[id]/schedule";

/**
 * `offset: true` because the browser sends a real instant: the picker is
 * minute-granular LOCAL time, and the client converts it before it leaves. An
 * author in Dublin scheduling 09:00 means 09:00 where they are, and that is a
 * question only their own timezone can answer.
 */
const scheduleSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true }),
});

/**
 * Reject the request early with the RIGHT answer, before anything is enqueued.
 *
 * It is only the early answer — `scheduleCampaignSend` carries the same status
 * predicate in its own write, because a send or a cancel can land in the gap.
 */
async function assertSchedulable(id: string, tenantId: string): Promise<void> {
  const campaign = await prisma.campaigns.findFirst({
    where: { id, tenantId },
    select: { status: true, audience: true },
  });

  if (!campaign) throw new ApiError(CAMPAIGN_NOT_FOUND_MESSAGE, 404);
  if (!isCampaignEditable(campaign.status)) {
    throw new ApiError(CAMPAIGN_LOCKED_MESSAGE, 409);
  }
  // Refused NOW, while an author is watching, rather than at 3am by a trigger
  // that can only fail: a campaign with no audience has nobody to send to, and
  // the send path would turn it away whenever it eventually fired.
  if (!parseCampaignAudience(campaign.audience)) {
    throw new ApiError(CAMPAIGN_NO_AUDIENCE_MESSAGE, 400);
  }
}

/**
 * US-021 — schedule this campaign, or move the schedule it already has.
 *
 * One endpoint for both because they are one operation: the store replaces the
 * trigger the campaign points at, so a second POST is a reschedule by
 * construction and there is no path that leaves two triggers armed. Cancelling
 * stays where it was (`../cancel`), which drops the trigger on its way past.
 *
 * `canEditEmails` for the same reason the send endpoint uses it: deciding when
 * a campaign goes out is part of authoring it.
 */
export const POST = requirePermissionParams(
  "canEditEmails",
  async (req, { user, tenantId }, params) => {
    try {
      const id = parseUuid(params.id);
      const body = await parseJsonBody(req, scheduleSchema);

      const limit = await checkRateLimit(
        campaignScheduleRateLimitKey(user.id),
        CAMPAIGN_SEND_RATE_LIMIT,
      );
      if (!limit.success) return limit.response;

      await assertSchedulable(id, tenantId);

      // One `now` for the bounds check and the delay, so a slow request cannot
      // validate against one instant and enqueue against another.
      const now = new Date();
      const scheduledAt = new Date(body.scheduledAt);
      const invalid = validateScheduleTime(scheduledAt, now);
      if (invalid) return apiValidationError(invalid, ROUTE);

      const { ok } = await scheduleCampaignSend({
        campaignId: id,
        tenantId,
        scheduledAt,
        now,
      });
      if (!ok) {
        return apiError(new Error(CAMPAIGN_NOT_SENDABLE_MESSAGE), {
          route: ROUTE,
          status: 409,
          safeMessage: CAMPAIGN_NOT_SENDABLE_MESSAGE,
        });
      }

      return NextResponse.json({
        status: "SCHEDULED",
        scheduledAt: scheduledAt.toISOString(),
      });
    } catch (error) {
      return apiError(error, { route: ROUTE });
    }
  },
);
