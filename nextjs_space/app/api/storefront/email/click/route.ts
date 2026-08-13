import { NextRequest, NextResponse } from "next/server";

import {
  CLICK_SIGNATURE_PARAM,
  CLICK_TARGET_PARAM,
  TRACKING_TOKEN_PARAM,
  isTrackableLinkUrl,
} from "@/lib/email/email-tracking";
import {
  CLICK_RATE_LIMIT_SCOPE,
  withinTrackingRateLimit,
} from "@/lib/email/tracking-rate-limit";
import { recordTrackingEvent } from "@/lib/email/tracking-store";
import {
  plausibleClickTarget,
  recipientIdFromToken,
  verifiedClickTarget,
} from "@/lib/email/tracking-token";
import { logger } from "@/lib/logger";
import { getTenantFromRequest } from "@/lib/tenant/tenant";
import { runWithTenantContextAsync } from "@/lib/tenant/tenant-context";

/**
 * GET /api/storefront/email/click — US-027's link-wrapping redirect.
 *
 * THE SIGNATURE IS THE WHOLE ROUTE. A redirect that forwards to whatever its
 * query string says is an open redirect wearing the store's own domain, which
 * is a phishing primitive handed to anyone who can read one marketing email.
 * `verifiedClickTarget` refuses anything this platform did not sign for THIS
 * tenant, and the decoded URL is re-checked against the scheme rule afterwards
 * — a signature proves we minted the link, not that it is one worth following.
 *
 * RECORDING IS BEST-EFFORT AND SEPARATE. The recipient token is verified
 * independently of the destination, so a message compiled after tracking was
 * turned off (its `t=` is empty) still reaches where the author pointed it.
 * Nothing about the redirect depends on the write succeeding.
 *
 * A LINK IS NEVER FOLLOWED UNVERIFIED. When the signature does not check out
 * the answer is a plain 400 page, not a redirect to the unsigned value and not
 * a redirect to the store's homepage — the first is the vulnerability, and the
 * second sends someone somewhere they did not ask to go.
 *
 * NOTHING IS SPENT ON A REQUEST THAT CANNOT BE ONE OF OURS. The checks below
 * are ordered by cost — structure, then Redis, then Postgres, then the HMAC —
 * so an unauthenticated flood cannot buy a tenant lookup per request on the
 * connection pool every store shares. This is the one route in the feature
 * whose refusal is visible to a reader, so its cheap gate matters more than the
 * pixel's.
 */

const ROUTE = "GET /api/storefront/email/click";

/**
 * No interpolation, so nothing needs escaping. The one case this renders is a
 * link whose signature does not verify — a key rotation, a truncated URL, or
 * somebody's attempt at the open redirect above — and none of them is improved
 * by naming the store or echoing the address back.
 */
const INVALID_LINK_PAGE = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Link not recognised</title></head>
<body style="margin:0;padding:48px 24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111827;background:#f9fafb">
<div style="max-width:520px;margin:0 auto">
<h1 style="font-size:20px;margin:0 0 12px">We couldn't check this link</h1>
<p style="font-size:15px;line-height:22px;margin:0">This link came from an email, but we can't confirm it is one we sent, so we haven't followed it. Please open the message again, or go to the store directly.</p>
</div></body></html>`;

const INVALID_LINK_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
  "X-Content-Type-Options": "nosniff",
};

function invalidLink(): NextResponse {
  return new NextResponse(INVALID_LINK_PAGE, {
    status: 400,
    headers: { ...INVALID_LINK_HEADERS },
  });
}

/** Best-effort, and its failure is logged rather than shown to the reader. */
async function record(tenantId: string, token: string | null): Promise<void> {
  const recipientId = recipientIdFromToken(token);
  if (!recipientId) return;

  await runWithTenantContextAsync(tenantId, () =>
    recordTrackingEvent({ tenantId, recipientId, event: "click" }),
  );
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const encoded = params.get(CLICK_TARGET_PARAM);
  const signature = params.get(CLICK_SIGNATURE_PARAM);

  // FIRST, AND WITHOUT SPENDING ANYTHING. Resolving the tenant below is a
  // database round trip on the pool every store on the platform shares, so a
  // request that could not possibly be one of ours — no parameters, junk
  // parameters, a destination no redirect may follow — is refused here, before
  // any I/O and before the signing key is even read. `plausibleClickTarget`
  // proves nothing about authenticity; it only says this is worth looking at.
  const candidate = plausibleClickTarget(encoded, signature);
  if (!candidate || !isTrackableLinkUrl(candidate)) return invalidLink();

  // THEN meter, still before the database. Redis is the cheap gate in front of
  // Postgres; the cap is far above anything a person clicking links reaches,
  // and the key comes from the trusted edge headers rather than the forgeable
  // leading `x-forwarded-for` hop. Abandonable, because a limiter that cannot
  // answer must not become the reason a campaign's links stop working — see
  // `lib/email/tracking-rate-limit.ts`.
  if (!(await withinTrackingRateLimit(CLICK_RATE_LIMIT_SCOPE, request.headers))) {
    return invalidLink();
  }

  const tenant = await getTenantFromRequest(request);
  if (!tenant) return invalidLink();

  // The authoritative check, which re-does the structural one rather than
  // trusting the call above: only a signature this platform made for THIS
  // tenant may become a redirect.
  const target = verifiedClickTarget(tenant.id, encoded, signature);
  if (!target || !isTrackableLinkUrl(target)) return invalidLink();

  try {
    await record(tenant.id, params.get(TRACKING_TOKEN_PARAM));
  } catch (error) {
    logger.error("email click tracking failed", {
      route: ROUTE,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    return NextResponse.redirect(target, {
      status: 302,
      headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
  } catch {
    // `NextResponse.redirect` parses the target; a signed URL that will not
    // construct is a bug rather than an attack, and the reader still gets the
    // honest page instead of a 500.
    return invalidLink();
  }
}
