/**
 * A rate-limit check a public GET can walk away from.
 *
 * SERVER ONLY (`checkRateLimit` pulls in ioredis).
 *
 * WHY THIS EXISTS. `lib/security/rate-limit.ts` documents `failMode: "open"`,
 * but that branch is a `catch` — it only runs when the Redis call REJECTS. The
 * shared client is built with `maxRetriesPerRequest: null`, which tells ioredis
 * to QUEUE commands indefinitely while disconnected instead of erroring them,
 * so with Redis unreachable the await never settles and the request hangs.
 *
 * That is not theory. `lib/email/tracking-rate-limit.ts` recorded it for the
 * email tracking routes, and SEO US-018 hit it again on the OG image route:
 * with no local Redis, `GET /api/public/og` returned 200 after 140 SECONDS,
 * every millisecond of it inside the limiter. A link scraper would have given
 * up and rendered the page with no preview at all — the exact outcome the
 * branded card exists to prevent.
 *
 * Racing the check against a deadline means a Redis outage costs the CAP, never
 * the response. That is the correct trade for a route that reads nothing
 * private and writes nothing: the worst case is un-metered image rendering
 * during an outage we are already alerting on (`ops.rate_limit_failopen`).
 *
 * NOT FIXED HERE: the same latent hang applies to every other caller of
 * `checkRateLimit` — newsletter subscribe/confirm/unsubscribe, password reset,
 * consultation submit. The real repair is a `commandTimeout` on the shared
 * client, which changes behaviour for auth and payment routes too and is
 * nobody's story yet. `lib/email/tracking-rate-limit.ts` predates this module
 * and should collapse onto it when something else touches that file.
 */

import { getPublicClientIp } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/security/rate-limit";

export interface AbandonableRateLimit {
  /** Counter namespace, so two routes never share a bucket. */
  readonly scope: string;
  readonly headers: Headers;
  readonly maxRequests: number;
  readonly windowMs: number;
  /** How long to wait for the limiter before carrying on without it. */
  readonly timeoutMs: number;
}

/**
 * The bucket an anonymous caller is metered in.
 *
 * `getPublicClientIp` prefers `cf-connecting-ip` / `x-real-ip` and scans
 * `x-forwarded-for` RIGHT to left, so a caller cannot mint themselves a fresh
 * bucket per request by prepending a made-up hop — which taking the leading XFF
 * entry (the older pattern in the newsletter routes) does allow, and which
 * makes the cap decorative against the flood it exists to stop.
 *
 * Its own docstring warns it is best-effort and may answer nothing. That is the
 * safe direction: an unidentifiable caller shares ONE bucket with every other
 * unidentifiable caller rather than getting a private one, so the degenerate
 * case meters harder rather than softer.
 */
export function publicRateLimitKey(scope: string, headers: Headers): string {
  return `${scope}:${getPublicClientIp(headers) ?? "unknown"}`;
}

/** Resolves to `true` (allow) after the deadline, whatever the limiter is doing. */
function allowAfterTimeout(timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    // `unref` so a pending timer cannot hold the process open — the route has
    // already been answered by the time it fires.
    setTimeout(() => resolve(true), timeoutMs).unref?.();
  });
}

/**
 * Whether this caller is within the cap.
 *
 * True also means "we could not find out in time". The caller cannot tell the
 * two apart, deliberately: both mean carry on.
 */
export async function withinPublicRateLimit(
  limit: AbandonableRateLimit,
): Promise<boolean> {
  const metered = checkRateLimit(
    publicRateLimitKey(limit.scope, limit.headers),
    { maxRequests: limit.maxRequests, windowMs: limit.windowMs },
  )
    .then((result) => result.success)
    // A limiter that rejects has already emitted its ops event and chosen to
    // fail open; this keeps that choice when the rejection happens to arrive
    // through the race rather than through its own catch.
    .catch(() => true);

  return Promise.race([metered, allowAfterTimeout(limit.timeoutMs)]);
}
