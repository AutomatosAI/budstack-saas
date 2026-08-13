import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, apiError, apiValidationError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { resolveCampaignContent } from "@/lib/email/campaign-content";
import {
  CAMPAIGN_BODY_MAX_BYTES,
  CAMPAIGN_DETAIL_SELECT,
  CAMPAIGN_NAME_MAX,
  CAMPAIGN_SUBJECT_MAX,
  EMPTY_SUBJECT_MESSAGE,
} from "@/lib/email/campaign-fields";
import {
  CAMPAIGN_EDITABLE_STATUSES,
  CAMPAIGN_LOCKED_MESSAGE,
  isCampaignEditable,
} from "@/lib/email/campaign-rules";
import { emailContentJsonSchema } from "@/lib/email/email-content-json";
import { requirePermissionParams } from "@/lib/permissions/require-permission";
import { sanitizeEmailSubject } from "@/lib/security/email-sanitize";
import { parseJsonBody } from "@/lib/validation/body";
import { parseUuid } from "@/lib/validation/parse-uuid";

const GET_ROUTE = "GET /api/tenant-admin/campaigns/[id]";
const PUT_ROUTE = "PUT /api/tenant-admin/campaigns/[id]";
const DELETE_ROUTE = "DELETE /api/tenant-admin/campaigns/[id]";

const NOT_FOUND_MESSAGE = "Campaign not found or access denied";

/**
 * Every field optional: the compose screen saves the whole draft, but a rename
 * on its own must not touch the content columns. `contentJson` is `.optional()`
 * rather than `.nullish()` — a campaign has no raw-HTML mode, so there is no
 * "clear the document" state for a client to ask for. `status` is absent: the
 * only transitions are US-021's scheduling and US-019's fan-out, each of which
 * owns its own endpoint.
 */
const campaignUpdateSchema = z.object({
  name: z.string().trim().min(1).max(CAMPAIGN_NAME_MAX).optional(),
  subject: z.string().trim().min(1).max(CAMPAIGN_SUBJECT_MAX).optional(),
  contentJson: emailContentJsonSchema.optional(),
});

/**
 * Reject the request early with the RIGHT answer: 404 for a campaign this
 * tenant does not own, 409 for one that has left the author's hands.
 *
 * It is only the early answer. The write itself carries the same status
 * predicate (see `assertWroteOne`) because this read and that write are not
 * atomic, and the gap between them is as wide as a full render.
 */
async function assertEditable(id: string, tenantId: string): Promise<void> {
  const existing = await prisma.campaigns.findFirst({
    where: { id, tenantId },
    select: { status: true },
  });
  if (!existing) {
    throw new ApiError(NOT_FOUND_MESSAGE, 404);
  }
  if (!isCampaignEditable(existing.status)) {
    throw new ApiError(CAMPAIGN_LOCKED_MESSAGE, 409);
  }
}

/**
 * The `where` every campaign write is keyed on.
 *
 * The status predicate is IN THE WRITE, not only in the read above, because
 * `assertEditable` and the write are separate round trips with a react-email
 * render between them. Once US-019's fan-out and US-021's scheduler can flip a
 * row to SENDING, a save that started against a DRAFT could land against a
 * campaign already going out — rewriting `contentHtml` so half the list gets
 * one email and half another, or (on DELETE) cascading `campaign_recipients`
 * out from under the running worker. Postgres evaluates this predicate at the
 * moment of the write, so the race closes to nothing.
 */
function editableWhere(id: string, tenantId: string) {
  return { id, tenantId, status: { in: CAMPAIGN_EDITABLE_STATUSES } };
}

/** A `count` of 0 means the row moved on between the read and the write. */
function assertWroteOne(count: number): void {
  if (count === 0) {
    throw new ApiError(CAMPAIGN_LOCKED_MESSAGE, 409);
  }
}

export const GET = requirePermissionParams(
  "canViewEmails",
  async (_req, { tenantId }, params) => {
    try {
      const campaign = await prisma.campaigns.findFirst({
        where: { id: parseUuid(params.id), tenantId },
        select: CAMPAIGN_DETAIL_SELECT,
      });

      if (!campaign) {
        return apiError(new Error(NOT_FOUND_MESSAGE), {
          route: GET_ROUTE,
          status: 404,
          safeMessage: NOT_FOUND_MESSAGE,
        });
      }

      return NextResponse.json(campaign);
    } catch (error) {
      return apiError(error, { route: GET_ROUTE });
    }
  },
);

export const PUT = requirePermissionParams(
  "canEditEmails",
  async (req, { tenantId }, params) => {
    try {
      const id = parseUuid(params.id);
      const { name, subject, contentJson } = await parseJsonBody(
        req,
        campaignUpdateSchema,
        { maxBytes: CAMPAIGN_BODY_MAX_BYTES },
      );

      // Ownership and the DRAFT|SCHEDULED guard BEFORE the render, so a
      // campaign that is sending never pays for a pipeline pass and another
      // tenant's id gets the 404 it is owed rather than a 409.
      await assertEditable(id, tenantId);

      const safeSubject =
        subject === undefined ? undefined : sanitizeEmailSubject(subject);
      if (safeSubject !== undefined && !safeSubject.trim()) {
        return apiValidationError(EMPTY_SUBJECT_MESSAGE, PUT_ROUTE);
      }

      // Re-derived through the US-011 pipeline as marketing, with the same
      // unsubscribe check the create runs. Absent from the body, both content
      // columns are left exactly as they are.
      const content = contentJson
        ? await resolveCampaignContent(contentJson, tenantId)
        : {};

      const { count } = await prisma.campaigns.updateMany({
        where: editableWhere(id, tenantId),
        data: {
          // `name` arrives trimmed and length-capped from the schema.
          ...(name !== undefined && { name }),
          ...(safeSubject !== undefined && { subject: safeSubject }),
          ...content,
        },
      });
      assertWroteOne(count);

      // `updateMany` answers with a count, so the saved row is read back —
      // the price of making the status predicate part of the write.
      const campaign = await prisma.campaigns.findFirst({
        where: { id, tenantId },
        select: CAMPAIGN_DETAIL_SELECT,
      });

      return NextResponse.json(campaign);
    } catch (error) {
      return apiError(error, { route: PUT_ROUTE });
    }
  },
);

export const DELETE = requirePermissionParams(
  "canEditEmails",
  async (_req, { tenantId }, params) => {
    try {
      const id = parseUuid(params.id);

      // Same guard as an edit, for a sharper reason: `campaign_recipients`
      // cascades off this row and `campaigns` is not soft-deletable, so
      // deleting a sent campaign would erase the evidence of which addresses
      // were mailed — permanently.
      await assertEditable(id, tenantId);

      const { count } = await prisma.campaigns.deleteMany({
        where: editableWhere(id, tenantId),
      });
      assertWroteOne(count);

      return NextResponse.json({ success: true });
    } catch (error) {
      return apiError(error, { route: DELETE_ROUTE });
    }
  },
);
