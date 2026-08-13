import { NextResponse } from "next/server";

import { apiError, apiValidationError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { parseCampaignAudience } from "@/lib/email/campaign-audience";
import {
  AUDIENCE_COUNT_RATE_LIMIT,
  audienceCountRateLimitKey,
  resolveCampaignAudience,
} from "@/lib/email/campaign-audience-query";
import { requirePermissionParams } from "@/lib/permissions/require-permission";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { parseUuid } from "@/lib/validation/parse-uuid";

const ROUTE = "GET /api/tenant-admin/campaigns/[id]/audience-count";

const NOT_FOUND_MESSAGE = "Campaign not found or access denied";
const UNKNOWN_AUDIENCE_MESSAGE = "That is not an audience this store can send to.";

/** Nobody chosen yet — a real answer, not an error. */
const NO_AUDIENCE = { audience: null, count: 0, suppressed: 0 } as const;

/**
 * US-018 — how many people this campaign reaches if it goes out now.
 *
 * The count is LIVE: it resolves the stored rule against the current
 * subscribers, the current consents and the current suppression list, every
 * time it is asked. A number cached at draft time would be the one thing this
 * endpoint must not be — an author approving a send against a list that has
 * since had people leave it.
 *
 * `?type=` counts a DIFFERENT audience than the one stored, so the picker can
 * show the size of each option before the author commits to one. It changes
 * nothing: this route only ever reads, and the campaign id still has to belong
 * to the caller's tenant.
 *
 * The response carries counts and never addresses. `canViewEmails` is enough to
 * ask the question, and the answer to "how many" does not require handing a
 * browser the tenant's mailing list.
 */
export const GET = requirePermissionParams(
  "canViewEmails",
  async (req, { user, tenantId }, params) => {
    try {
      const id = parseUuid(params.id);

      const limit = await checkRateLimit(
        audienceCountRateLimitKey(user.id),
        AUDIENCE_COUNT_RATE_LIMIT,
      );
      if (!limit.success) return limit.response;

      const campaign = await prisma.campaigns.findFirst({
        where: { id, tenantId },
        select: { audience: true },
      });

      if (!campaign) {
        return apiError(new Error(NOT_FOUND_MESSAGE), {
          route: ROUTE,
          status: 404,
          safeMessage: NOT_FOUND_MESSAGE,
        });
      }

      const requestedType = new URL(req.url).searchParams.get("type");
      const audience =
        requestedType === null
          ? parseCampaignAudience(campaign.audience)
          : parseCampaignAudience({ type: requestedType });

      // An unreadable STORED audience means nobody has chosen one; an
      // unreadable REQUESTED one means the caller asked for something this
      // version does not know, and silently answering 0 would read as "that
      // audience is empty".
      if (requestedType !== null && !audience) {
        return apiValidationError(UNKNOWN_AUDIENCE_MESSAGE, ROUTE);
      }
      if (!audience) {
        return NextResponse.json(NO_AUDIENCE);
      }

      const { recipients, suppressedCount } = await resolveCampaignAudience(
        audience,
        tenantId,
      );

      return NextResponse.json({
        audience,
        count: recipients.length,
        suppressed: suppressedCount,
      });
    } catch (error) {
      return apiError(error, { route: ROUTE });
    }
  },
);
