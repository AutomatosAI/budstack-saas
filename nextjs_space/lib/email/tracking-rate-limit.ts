/**
 * US-027 — metering the two public tracking routes without becoming their
 * outage.
 *
 * SERVER ONLY (`checkRateLimit` pulls in ioredis).
 *
 * THE TIMEOUT IS THE POINT, and it is here because the shared limiter's
 * documented `failMode: "open"` does not hold in the case that matters. Its
 * fail-open branch is a `catch`, so it only runs when the Redis call REJECTS —
 * but `lib/security/rate-limit.ts` builds its client with
 * `maxRetriesPerRequest: null`, which tells ioredis to queue commands
 * indefinitely while disconnected rather than error them. With Redis
 * unreachable the await therefore never settles and the request hangs. Observed
 * directly: with no local Redis, a click that reached the limiter never
 * returned, while the structural refusals in front of it answered instantly.
 *
 * On every other surface that is a slow page. Here it is every link in every
 * campaign already sitting in people's inboxes, so the meter has to be
 * abandonable. Racing it means a Redis outage costs the STATISTIC and the CAP,
 * never the redirect.
 *
 * NOT FIXED HERE, and it is not this story's to fix: the same latent hang
 * applies to every caller of `checkRateLimit` — the newsletter unsubscribe and
 * confirm routes among them, which are on the same "recipient following a link
 * out of an email" path. The real repair is a `commandTimeout` on the shared
 * client, which changes behaviour for auth and payment routes too.
 */

import {
  EMAIL_TRACKING_MAX_REQUESTS,
  EMAIL_TRACKING_TIMEOUT_MS,
  EMAIL_TRACKING_WINDOW_MS,
} from "@/lib/constants";
import { getPublicClientIp } from "@/lib/client-ip";
import { checkRateLimit } from "@/lib/security/rate-limit";

/** Namespaces, so a pixel fetch never shares a counter with a click. */
export const OPEN_RATE_LIMIT_SCOPE = "email-open";
export const CLICK_RATE_LIMIT_SCOPE = "email-click";

/**
 * The bucket a public tracking request is metered in.
 *
 * `getPublicClientIp` prefers `cf-connecting-ip` / `x-real-ip` and scans
 * `x-forwarded-for` RIGHT to left, so a caller cannot mint themselves a fresh
 * bucket per request by prepending a made-up hop — which is exactly what taking
 * the leading XFF entry would allow, and what would make the cap decorative
 * against the flood it exists to stop.
 *
 * Its docstring warns it is best-effort and may answer nothing. That is the
 * safe direction here: an unidentifiable caller shares one bucket with every
 * other unidentifiable caller rather than getting a private one, so the
 * degenerate case meters harder rather than softer.
 */
export function trackingRateLimitKey(scope: string, headers: Headers): string {
  return `${scope}:${getPublicClientIp(headers) ?? "unknown"}`;
}

/** Resolves to `true` (allow) after the deadline, whatever the limiter is doing. */
function allowAfterTimeout(): Promise<boolean> {
  return new Promise((resolve) => {
    // `unref` so a pending timer cannot hold a process open. The route has
    // already been answered by the time it fires.
    setTimeout(() => resolve(true), EMAIL_TRACKING_TIMEOUT_MS).unref?.();
  });
}

/**
 * Whether this caller is within the tracking cap.
 *
 * True also means "we could not find out in time" — see the module note. The
 * caller cannot tell the two apart, and deliberately: both mean "carry on".
 */
export async function withinTrackingRateLimit(
  scope: string,
  headers: Headers,
): Promise<boolean> {
  const metered = checkRateLimit(trackingRateLimitKey(scope, headers), {
    maxRequests: EMAIL_TRACKING_MAX_REQUESTS,
    windowMs: EMAIL_TRACKING_WINDOW_MS,
  })
    .then((result) => result.success)
    // A limiter that rejects has already emitted its own ops event and chosen
    // to fail open; this only keeps that choice when the rejection happens to
    // arrive through the race rather than through its own catch.
    .catch(() => true);

  return Promise.race([metered, allowAfterTimeout()]);
}
