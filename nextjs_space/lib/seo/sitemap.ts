/**
 * SEO Supercharge US-006 — which URLs a store publishes, and how that list is
 * serialised.
 *
 * THE DEFECT THIS CLOSES: every product URL in the tenant sitemap was a 404.
 * The route emitted `{baseUrl}/products/{products.slug}`
 * (app/store/[slug]/sitemap.xml/route.ts:49) and no such route exists — a
 * storefront product page is keyed by the DR GREEN STRAIN ID (US-004, see
 * `lib/seo/product-paths.ts`). Alongside that: soft-deleted products were
 * advertised (`products` carries `deletedAt`, prisma/schema.prisma:676, and the
 * query named no filter), condition detail pages were absent entirely, and
 * `/faq` was listed although app/store/[slug]/faq/page.tsx has been a
 * `redirect()` to /support since US-002 retired the key.
 *
 * The URL builders are the SAME ones the pages use for their canonicals —
 * `storeCanonical` over `productPath` / `wirePostPath` / `conditionPath` — so a
 * sitemap entry and the canonical of the page it points at cannot disagree
 * again. The static list is derived from `STORE_SEO_PAGES`, which makes
 * `AUTHORABLE_PAGE_WEIGHTS` a compile error the day a page is added there.
 *
 * US-022 added the one exception to "every URL a store has": an entity whose
 * authored record carries `sitemapExclude`, for a tenant on Pro, is left out.
 *
 * Pure and total: no prisma, no next, no env. Everything arrives as `unknown`
 * because the rows come through the any-widened `prisma` export (lib/db.ts).
 */

import { storeCanonical } from "@/lib/seo/canonical";
import { conditionPath } from "@/lib/seo/condition-paths";
import {
  indexingControlsUnlocked,
  isSitemapExcluded,
} from "@/lib/seo/indexing";
import { WIRE_INDEX_PATH, wirePostPath } from "@/lib/seo/post-metadata";
import { PRODUCTS_INDEX_PATH, productPath } from "@/lib/seo/product-paths";
import { seoText } from "@/lib/seo/store-identity";
import {
  readStorePageSeo,
  STORE_SEO_PAGES,
  type StoreSeoPageKey,
} from "@/lib/seo/store-pages";
import type { TenantUrlData } from "@/lib/tenant/tenant-utils";

export interface SitemapEntry {
  readonly loc: string;
  /** W3C date (YYYY-MM-DD); omitted when the row carries no usable timestamp. */
  readonly lastmod?: string;
  readonly changefreq?: string;
  readonly priority?: string;
}

interface SitemapWeight {
  readonly priority: string;
  readonly changefreq: string;
}

export interface SitemapStaticPage extends SitemapWeight {
  /** Store-relative path, "" for the homepage. */
  readonly path: string;
  /**
   * The `tenants.pageSeo` key this page is authored under, when it has one.
   * Absent for /products and /the-wire, which carry no authored record — and so
   * can never be excluded from the sitemap (US-022).
   */
  readonly pageKey?: StoreSeoPageKey;
}

/**
 * How often each authorable page changes, and what it is worth relative to the
 * homepage. Typed against `StoreSeoPageKey` rather than `string`, so adding a
 * page to `STORE_SEO_PAGES` fails the build here instead of silently shipping a
 * page the sitemap never mentions.
 *
 * The numbers are the ones the route already published; `support` inherits the
 * weight `faq` carried, since /faq redirects to it.
 */
const AUTHORABLE_PAGE_WEIGHTS: Readonly<Record<StoreSeoPageKey, SitemapWeight>> =
  {
    home: { priority: "1.0", changefreq: "daily" },
    about: { priority: "0.8", changefreq: "monthly" },
    contact: { priority: "0.8", changefreq: "monthly" },
    support: { priority: "0.6", changefreq: "monthly" },
    conditions: { priority: "0.7", changefreq: "monthly" },
  };

/**
 * Every store-relative path that exists for all tenants: the authorable pages
 * plus the two index pages that carry no owner-authored metadata of their own.
 */
export const STORE_SITEMAP_STATIC_PAGES: readonly SitemapStaticPage[] = [
  ...STORE_SEO_PAGES.map((page) => ({
    path: page.path,
    pageKey: page.key,
    ...AUTHORABLE_PAGE_WEIGHTS[page.key],
  })),
  { path: PRODUCTS_INDEX_PATH, priority: "0.9", changefreq: "daily" },
  { path: WIRE_INDEX_PATH, priority: "0.7", changefreq: "weekly" },
];

const XML_ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/**
 * The sitemap protocol requires entity-escaped URLs. `storeCanonical`
 * percent-encodes what `new URL` percent-encodes, and `&` is not on that list —
 * a Dr Green strain id or an owner-typed slug containing one produced a
 * document no parser would accept, taking the WHOLE sitemap down rather than
 * one entry.
 */
export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);
}

/**
 * `<lastmod>` for a row's `updatedAt`, or undefined when there is nothing
 * usable. Accepts `unknown` deliberately: the value reaches here as a Date from
 * prisma, but as an ISO string through any JSON hop, and an invalid Date
 * stringifies to "Invalid Date" rather than throwing — which would have put a
 * literal "Invalid Date" inside a `<lastmod>` tag.
 */
