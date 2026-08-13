import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { CAMPAIGN_CANCELLABLE_STATUSES } from "@/lib/email/campaign-rules";
import { CAMPAIGN_NOT_CANCELLABLE_MESSAGE } from "@/lib/email/campaign-send";
import { requirePermissionParams } from "@/lib/permissions/require-permission";
import { parseUuid } from "@/lib/validation/parse-uuid";

const ROUTE = "POST /api/tenant-admin/campaigns/[id]/cancel";

const NOT_FOUND_MESSAGE = "Campaign not found or access denied";

/**
 * US-019 — stop the rest of a send.
 *
 * One conditional write and nothing else. The queue is deliberately NOT drained
 * here: BullMQ jobs for this campaign stay where they are and each one re-reads
 * the campaign's status before it sends (scripts/email-worker.ts), so cancelling
 * is a single row change that every in-flight job observes. Trying to remove
 * thousands of delayed jobs inside a request would be slower, racier, and would
 * still need the worker-side check to be correct.
 *
 * Messages already delivered stay delivered — cancel means "send no more", and
 * the recipient rows keep the record of who was reached before the stop.
 */
export const POST = requirePermissionParams(
  "canEditEmails",
  async (_req, { tenantId }, params) => {
    try {
      const id = parseUuid(params.id);

      const { count } = await prisma.campaigns.updateMany({
        where: { id, tenantId, status: { in: CAMPAIGN_CANCELLABLE_STATUSES } },
        data: { status: "CANCELLED" },
      });

      if (count === 0) {
        // A count of 0 is two different answers, and they are owed different
        // ones: a campaign this tenant does not have, or one that was never in
        // a state a cancel could change.
        const exists = await prisma.campaigns.findFirst({
          where: { id, tenantId },
          select: { id: true },
        });

        return exists
          ? apiError(new Error(CAMPAIGN_NOT_CANCELLABLE_MESSAGE), {
              route: ROUTE,
              status: 409,
              safeMessage: CAMPAIGN_NOT_CANCELLABLE_MESSAGE,
            })
          : apiError(new Error(NOT_FOUND_MESSAGE), {
              route: ROUTE,
              status: 404,
              safeMessage: NOT_FOUND_MESSAGE,
            });
      }

      return NextResponse.json({ status: "CANCELLED" });
    } catch (error) {
      return apiError(error, { route: ROUTE });
    }
  },
);
