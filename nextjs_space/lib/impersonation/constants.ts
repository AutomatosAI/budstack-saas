/**
 * PRD-302 impersonation constants + config.
 *
 * The cookie carries the RAW bearer token (httpOnly; never readable by JS).
 * The DB stores only its SHA-256 hash — see lib/impersonation/token.ts.
 */

export const IMPERSONATION_COOKIE = "bs_impersonation";

const DEFAULT_MAX_HOURS = 4;
const MAX_CONFIGURABLE_HOURS = 24;

/**
 * Session lifetime in hours. AC-7: 4h default, configurable via
 * IMPERSONATION_MAX_HOURS. Malformed / out-of-range values (<= 0 or > 24)
 * fall back to the default rather than silently minting long-lived sessions.
 */
export function impersonationMaxHours(): number {
  const raw = process.env.IMPERSONATION_MAX_HOURS;
  if (!raw) return DEFAULT_MAX_HOURS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_CONFIGURABLE_HOURS) {
    return DEFAULT_MAX_HOURS;
  }
  return parsed;
}

/** Expiry timestamp for a session starting at `from`. */
export function impersonationExpiry(from: Date): Date {
  return new Date(from.getTime() + impersonationMaxHours() * 60 * 60 * 1000);
}

/** Seconds until `expiresAt`, floored at 0 — used for the cookie Max-Age. */
export function secondsUntil(expiresAt: Date, now: Date): number {
  return Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
}
