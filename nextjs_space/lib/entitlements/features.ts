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

export function hasFeature(
  features: ReadonlySet<FeatureKey> | FeatureKey[],
  key: FeatureKey,
): boolean {
  return Array.isArray(features) ? features.includes(key) : features.has(key);
}
