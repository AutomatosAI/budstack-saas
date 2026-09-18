/**
 * Customer salutation — Dr Green Phase 3 (BS-303).
 *
 * ONE constant reused by the consultation contact step, the shop onboarding
 * form, both registration routes and the settings surfaces; the same list Dr
 * Green's CreateClientDto validates against (US-302). Free choice by the
 * customer — never derived from an identity document.
 *
 * Pure and browser-safe.
 */
export const CUSTOMER_TITLES = ["Mr", "Mrs", "Ms", "Mx", "Dr", "Prof"] as const;

export type CustomerTitle = (typeof CUSTOMER_TITLES)[number];

export function isCustomerTitle(value: unknown): value is CustomerTitle {
  return (
    typeof value === "string" &&
    (CUSTOMER_TITLES as readonly string[]).includes(value)
  );
}

/**
 * The stored form of a submitted title: one of the list, or null for "not
 * chosen" (an empty string, whitespace, or anything off the list).
 */
export function normaliseCustomerTitle(value: unknown): CustomerTitle | null {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return isCustomerTitle(trimmed) ? trimmed : null;
}
