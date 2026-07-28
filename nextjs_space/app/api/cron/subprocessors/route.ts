import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { activateDueSubprocessors } from "@/lib/legal/subprocessor-announce";
import { apiError } from "@/lib/api-error";
import { logger } from "@/lib/logger";

/**
 * Scheduled tick for the sub-processor register.
 *
 * Flips pending entries to active once their effective date arrives. Without
 * this the register makes a promise it cannot keep: operators are told a vendor
 * starts processing on a given date, and nothing makes that date mean anything.
 *
 * Idempotent — safe to call repeatedly, and safe to miss. A run that is a day
 * late activates the same entries; there is no per-run state to lose.
 *
 * Point a scheduler at this daily:
 *   curl -X POST https://<host>/api/cron/subprocessors \
 *        -H "x-cron-secret: $CRON_SECRET"
 *
 * See docs/PRDS/prd-data-protection-remediation.md (WS3, US-013).
 */

export const dynamic = "force-dynamic";

/** Constant-time compare so the secret cannot be probed byte by byte. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const route = "POST /api/cron/subprocessors";
  try {
    const expected = process.env.CRON_SECRET;

    // Fail CLOSED. An unset secret must not leave the endpoint open — it is the
    // difference between "not scheduled yet" and "anyone can drive the register".
    if (!expected) {
      logger.error("[Cron] CRON_SECRET is not configured; refusing to run");
      return apiError(new Error("CRON_SECRET not configured"), {
        route,
        status: 503,
        safeMessage: "Scheduled tasks are not configured.",
      });
    }

    const provided = request.headers.get("x-cron-secret");
    if (!provided || !secretMatches(provided, expected)) {
      // Deliberately terse: a caller without the secret learns nothing about
      // whether the endpoint or the secret was wrong.
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activated = await activateDueSubprocessors();

    logger.info("[Cron] Sub-processor register tick", {
      activated: activated.length,
    });

    return NextResponse.json({ success: true, activated });
  } catch (error) {
    return apiError(error, { route });
  }
}
