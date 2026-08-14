/**
 * SEO Supercharge US-013 — what `seo.pro` buys, and the one predicate that
 * decides whether a tenant sees it or sees the lock.
 *
 * The catalogue carries one entry per Workstream C capability. Two surfaces
 * render it and must not drift apart: the locked cards in the SEO Manager
 * (Basic tenants only) and the static upgrade page. As each C story lands, its
 * section replaces the locked card for entitled tenants — the entry stays,
 * because a Basic tenant still needs to be told what they are missing.
 *
 * Copy rule from the PRD: one concrete benefit per feature, stated as what it
 * does. `id` is a stable list key; it is NOT an entitlement key — the only
 * entitlement key involved is `FEATURES.SEO_PRO`.
 *
 * `isSeoProUnlocked` is PRESENTATION. It answers "render the feature or render
 * the lock", nothing more; the boundary for every Pro write is `requireFeature`
 * on the route. Both resolve through `getTenantFeatures`, which is what stops
 * the two from disagreeing.
 *
 * Pure module — imported by a client component, so it must stay free of
 * Prisma, Clerk and next/server.
 */

import { FEATURES, getTenantFeatures } from "@/lib/entitlements/features";

/**
 * Does this tenant's plan include SEO Pro?
 *
 * `plan` is the raw `tenants.plan` column value, parsed fail-closed downstream:
 * an unrecognised, null or missing value resolves to 'basic' and returns false,
 * so a resolution failure shows the upsell rather than unlocking Pro for free.
 * True for trial, pro and custom — trial is the launch window, and those
 * tenants are meant to see Pro working.
 */
export function isSeoProUnlocked(tenant: {
  id: string;
  plan?: unknown;
}): boolean {
  return getTenantFeatures(tenant).has(FEATURES.SEO_PRO);
}

export interface SeoProFeature {
  /** Stable list key. Not an entitlement key — see the module docstring. */
  id: string;
  title: string;
  /** One line, one concrete benefit. */
  valueProp: string;
}

export const SEO_PRO_FEATURES: readonly SeoProFeature[] = [
  {
    id: "structured-data",
    title: "Structured data",
    valueProp:
      "Product, Article and FAQ schema on every page, so search engines can show your prices, dates and answers in the result itself.",
  },
  {
    id: "og-images",
    title: "Social preview images",
    valueProp:
      "Every shared link gets a branded preview image — generated from your logo and colours, or uploaded per page.",
  },
  {
    id: "redirects",
    title: "Redirects manager",
    valueProp:
      "301 an old URL to its replacement without a deploy, so a renamed page keeps the ranking it earned.",
  },
  {
    id: "indexing",
    title: "Indexing controls",
    valueProp:
      "Per-page noindex and canonical overrides, for the pages you do not want competing with each other in search.",
  },
  {
    id: "audit",
    title: "SEO audit",
    valueProp:
      "A scored list of what is missing across your store, each finding linking straight to the editor that fixes it.",
  },
  {
    id: "ai-assist",
    title: "AI SEO assistant",
    valueProp:
      "Automatos AI drafts titles and descriptions from your own product and post content — you review before anything saves.",
  },
  {
    id: "verification",
    title: "Site verification & analytics tags",
    valueProp:
      "Google Search Console and GA4 verification without editing a template or waiting on support.",
  },
] as const;
