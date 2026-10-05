/**
 * The `bs_ref` landing cookie (BS-A01): written by middleware when a storefront
 * URL carries a well-formed `?ref=`, read by the consultation page (pre-fill)
 * and the consultation submit route (link vs typed), cleared by that route on
 * a successful sign-up (BS-A02).
 *
 * Host-only (no Domain attribute): it lives on the storefront host the visitor
 * landed on — subdomain or custom domain — which is the same host the sign-up
 * form posts to. HttpOnly, so the form never reads it; the page passes the
 * value down as an initial value instead.
 *
 * Edge-safe: middleware imports this.
 */
import type { NextResponse } from "next/server";
import {
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
  REFERRAL_COOKIE_NAME,
  normaliseAffiliateCode,
} from "./affiliate-code";

type ResponseWithCookies = Pick<NextResponse, "cookies">;

// Secure in production, as the impersonation cookie does; plain-http local dev
// (Safari refuses Secure cookies on http://localhost) would otherwise drop it.
function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

/**
 * Remember a landing code. A malformed or absent `ref` sets nothing and leaves
 * any earlier cookie alone; a well-formed one is stored upper-cased and
 * restarts the 30 days (the latest link the visitor followed wins).
 * Returns whether a cookie was written.
 */
export function setReferralCookie(
  response: ResponseWithCookies,
  ref: string | null | undefined,
): boolean {
  const code = normaliseAffiliateCode(ref);
  if (!code) return false;
  response.cookies.set(REFERRAL_COOKIE_NAME, code, {
    ...baseCookieOptions(),
    maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
  });
  return true;
}

/** Expire the landing cookie — called once the sign-up has succeeded. */
export function clearReferralCookie(response: ResponseWithCookies): void {
  response.cookies.set(REFERRAL_COOKIE_NAME, "", {
    ...baseCookieOptions(),
    maxAge: 0,
  });
}

/** The remembered code from a cookie value, or null when absent or tampered. */
export function readReferralCookie(value: string | null | undefined): string | null {
  return normaliseAffiliateCode(value);
}
