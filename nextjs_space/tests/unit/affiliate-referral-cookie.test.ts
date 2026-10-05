import { describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import {
  AFFILIATE_CODE_FORMAT_ERROR,
  REFERRAL_COOKIE_MAX_AGE_SECONDS,
  REFERRAL_COOKIE_NAME,
  affiliateCodeFieldError,
  isAffiliateCodeFormat,
  normaliseAffiliateCode,
} from "@/lib/affiliate/affiliate-code";
import {
  clearReferralCookie,
  readReferralCookie,
  setReferralCookie,
} from "@/lib/affiliate/referral-cookie";
import { STOREFRONT_COOKIES } from "@/lib/cookie-utils";

/**
 * BS-A01 — the landing code matcher and the `bs_ref` cookie. The pattern is
 * Dr Green's (US-A02), so these cases are the contract both sides share.
 */
describe("affiliate code matcher (Dr Green US-A02 format)", () => {
  it.each([
    "ABCD",
    "abcd",
    "TEST-CODE",
    "a1-b2-c3",
    "12345678901234567890", // 20 = max
    "A--B",
  ])("accepts %s", (code) => {
    expect(isAffiliateCodeFormat(code)).toBe(true);
  });

  it.each([
    "",
    "ABC", // 3 < min 4
    "123456789012345678901", // 21 > max 20
    "-ABCD", // leading hyphen
    "ABCD-", // trailing hyphen
    "AB CD", // space
    "AB_CD", // underscore
    "AB/CD", // slash (the WordPress json_encode trap)
    "ÄBCD", // non-ASCII letter
    "ABCD\n",
  ])("rejects %j", (code) => {
    expect(isAffiliateCodeFormat(code)).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isAffiliateCodeFormat(undefined)).toBe(false);
    expect(isAffiliateCodeFormat(null)).toBe(false);
    expect(isAffiliateCodeFormat(1234)).toBe(false);
  });

  it("normalises to trimmed upper-case, null when malformed", () => {
    expect(normaliseAffiliateCode("  test-code ")).toBe("TEST-CODE");
    expect(normaliseAffiliateCode("AB")).toBeNull();
    expect(normaliseAffiliateCode(undefined)).toBeNull();
  });

  it("gives a field error only for a non-empty malformed value", () => {
    expect(affiliateCodeFieldError("")).toBeNull();
    expect(affiliateCodeFieldError("   ")).toBeNull();
    expect(affiliateCodeFieldError(undefined)).toBeNull();
    expect(affiliateCodeFieldError("TEST-CODE")).toBeNull();
    expect(affiliateCodeFieldError("AB")).toBe(AFFILIATE_CODE_FORMAT_ERROR);
  });
});

describe("bs_ref landing cookie", () => {
  it("stores a well-formed ref upper-cased for 30 days, HttpOnly, Lax, path /", () => {
    const res = NextResponse.json({});
    expect(setReferralCookie(res, "test-code")).toBe(true);

    const cookie = res.cookies.get(REFERRAL_COOKIE_NAME);
    expect(cookie?.value).toBe("TEST-CODE");
    expect(cookie?.maxAge).toBe(REFERRAL_COOKIE_MAX_AGE_SECONDS);
    expect(REFERRAL_COOKIE_MAX_AGE_SECONDS).toBe(30 * 24 * 60 * 60);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/");
  });

  it.each([null, undefined, "", "AB", "<script>", "AB/CD"])(
    "sets nothing for %j",
    (ref) => {
      const res = NextResponse.json({});
      expect(setReferralCookie(res, ref)).toBe(false);
      expect(res.cookies.get(REFERRAL_COOKIE_NAME)).toBeUndefined();
      expect(res.headers.get("set-cookie")).toBeNull();
    },
  );

  it("clears the cookie with Max-Age 0", () => {
    const res = NextResponse.json({ ok: true });
    clearReferralCookie(res);
    const cookie = res.cookies.get(REFERRAL_COOKIE_NAME);
    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
    expect(cookie?.path).toBe("/");
  });

  it("reads back only a well-formed value", () => {
    expect(readReferralCookie("TEST-CODE")).toBe("TEST-CODE");
    expect(readReferralCookie("x")).toBeNull();
    expect(readReferralCookie(undefined)).toBeNull();
  });

  it("is listed as an essential storefront cookie", () => {
    const entry = STOREFRONT_COOKIES.find((c) => c.name === REFERRAL_COOKIE_NAME);
    expect(entry?.category).toBe("essential");
    expect(entry?.duration).toBe("30 days");
  });
});
