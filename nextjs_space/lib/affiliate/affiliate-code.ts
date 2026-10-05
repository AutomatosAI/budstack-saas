/**
 * Dr Green affiliate codes — the BudStacks capture side (BS-A01..A03,
 * tasks/prd-drgreen-affiliate-codes.md). Dr Green defines the code (its
 * US-A02) and decides what it links to (US-A04); BudStacks only remembers the
 * code a visitor arrived with, lets them type one, and forwards it.
 *
 * A code never changes a price and never blocks a sign-up.
 *
 * Pure and runtime-agnostic: imported by middleware (edge), the consultation
 * page and route (node) and the sign-up form (browser).
 */

/**
 * Dr Green US-A02: 4–20 characters, letters, digits and hyphens, starting and
 * ending with a letter or digit. Stored upper-case, matched case-insensitively.
 */
export const AFFILIATE_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{2,18}[A-Za-z0-9]$/;
export const AFFILIATE_CODE_MAX_LENGTH = 20;

/** The query parameter a holder's share link carries (`?ref=CODE`). */
export const REFERRAL_QUERY_PARAM = "ref";

/** First-party landing cookie — strictly functional (lib/cookie-utils.ts). */
export const REFERRAL_COOKIE_NAME = "bs_ref";
export const REFERRAL_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** Sent to Dr Green as `affiliateCodeSource` (US-A04). */
export const AFFILIATE_CODE_SOURCE = {
  LINK: "link",
  TYPED: "typed",
} as const;

export type AffiliateCodeSource =
  (typeof AFFILIATE_CODE_SOURCE)[keyof typeof AFFILIATE_CODE_SOURCE];

/** Field copy for the sign-up forms. */
export const AFFILIATE_CODE_LABEL = "Referral code (optional)";
export const AFFILIATE_CODE_HELP = "Does not change any price.";
export const AFFILIATE_CODE_FORMAT_ERROR =
  "Referral codes are 4 to 20 letters, numbers or hyphens. Check the code, or leave the field empty.";

/** True when `value` is a well-formed code (case-insensitive). */
export function isAffiliateCodeFormat(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= AFFILIATE_CODE_MAX_LENGTH &&
    AFFILIATE_CODE_PATTERN.test(value)
  );
}

/**
 * The canonical (trimmed, upper-cased) code, or null for anything absent or
 * malformed. Malformed input is never an error at this layer: it is simply
 * not a code.
 */
export function normaliseAffiliateCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return isAffiliateCodeFormat(trimmed) ? trimmed.toUpperCase() : null;
}

/**
 * Inline field error for the sign-up forms: null when the field is empty (it
 * is optional) or well-formed, the format message otherwise.
 */
export function affiliateCodeFieldError(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (trimmed === "") return null;
  return isAffiliateCodeFormat(trimmed) ? null : AFFILIATE_CODE_FORMAT_ERROR;
}

/** What BudStacks forwards to Dr Green and keeps on the local user. */
export interface AffiliateAttribution {
  affiliateCode: string;
  affiliateCodeSource: AffiliateCodeSource;
}

/**
 * BS-A02. The submitted field is the only source of the code: the form is
 * pre-filled from the `bs_ref` cookie, so a customer who clears the field has
 * removed the code and nothing is sent. The cookie decides attribution only —
 * `link` when the submitted code is the remembered one, `typed` otherwise (a
 * typed code wins over a remembered link: Dr Green design decision).
 *
 * Returns null when there is no well-formed submitted code.
 */
export function resolveAffiliateAttribution(
  submitted: unknown,
  rememberedCookieValue: string | null | undefined,
): AffiliateAttribution | null {
  const affiliateCode = normaliseAffiliateCode(submitted);
  if (!affiliateCode) return null;
  const remembered = normaliseAffiliateCode(rememberedCookieValue);
  return {
    affiliateCode,
    affiliateCodeSource:
      remembered === affiliateCode ? AFFILIATE_CODE_SOURCE.LINK : AFFILIATE_CODE_SOURCE.TYPED,
  };
}

/**
 * The two Dr Green client-create fields (US-A04), present only together and
 * only for a well-formed code — so a sign-up without a code sends exactly the
 * payload it sent before this feature. Same conditional-spread shape as
 * `consentSource` in both payload builders.
 */
export function affiliatePayloadFields(input: {
  affiliateCode?: string | null;
  affiliateCodeSource?: string | null;
}): Partial<AffiliateAttribution> {
  const affiliateCode = normaliseAffiliateCode(input.affiliateCode);
  const source = input.affiliateCodeSource;
  if (!affiliateCode) return {};
  if (source !== AFFILIATE_CODE_SOURCE.LINK && source !== AFFILIATE_CODE_SOURCE.TYPED) return {};
  return { affiliateCode, affiliateCodeSource: source };
}
