import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, apiValidationError } from "@/lib/api-error";
import {
  segmentFilterBodySchema,
  segmentNameSchema,
} from "@/lib/email/segment-query";
import {
  DUPLICATE_NAME_MESSAGE,
  SEGMENT_IN_USE_MESSAGE,
  SEGMENT_NOT_FOUND_MESSAGE,
  campaignsUsingSegment,
  deleteSegment,
  isDuplicateSegmentName,
  updateSegment,
} from "@/lib/email/segment-store";
import { requirePermissionParams } from "@/lib/permissions/require-permission";
import { parseJsonBody } from "@/lib/validation/body";
import { parseUuid } from "@/lib/validation/parse-uuid";

const PUT_ROUTE = "PUT /api/tenant-admin/segments/[id]";
const DELETE_ROUTE = "DELETE /api/tenant-admin/segments/[id]";

/**
 * Both fields optional, so a rename does not have to re-send the rule. `filter`
 * is `.optional()` rather than `.nullish()`: a segment with no rule is not a
 * segment, so there is no "clear it" state for a client to ask for.
 */
const segmentUpdateSchema = z
  .object({
    name: segmentNameSchema.optional(),
    filter: segmentFilterBodySchema.optional(),
  })
  .strict();

const notFound = (route: string) =>
  apiError(new Error(SEGMENT_NOT_FOUND_MESSAGE), {
    route,
    status: 404,
    safeMessage: SEGMENT_NOT_FOUND_MESSAGE,
  });

export const PUT = requirePermissionParams(
  "canEditEmails",
  async (req, { tenantId }, params) => {
    try {
      const id = parseUuid(params.id);
      const { name, filter } = await parseJsonBody(req, segmentUpdateSchema);

      const segment = await updateSegment({ tenantId, id, name, filter });
      // Ownership IS the update's row count — another tenant's id writes
      // nothing and gets the same 404 as an id that never existed.
      if (!segment) return notFound(PUT_ROUTE);

      return NextResponse.json(segment);
    } catch (error) {
      if (isDuplicateSegmentName(error)) {
        return apiValidationError(DUPLICATE_NAME_MESSAGE, PUT_ROUTE);
      }
      return apiError(error, { route: PUT_ROUTE });
    }
  },
);

/**
 * Deleting a segment is refused while an unsent campaign points at it.
 *
 * Not a foreign key, because `campaigns.audience` is a rule in a Json column
 * and a rule cannot carry one. The check reads the same column the resolver
 * reads, so what it protects and what would break are the same thing.
 */
export const DELETE = requirePermissionParams(
  "canEditEmails",
  async (_req, { tenantId }, params) => {
    try {
      const id = parseUuid(params.id);

      const inUse = await campaignsUsingSegment(id, tenantId);
      if (inUse.length > 0) {
        return apiError(new Error(SEGMENT_IN_USE_MESSAGE), {
          route: DELETE_ROUTE,
          status: 409,
          safeMessage: `${SEGMENT_IN_USE_MESSAGE} (${inUse.join(", ")})`,
        });
      }

      if (!(await deleteSegment(id, tenantId))) return notFound(DELETE_ROUTE);

      return NextResponse.json({ success: true });
    } catch (error) {
      return apiError(error, { route: DELETE_ROUTE });
    }
  },
);
