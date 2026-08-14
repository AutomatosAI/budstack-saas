/**
 * Entitlement seam for the per-module basic/pro split.
 *
 * Resolution reads the operator-controlled `tenants.plan` column (SEO
 * Supercharge US-011) through the fail-closed parser in `./plan`. Call sites
 * are unchanged from the #235 shape — API responses carry `features`, UI
 * sections check membership — they now pass the tenant's `plan` alongside its
 * `id`. A call site that omits `plan` resolves fail-closed to 'basic'.
 *
 * Deliberately NOT read from `tenants.settings`: that JSON is tenant-writable
 * via the settings PATCH routes, and entitlements must be operator-controlled.
 * Deliberately NOT read from Clerk: the org's `publicMetadata.plan` is a
 * write-only mirror (see `./clerk-plan-mirror`).
 *
 * Pure module — no I/O. The DB read and the route gate live in
 * `./require-feature`.
 */

import { parsePlan, type Plan } from "./plan";

export const FEATURES = {
  ANALYTICS_CORE: "analytics.core",
  ANALYTICS_RETENTION: "analytics.retention",
  ANALYTICS_CAMPAIGNS: "analytics.campaigns",
  ANALYTICS_EXPORTS: "analytics.exports",
  SEO_CORE: "seo.core",
  SEO_PRO: "seo.pro",
  // Automatos module (PRs #237-#241). These keys shipped in a parallel branch
  // while the plan matrix was being built; the #242 merge kept this file's
  // version and dropped them — restored here. Both are Pro-tier: the chatbot
  // 403 copy and PRD-303's tier table say so, and BASIC_FEATURES below
  // excludes them on purpose (trial/pro/custom resolve to ALL_FEATURES).
  AUTOMATOS_CHATBOT: "automatos.chatbot",
  AUTOMATOS_WIRE: "automatos.wire",
} as const;

export type FeatureKey = (typeof FEATURES)[keyof typeof FEATURES];

const ALL_FEATURES: ReadonlySet<FeatureKey> = new Set(
  Object.values(FEATURES),
);

/**
 * Basic ($99/mo).
 *
 * Every `analytics.*` key stays granted — unchanged from the pre-column
 * behaviour. The analytics module has not made its own basic/pro split yet and
 * this story does not make it for them; when it does, the keys move out of this
 * set and nothing else changes.
 *
 * SEO is where the split is real: `seo.core` (the Workstream A metadata,
 * sitemaps and canonicals that Basic pays for) is in, `seo.pro` (JSON-LD, OG
 * studio, redirects, audit, AI assist) is out.
 */
const BASIC_FEATURES: ReadonlySet<FeatureKey> = new Set<FeatureKey>([
  FEATURES.ANALYTICS_CORE,
  FEATURES.ANALYTICS_RETENTION,
  FEATURES.ANALYTICS_CAMPAIGNS,
  FEATURES.ANALYTICS_EXPORTS,
  FEATURES.SEO_CORE,
]);

/**
 * The matrix. `trial` is the 3-month launch window — trial tenants must see
 * Pro working, not locked, so they know what they would be buying. `custom` is
 * the bespoke enterprise tier, negotiated to everything. `pro` ($169/mo) is
 * everything by definition.
 */
const PLAN_FEATURES: Readonly<Record<Plan, ReadonlySet<FeatureKey>>> = {
  trial: ALL_FEATURES,
  basic: BASIC_FEATURES,
  pro: ALL_FEATURES,
  custom: ALL_FEATURES,
};

/**
 * Resolve the feature set a tenant is entitled to.
 *
 * `plan` is the raw `tenants.plan` value — pass it straight from the row, it is
 * parsed fail-closed here. Omitting it (or passing anything unrecognised)
 * resolves to 'basic', never to 'trial': a resolution failure must degrade a
 * tenant, never hand out a free upgrade.
 */
export function getTenantFeatures(tenant: {
  id: string;
  plan?: unknown;
}): ReadonlySet<FeatureKey> {
  return PLAN_FEATURES[parsePlan(tenant.plan)];
}

/** The feature set for an already-parsed plan — for callers holding a `Plan`. */
export function featuresForPlan(plan: Plan): ReadonlySet<FeatureKey> {
  return PLAN_FEATURES[plan];
}

// Accepts any iterable of strings because the client reads keys straight off
// the JSON response (string[]), while server code holds the typed set.
export function hasFeature(features: Iterable<string>, key: FeatureKey): boolean {
  for (const granted of features) {
    if (granted === key) return true;
  }
  return false;
}
