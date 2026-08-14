"use client";

/**
 * Cookie Consent Utility Functions
 * Provides region-based consent logic for GDPR, CCPA, POPIA compliance
 */

// EU countries requiring GDPR opt-in consent
const EU_COUNTRIES = [
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
];

// UK has its own GDPR-equivalent rules post-Brexit
const UK_COUNTRIES = ["GB", "UK"];

// Countries with GDPR-like regulations
const GDPR_LIKE_COUNTRIES = [
  "ZA", // South Africa (POPIA)
  "BR", // Brazil (LGPD)
  "CH", // Switzerland
  "NO", // Norway
  "IS", // Iceland
  "LI", // Liechtenstein
];

// US states don't require opt-in, but CCPA requires opt-out capability
const US_COUNTRIES = ["US"];

export type ConsentModel = "opt-in" | "opt-out";

export interface ConsentCategories {
  essential: boolean; // Always true
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

export interface CookieConsentState {
  hasConsented: boolean;
  consentModel: ConsentModel;
  categories: ConsentCategories;
  consentDate?: string;
}

/**
 * Determines the consent model based on country code
 * - 'opt-in': Requires explicit consent before setting non-essential cookies (GDPR, POPIA)
 * - 'opt-out': Cookies allowed by default, user can opt out (CCPA)
 */
export function getConsentModel(
  countryCode: string | null | undefined,
): ConsentModel {
  if (!countryCode) return "opt-in"; // Default to strictest model

  const code = countryCode.toUpperCase();

  if (
    EU_COUNTRIES.includes(code) ||
    UK_COUNTRIES.includes(code) ||
    GDPR_LIKE_COUNTRIES.includes(code)
  ) {
    return "opt-in";
  }

  // US and other countries use opt-out model
  return "opt-out";
}

/**
 * Check if a country requires GDPR compliance
 */
export function isGDPRRegion(countryCode: string | null | undefined): boolean {
  if (!countryCode) return true; // Default to true for safety

  const code = countryCode.toUpperCase();
  return EU_COUNTRIES.includes(code) || UK_COUNTRIES.includes(code);
}

/**
 * Check if a country requires POPIA compliance (South Africa)
 */
export function isPOPIARegion(countryCode: string | null | undefined): boolean {
  if (!countryCode) return false;
  return countryCode.toUpperCase() === "ZA";
}

/**
 * Get region-specific banner text
 */
export function getRegionBannerText(countryCode: string | null | undefined): {
  title: string;
  message: string;
  acceptLabel: string;
  declineLabel: string;
  customizeLabel: string;
} {
  const model = getConsentModel(countryCode);

  if (model === "opt-in") {
    return {
      title: "Cookie Consent",
      message:
        'We use cookies to enhance your browsing experience, analyze site traffic, and personalize content. By clicking "Accept All", you consent to our use of cookies.',
      acceptLabel: "Accept All",
      declineLabel: "Reject All",
      customizeLabel: "Customize",
    };
  }

  // Opt-out model (US/CCPA)
  return {
    title: "Cookie Notice",
    message:
      "We use cookies to enhance your experience. You can manage your preferences at any time.",
    acceptLabel: "Got it",
    declineLabel: "Opt out",
    customizeLabel: "Manage Cookies",
  };
}

// Cookie names
export const CONSENT_COOKIE_NAME = "budstack_cookie_consent";
export const CONSENT_CATEGORIES_COOKIE_NAME = "budstack_cookie_categories";

/**
 * Default consent categories based on consent model
 */
export function getDefaultCategories(model: ConsentModel): ConsentCategories {
  return {
    essential: true, // Always enabled
    analytics: model === "opt-out", // Default true for opt-out regions
    marketing: model === "opt-out",
    preferences: model === "opt-out",
  };
}

/**
 * Parse consent categories from cookie
 */
export function parseConsentCategories(
  cookieValue: string | undefined,
): ConsentCategories | null {
  if (!cookieValue) return null;

  try {
    const parsed = JSON.parse(cookieValue);
    return {
      essential: true, // Always true
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      preferences: Boolean(parsed.preferences),
    };
  } catch {
    return null;
  }
}

/**
 * Has this visitor consented to analytics cookies?
 *
 * SEO US-026 — the per-visitor half of the GA4 gate (the store-level half is
 * `settings.analyticsEnabled`, see `lib/seo/site-verification.ts`). Takes the
 * raw `document.cookie` string so the rule is testable without a DOM.
 *
 * NO COOKIE MEANS NO, in every region. `getDefaultCategories('opt-out')` would
 * say analytics is on by default for a US visitor, but that describes what the
 * banner PRE-TICKS, not a decision the visitor has made — and this is the same
 * reading `useCookieConsent` already applies (`categories?.analytics ?? false`).
 * The strict posture the PRD assumes; a move to Consent Mode changes it here.
 */
export function analyticsConsentGranted(
  cookieString: string | null | undefined,
): boolean {
  if (!cookieString) return false;
  const match = new RegExp(
    `(?:^|; )${CONSENT_CATEGORIES_COOKIE_NAME}=([^;]*)`,
  ).exec(cookieString);
  return parseConsentCategories(match?.[1])?.analytics === true;
}

/**
 * Stringify consent categories for cookie storage
 */
export function stringifyConsentCategories(
  categories: ConsentCategories,
): string {
  return JSON.stringify({
    analytics: categories.analytics,
    marketing: categories.marketing,
    preferences: categories.preferences,
  });
}
