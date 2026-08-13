/**
 * Entitlement seam for the per-module basic/pro split.
 *
 * Trial policy (2026-08): every tenant is inside the all-features launch
 * window, so resolution returns the full set. When the operator-controlled
 * `tenants.plan` column lands, `getTenantFeatures` resolves from the plan
 * matrix instead — call sites (API responses carry `features`, UI sections
 * check membership) are already wired and do not change.
 *
 * Deliberately NOT read from `tenants.settings`: that JSON is tenant-writable
 * via the settings PATCH routes, and entitlements must be operator-controlled.
 */

export const FEATURES = {
  ANALYTICS_CORE: "analytics.core",
  ANALYTICS_RETENTION: "analytics.retention",
  ANALYTICS_CAMPAIGNS: "analytics.campaigns",
  ANALYTICS_EXPORTS: "analytics.exports",
  AUTOMATOS_CHATBOT: "automatos.chatbot",
  AUTOMATOS_WIRE: "automatos.wire",
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

const ALL_FEATURES: ReadonlySet<FeatureKey> = new Set(
  Object.values(FEATURES),
);

export function getTenantFeatures(_tenant: {
  id: string;
}): ReadonlySet<FeatureKey> {
  return ALL_FEATURES;
}

// Accepts any iterable of strings because the client reads keys straight off
// the JSON response (string[]), while server code holds the typed set.
export function hasFeature(features: Iterable<string>, key: FeatureKey): boolean {
  for (const granted of features) {
    if (granted === key) return true;
  }
  return false;
}
