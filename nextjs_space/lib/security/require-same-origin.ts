import { NextRequest, NextResponse } from "next/server";

/**
 * Same-origin defence-in-depth guard for state-changing super-admin routes
 * (PRD-201 AC-4).
 *
 * Layered on top of Clerk's `SameSite=Lax` session cookie: a state-changing
 * request is rejected unless it carries a positive same-origin signal — either
 * `Sec-Fetch-Site: same-origin` or an `Origin` header whose host matches the
 * request host. Absent or cross-site/same-site signals are blocked. This
 * survives a future relaxation of the cookie SameSite policy.
 *
 * Returns a `403 CROSS_ORIGIN_BLOCKED` response to return immediately, or
 * `null` when the request is same-origin and may proceed.
 */
export function requireSameOrigin(req: NextRequest): NextResponse | null {
  const secFetchSite = req.headers.get("sec-fetch-site");

  // Strongest signal: the browser's own site classification.
  if (secFetchSite === "same-origin") return null;
  if (secFetchSite === "cross-site" || secFetchSite === "same-site") {
    return crossOriginBlocked();
  }

  // No Sec-Fetch-Site (older browsers / non-browser): compare Origin host to
  // the request host. Same-origin fetch() sends Origin on non-GET requests.
  const origin = req.headers.get("origin");
  if (origin) {
    const requestHost =
      req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (originHost && requestHost && originHost === requestHost) {
      return null;
    }
    return crossOriginBlocked();
  }

  // No same-origin signal at all on a state-changing request → block.
  return crossOriginBlocked();
}

function crossOriginBlocked(): NextResponse {
  return NextResponse.json(
    { error: "Cross-origin request blocked", code: "CROSS_ORIGIN_BLOCKED" },
    { status: 403 },
  );
}
