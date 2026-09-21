/**
 * Marketing consent — Dr Green Phase 3 (BS-301/302/304).
 *
 * THE CONSENT TEST IS `users.marketingConsentAt !== null` (Email Phase 2,
 * US-023) and nothing else: the campaign audience, saved segments, the
 * newsletter unsubscribe and the tenant-admin toggle all read that column. A
 * separate boolean was deliberately NOT added — two columns for one fact is
 * how a withdrawn customer gets mailed. What Phase 3 adds is attribution
 * (`marketingConsentSource`, below) and forwarding to Dr Green.
 *
 * Pure and browser-safe (the forms import the copy).
 */

/** Where a consent value came from — sent to Dr Green as `consentSource`. */
export const CONSENT_SOURCE = {
  CONSULTATION: "budstacks-consultation",
  ID_UPLOAD: "budstacks-id-upload",
  SHOP_REGISTER: "budstacks-shop-register",
  STORE_SETTINGS: "budstacks-settings",
} as const;

export type ConsentSource = (typeof CONSENT_SOURCE)[keyof typeof CONSENT_SOURCE];

const DEFAULT_STORE_NAME = "this store";

/**
 * The checkbox label. Placeholder wording until Ricardo/legal confirm the
 * final copy and whether SMS is included (PRD open question) — change it here
 * and every form follows.
 */
export function marketingConsentCopy(storeName?: string | null): string {
  const name = storeName?.trim() || DEFAULT_STORE_NAME;
  return `Keep me informed about products and offers from ${name} by email or SMS`;
}

/** `true` only for an explicit boolean true — consent is never inferred. */
export function isExplicitConsent(value: unknown): boolean {
  return value === true;
}
