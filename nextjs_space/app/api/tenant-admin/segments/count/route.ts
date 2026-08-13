import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-error";
import {
  SEGMENT_COUNT_RATE_LIMIT,
  resolveSegmentFilter,
  segmentCountRateLimitKey,
  segmentFilterBodySchema,
} from "@/lib/email/segment-query";
import { requirePermission } from "@/lib/permissions/require-permission";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { parseJsonBody } from "@/lib/validation/body";

const ROUTE = "POST /api/tenant-admin/segments/count";

/**
 * US-025 — how many people a rule reaches, before it is saved.
 *
 * A POST that writes nothing. The rule being counted is the one in the
 * builder's boxes and may never become a row at all, so there is no id to
 * address and no query string that would hold a criterion list without
 * inventing a second encoding of the grammar. `canViewEmails` is the gate for
 * that reason: this is the read the picker's count already is.
 *
 * The answer is LIVE — resolved against the current customers, the current
 * consents and the current suppression list, every time it is asked.
 *
 * `matched` and `count` are both returned because they answer different
 * questions: `matched` is how many customers the rule describes, `count` is how
 * many of those may actually be mailed. Consent and suppression are applied
 * whether or not the author included the consent axis, so a builder that showed
 * only `matched` would promise an audience larger than any send.
 *
 * Counts, never addresses: `canViewEmails` is enough to ask how many, and is
 * not a reason to hand a browser the tenant's customer list.
 */
export const POST = requirePermission(
  "canViewEmails",
  async (req, { user, tenantId }) => {
    try {
      const limit = await checkRateLimit(
        segmentCountRateLimitKey(user.id),
        SEGMENT_COUNT_RATE_LIMIT,
      );
      if (!limit.success) return limit.response;

      const filter = await parseJsonBody(req, segmentFilterBodySchema);

      const { recipients, suppressedCount, matchedCount } =
        await resolveSegmentFilter(filter, tenantId);

      return NextResponse.json({
        matched: matchedCount,
        count: recipients.length,
        suppressed: suppressedCount,
      });
    } catch (error) {
      return apiError(error, { route: ROUTE });
    }
  },
);
