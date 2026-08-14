/**
 * SEO Supercharge US-016 — BreadcrumbList for the three storefront detail pages.
 *
 * WHAT IT BUYS: the trail a search result shows in place of the raw URL. A
 * product result reading `acme.example › Products › Blue Dream` instead of
 * `https://acme.example/products/6f1c2b18-0f3a-…` is the difference between a
 * link a person can place and a UUID they cannot — and every product URL in
 * this platform is keyed by a Dr Green strain id (product-paths.ts), so these
 * pages have the most to gain from it in the whole store.
 *
 * ONE BUILDER, THREE TRAILS. The section a page sits under is stated here and
 * nowhere else, and each label is READ from the module that owns that section's
 * URL — `WIRE_INDEX_TITLE`, `PRODUCTS_INDEX_TITLE`, `storeSeoPage("conditions")`
 * — so a breadcrumb can never name a section differently from the `<title>` of
 * the page it points at.
 *
 * PRIMARY-HOST URLs. Every `item` goes through `storeCanonical` (US-007), so a
 * tenant on a custom domain publishes ONE trail on the host their canonicals
 * already name, rather than a second copy of it on `{subdomain}.budstacks.io`.
 *
 * ALL OR NOTHING. A `ListItem` without a name is not a smaller breadcrumb, it is
 * an invalid one — so an entity with no usable name emits no breadcrumb at all
 * rather than a trail that stops short of the page it is on.
 *
 * Pro-gated by DEGRADING, like every builder here: a Basic tenant gets an empty
 * array and `<JsonLd>` renders no element. Pure and total — it runs in a render
 * path with no `error.tsx` boundary above it.
 */

import { storeCanonical } from "@/lib/seo/canonical";
import { CONDITIONS_INDEX_PATH, conditionPath } from "@/lib/seo/condition-paths";
import type { JsonLdNode } from "@/lib/seo/json-ld";
import {
  WIRE_INDEX_PATH,
  WIRE_INDEX_TITLE,
  wirePostPath,
} from "@/lib/seo/post-metadata";
import {
  PRODUCTS_INDEX_PATH,
  PRODUCTS_INDEX_TITLE,
  productPath,
} from "@/lib/seo/product-paths";
import { isSeoProUnlocked } from "@/lib/seo/pro-features";
import { seoText } from "@/lib/seo/store-identity";
import { storeSeoPage } from "@/lib/seo/store-pages";

/**
 * The first crumb. Matches the storefront's own navigation label
 * (lib/i18n/locales/en.ts `nav.home`) rather than the SEO Manager's "Homepage",
 * because a breadcrumb is read as a link a visitor could have clicked.
 */
export const BREADCRUMB_HOME_NAME = "Home";

/** One crumb below the store root. `name` is untrusted — it is entity data. */
export interface BreadcrumbTrailItem {
  readonly name: unknown;
  /** Store-relative path, as the path modules build it. */
  readonly path: string;
}

export interface BreadcrumbJsonLdSource {
  /** `tenants.id` — the plan gate's subject. */
  readonly tenantId: string;
  /** Raw `tenants.plan`; parsed fail-closed by the gate. */
  readonly plan: unknown;
  readonly subdomain: string;
  readonly customDomain: string | null;
}

/** Home → The Wire → this article. */
export function wirePostBreadcrumbTrail(
  title: unknown,
  slug: string,
): readonly BreadcrumbTrailItem[] {
  return [
    { name: WIRE_INDEX_TITLE, path: WIRE_INDEX_PATH },
    { name: title, path: wirePostPath(slug) },
  ];
}

/**
 * Home → Products → this strain. Keyed by the Dr Green strain id, which is what
 * the storefront route actually resolves (product-paths.ts).
 */
export function productBreadcrumbTrail(
  name: unknown,
  drGreenStrainId: unknown,
): readonly BreadcrumbTrailItem[] {
  return [
    { name: PRODUCTS_INDEX_TITLE, path: PRODUCTS_INDEX_PATH },
    { name, path: productPath(drGreenStrainId) },
  ];
}

/** Home → Conditions → this condition, keyed by slug (condition-paths.ts). */
export function conditionBreadcrumbTrail(
  name: unknown,
  slug: unknown,
): readonly BreadcrumbTrailItem[] {
  return [
    { name: storeSeoPage("conditions").name, path: CONDITIONS_INDEX_PATH },
    { name, path: conditionPath(slug) },
  ];
}

/**
 * The `BreadcrumbList` node for a page, or an empty array.
 *
 * Empty for three ordinary states: the tenant is not on Pro, the trail is empty,
 * or a crumb carries no usable name (see the all-or-nothing rule above).
 *
 * `position` is 1-based and contiguous — Google reads it as the order, not as a
 * hint — and Home is always position 1, so the trail a caller passes describes
 * only what sits BELOW the store root.
 */
export function buildBreadcrumbJsonLd(
  source: BreadcrumbJsonLdSource,
  trail: readonly BreadcrumbTrailItem[],
): readonly JsonLdNode[] {
  if (!isSeoProUnlocked({ id: source.tenantId, plan: source.plan })) return [];
  if (trail.length === 0) return [];

  const crumbs = [
    { name: BREADCRUMB_HOME_NAME, path: "" },
    ...trail.map((item) => ({ name: seoText(item.name), path: item.path })),
  ];
  if (crumbs.some((crumb) => !crumb.name)) return [];

  const itemListElement = crumbs.map((crumb, index) => ({
    "@type": "ListItem",
    position: index + 1,
    name: crumb.name,
    item: storeCanonical(source, crumb.path),
  }));

  return [
    {
      "@type": "BreadcrumbList",
      // Anchored to the page the trail ENDS on, so the node belongs to this URL
      // rather than colliding with the breadcrumb of every other detail page.
      "@id": `${storeCanonical(source, crumbs[crumbs.length - 1].path)}#breadcrumb`,
      itemListElement,
    },
  ];
}
