import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, apiValidationError } from "@/lib/api-error";
import {
  segmentFilterBodySchema,
  segmentNameSchema,
} from "@/lib/email/segment-query";
import {
  DUPLICATE_NAME_MESSAGE,
  createSegment,
  isDuplicateSegmentName,
  listSegments,
} from "@/lib/email/segment-store";
import { requirePermission } from "@/lib/permissions/require-permission";
import { parseJsonBody } from "@/lib/validation/body";

const LIST_ROUTE = "GET /api/tenant-admin/segments";
const CREATE_ROUTE = "POST /api/tenant-admin/segments";

const segmentCreateSchema = z
  .object({ name: segmentNameSchema, filter: segmentFilterBodySchema })
  .strict();

/**
 * US-025 — saved audience rules.
 *
 * Read on `canViewEmails` and written on `canEditEmails`, the split US-009
 * applied to every email surface: a segment names who a marketing email goes
 * to, so editing one is editing a send.
 */
export const GET = requirePermission("canViewEmails", async (_req, { tenantId }) => {
  try {
    return NextResponse.json({ segments: await listSegments(tenantId) });
  } catch (error) {
    return apiError(error, { route: LIST_ROUTE });
  }
});

export const POST = requirePermission("canEditEmails", async (req, { tenantId }) => {
  try {
    const { name, filter } = await parseJsonBody(req, segmentCreateSchema);

    // The unique index is the real guard — two authors can post the same name
    // at once and only one write can win. This turns that race into the
    // sentence the builder shows rather than a 500.
    const segment = await createSegment({ tenantId, name, filter });

    return NextResponse.json(segment);
  } catch (error) {
    if (isDuplicateSegmentName(error)) {
      return apiValidationError(DUPLICATE_NAME_MESSAGE, CREATE_ROUTE);
    }
    return apiError(error, { route: CREATE_ROUTE });
  }
});