export function sitemapLastmod(value: unknown): string | undefined {
  const date =
    value instanceof Date
      ? value
      : typeof value === "string" || typeof value === "number"
        ? new Date(value)
        : null;
  if (!date || Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

/** Rows as they arrive from prisma — `unknown` fields, `any`-widened client. */
export interface StoreSitemapProductRow {
  readonly drGreenStrainId: unknown;
  readonly updatedAt: unknown;
  /** Raw `products.seo` Json — read for US-022's `sitemapExclude` only. */
  readonly seo?: unknown;
}

export interface StoreSitemapSlugRow {
  readonly slug: unknown;
  readonly updatedAt: unknown;
  /** Raw `posts.seo` / `conditions.seo` Json — US-022's `sitemapExclude`. */
  readonly seo?: unknown;
}

export interface StoreSitemapInput {
  readonly tenant: TenantUrlData;
  /** Live (not soft-deleted) products; rows with no strain id have no page. */
  readonly products: readonly StoreSitemapProductRow[];
  /** Published posts only. */
  readonly posts: readonly StoreSitemapSlugRow[];
  /** Published conditions belonging to this tenant. */
  readonly conditions: readonly StoreSitemapSlugRow[];
  /** `tenants.id` — US-022's plan gate subject. */
  readonly tenantId?: string;
  /** Raw `tenants.plan`; fail-closed to Basic, which excludes nothing. */
  readonly plan?: unknown;
  /** Raw `tenants.pageSeo` — where a static page's `sitemapExclude` lives. */
  readonly pageSeo?: unknown;
}

function entriesFor(
  tenant: TenantUrlData,
  rows: readonly {
    readonly key: unknown;
    readonly updatedAt: unknown;
    readonly seo?: unknown;
  }[],
  toPath: (key: string) => string,
  weight: SitemapWeight,
  proUnlocked: boolean,
): SitemapEntry[] {
  return rows.flatMap((row) => {
    // A blank key would make `productPath` / `wirePostPath` / `conditionPath`
    // fall back to their index, duplicating an entry the static list already
    // carries. Such a row has no page of its own — it is dropped, not aliased.
    const key = seoText(row.key);
    if (!key) return [];
    // US-022 — the owner asked for this URL not to be advertised. Pro only: a
    // Basic tenant's stored flag is dormant, never a silently shrinking sitemap.
    if (isSitemapExcluded(row.seo, proUnlocked)) return [];
    return [
      {
        loc: storeCanonical(tenant, toPath(key)),
        lastmod: sitemapLastmod(row.updatedAt),
        changefreq: weight.changefreq,
        priority: weight.priority,
      },
    ];
  });
}

/**
 * Every URL a store publishes, in crawl order: static pages, then products,
 * posts and conditions.
 */
export function buildStoreSitemapEntries(
  input: StoreSitemapInput,
): SitemapEntry[] {
  const { tenant, products, posts, conditions } = input;

  // US-022 — resolved ONCE for the whole document: the plan cannot change
  // between two rows of one render, and the per-entity flag is the only thing
  // that varies.
  const proUnlocked = indexingControlsUnlocked({
    tenantId: input.tenantId,
    plan: input.plan,
  });

  return [
    ...STORE_SITEMAP_STATIC_PAGES.flatMap((page) => {
      const seo = page.pageKey
        ? readStorePageSeo(input.pageSeo, page.pageKey)
        : undefined;
      if (isSitemapExcluded(seo, proUnlocked)) return [];
      return [
        {
          loc: storeCanonical(tenant, page.path),
          changefreq: page.changefreq,
          priority: page.priority,
        },
      ];
    }),
    ...entriesFor(
      tenant,
      products.map((row) => ({
        key: row.drGreenStrainId,
        updatedAt: row.updatedAt,
        seo: row.seo,
      })),
      productPath,
      { priority: "0.8", changefreq: "weekly" },
      proUnlocked,
    ),
    ...entriesFor(
      tenant,
      posts.map((row) => ({
        key: row.slug,
        updatedAt: row.updatedAt,
        seo: row.seo,
      })),
      wirePostPath,
      { priority: "0.6", changefreq: "weekly" },
      proUnlocked,
    ),
    ...entriesFor(
      tenant,
      conditions.map((row) => ({
        key: row.slug,
        updatedAt: row.updatedAt,
        seo: row.seo,
      })),
      conditionPath,
      { priority: "0.6", changefreq: "monthly" },
      proUnlocked,
    ),
  ];
}

function renderEntry(entry: SitemapEntry): string {
  const lines = [
    "  <url>",
    `    <loc>${escapeXml(entry.loc)}</loc>`,
    ...(entry.lastmod ? [`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`] : []),
    ...(entry.changefreq
      ? [`    <changefreq>${escapeXml(entry.changefreq)}</changefreq>`]
      : []),
    ...(entry.priority
      ? [`    <priority>${escapeXml(entry.priority)}</priority>`]
      : []),
    "  </url>",
  ];
  return lines.join("\n");
}

/** A `<urlset>` document. Valid — and empty-safe — for any entry list. */
export function renderSitemapXml(entries: readonly SitemapEntry[]): string {
  const body = entries.map(renderEntry).join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...(body ? [body] : []),
    "</urlset>",
  ].join("\n");
}
