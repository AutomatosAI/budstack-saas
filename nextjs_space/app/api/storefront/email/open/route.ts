import { NextRequest, NextResponse } from "next/server";

import { TRACKING_TOKEN_PARAM } from "@/lib/email/email-tracking";
import {
  OPEN_RATE_LIMIT_SCOPE,
  withinTrackingRateLimit,
} from "@/lib/email/tracking-rate-limit";
import { recordTrackingEvent } from "@/lib/email/tracking-store";
import { recipientIdFromToken } from "@/lib/email/tracking-token";
import { logger } from "@/lib/logger";
import { getTenantFromRequest } from "@/lib/tenant/tenant";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";

/**
 * GET /api/storefront/email/open — US-027's open pixel.
 *
 * IT ALWAYS RETURNS THE PIXEL. Every branch below — no store on this host, a
 * missing or forged token, a tenant who has since turned tracking off, a
 * database that is down — ends at the same image and the same 200. A recipient
 * reading their mail is not making a request they can act on the result of; a
 * 404 here is a broken-image icon in the middle of somebody's newsletter,
 * bought in exchange for a statistic nobody will read.
 *
 * NO PII IN THE URL: the only parameter is a signed recipient token, which
 * names a row rather than a person. The signature is what makes it useless to a
 * stranger, and checking it before touching the database is what stops an
 * unauthenticated caller turning this route into a lookup service.
 *
 * The tenant comes from the request HOST — the host the pixel was built against
 * — so a token minted by one store can only ever be counted on that store.
 */

const ROUTE = "GET /api/storefront/email/open";

/** 1×1 transparent GIF, 42 bytes. The smallest unambiguously-an-image reply. */
const PIXEL_GIF_BASE64 =
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const PIXEL_BYTES = Buffer.from(PIXEL_GIF_BASE64, "base64");

/**
 * `no-store` because a cached pixel is an open that is never reported again,
 * and `private` because the response is meaningless to anyone but this
 * recipient. Providers who proxy images ignore some of this; sending it costs
 * nothing and the ones who honour it are the ones that matter.
 */
const PIXEL_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": "image/gif",
  "Content-Length": String(PIXEL_BYTES.length),
  "Cache-Control": "no-store, no-cache, must-revalidate, private, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
};

function pixel(): NextResponse {
  return new NextResponse(new Uint8Array(PIXEL_BYTES), {
    status: 200,
    headers: { ...PIXEL_HEADERS },
  });
}

export async function GET(request: NextRequest) {
  try {
    const recipientId = recipientIdFromToken(
      request.nextUrl.searchParams.get(TRACKING_TOKEN_PARAM),
    );
    if (!recipientId) return pixel();

    const tenant = await getTenantFromRequest(request);
    if (!tenant) return pixel();

    // Metered per caller, and a throttled one still gets the image — the cap
    // exists to bound writes, not to withhold a pixel. Set loose because mail
    // providers fetch images through shared proxies, so one address can
    // legitimately stand for thousands of separate recipients, and abandonable
    // because a Redis outage must not hold a message's images open.
    if (!(await withinTrackingRateLimit(OPEN_RATE_LIMIT_SCOPE, request.headers))) {
      return pixel();
    }

    await runWithTenantContextAsync(tenant.id, () =>
      recordTrackingEvent({
        tenantId: tenant.id,
        recipientId,
        event: "open",
      }),
    );
  } catch (error) {
    // Swallowed on purpose, and logged so it is not invisible. There is no
    // failure of this route a recipient can do anything about, and the
    // alternative to a pixel is a broken image in their inbox.
    logger.error("email open tracking failed", {
      route: ROUTE,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return pixel();
}
