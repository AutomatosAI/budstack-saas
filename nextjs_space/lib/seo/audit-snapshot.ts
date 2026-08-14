/**
 * SEO Supercharge US-023 — the audit's SNAPSHOT: the rows it is given, and the
 * one flat list of auditable things it turns them into.
 *
 * SPLIT FROM `audit-checks.ts` so each file answers one question — this one is
 * "what did we look at", that one is "what do we think of it". The split is also
 * what keeps either under a size worth reading.
 *
 * NORMALISING THE FOUR ENTITY TYPES INTO ONE SHAPE is the load-bearing idea.
 * Products, posts, conditions and the static pages all carry the same authored
 * record and all have the same things wrong with them, so `collectAuditEntities`
 * flattens them into {@link SeoAuditEntity} and every field check becomes one
 * loop instead of four near-identical ones. Adding a fifth entity type later
 * means writing a collector here, not another check there.
 *
 * THE SITEMAP IS BUILT BY THE REAL BUILDER. `buildAuditSitemap` calls
 * `buildStoreSitemapEntries` — the same function `app/store/[slug]/sitemap.xml`
 * renders from, fed the same filters — so the checks compare its output against
 * what the path helpers say each entity's URL should be. A re-derivation would
 * only ever agree with itself; this catches the exact defect US-006 closed (the
 * sitemap advertising `/products/{slug}` where the storefront serves
 * `/products/{drGreenStrainId}`) if it ever comes back.
 *
 * Rows arrive as `unknown` fields for the reason `sitemap.ts` states: they come
 * through the any-widened `prisma` export in lib/db.ts, so the runtime type is
 * genuinely unknown whatever a signature claims. Everything is read through
 * `seoText` / `readEntitySeo`, which fail closed. No I/O anywhere.
 */

import { storeCanonical } from "@/lib/seo/canonical";
import { conditionPath } from "@/lib/seo/condition-paths";
import { readEntitySeo, type EntitySeo } from "@/lib/seo/entity-seo";
import { readFaqEntries } from "@/lib/seo/faq-json-ld";
import {
  readHeadingStructure,
  type HeadingStructure,
} from "@/lib/seo/heading-structure";
import { indexingControlsUnlocked } from "@/lib/seo/indexing";
import { isLlmsTxtExcluded } from "@/lib/seo/llms-txt";
import { productPath } from "@/lib/seo/product-paths";
import { readProductQa } from "@/lib/seo/product-qa";
import {
  buildStoreSitemapEntries,
  type SitemapEntry,
} from "@/lib/seo/sitemap";
import { seoText } from "@/lib/seo/store-identity";
import { readStorePageSeo, STORE_SEO_PAGES } from "@/lib/seo/store-pages";
import { wirePostPath } from "@/lib/seo/wire-paths";
import type { TenantUrlData } from "@/lib/tenant/tenant-utils";
import type { SeoAuditTab } from "@/lib/seo/audit-types";

/** Rows as prisma hands them over — see the module docstring on `unknown`. */
export interface SeoAuditProductRow {
  readonly id: unknown;
  readonly name: unknown;
  readonly drGreenStrainId: unknown;
  readonly images: unknown;
  readonly seo: unknown;
  readonly updatedAt: unknown;
}

/** Only what the deleted-leak check needs — never rendered to the owner. */
export interface SeoAuditDeletedProductRow {
  readonly drGreenStrainId: unknown;
  readonly name: unknown;
}

export interface SeoAuditPostRow {
  readonly id: unknown;
  readonly title: unknown;
  readonly slug: unknown;
  readonly excerpt: unknown;
  readonly coverImage: unknown;
  readonly seo: unknown;
  readonly updatedAt: unknown;
  /**
   * US-004 — the authored HTML body, read for its heading skeleton only. The
   * one large column the audit selects: a post body is the only authored HTML
   * a store publishes (`conditions` carry no rich-text field, and their page's
   * headings are the template's). Posts are the smallest of the four tables, so
   * the row ceiling this costs against is the one with room to spare.
   */
  readonly content?: unknown;
}

export interface SeoAuditConditionRow {
  readonly id: unknown;
  readonly name: unknown;
  readonly slug: unknown;
  readonly description: unknown;
  readonly image: unknown;
  readonly seo: unknown;
  readonly updatedAt: unknown;
  /** US-004 — the seeded question/answer pairs this guide publishes. */
  readonly faqs?: unknown;
}

export interface SeoAuditRedirectRow {
  readonly id: unknown;
  readonly fromPath: unknown;
  readonly toPath: unknown;
}

export interface SeoAuditInput {
  /** For `storeCanonical` — the store's primary host. */
  readonly tenant: TenantUrlData;
  /** `tenants.id`, the sitemap builder's plan-gate subject. */
  readonly tenantId: string;
  /** Raw `tenants.plan`. Pro here by construction (the route is gated). */
  readonly plan: unknown;
  readonly pageSeo: unknown;
  /** LIVE products only — soft-deleted rows travel separately. */
  readonly products: readonly SeoAuditProductRow[];
  readonly deletedProducts: readonly SeoAuditDeletedProductRow[];
  /** Published posts only: a draft has no page, so it has no SEO to audit. */
  readonly posts: readonly SeoAuditPostRow[];
  /** Published conditions belonging to this tenant. */
  readonly conditions: readonly SeoAuditConditionRow[];
  readonly redirects: readonly SeoAuditRedirectRow[];
  /**
   * US-004 — raw `tenants.settings.aiCrawlerPolicy`. Parsed by the check, which
   * fails OPEN: a value we cannot read must never be reported as "this store is
   * blocking AI search", because that is the finding an owner acts on.
   */
  readonly aiCrawlerPolicy?: unknown;
  /** US-004 — raw `tenants.wireMode` (`MANUAL` | `ASSISTED`). */
  readonly wireMode?: unknown;
  /**
   * US-004 — how many of this store's Wire posts are unpublished. A COUNT, not
   * rows: the finding is one sentence about the list, and the fix is the list.
   */
  readonly unpublishedPostCount?: number;
}

/**
 * One auditable thing, whatever table it came from.
 *
 * Normalising the four entity types into this shape is what lets the field
 * checks be one loop instead of four near-identical ones — and it is why adding
 * a fifth entity type later means writing a collector, not another check.
 */
export interface SeoAuditEntity {
  readonly tab: SeoAuditTab;
  readonly entityId: string;
  readonly label: string;
  /** "product", "post", "condition", "page" — for the finding's sentence. */
  readonly noun: string;
  readonly seo: EntitySeo;
  /** What renders as the title when none is authored. Never empty. */
  readonly titleFallback: string;
  /** What renders as the description when none is authored; "" for nothing. */
  readonly descriptionFallback: string;
  /** Does this entity carry an image of its own (cover photo, strain shot)? */
  readonly hasOwnImage: boolean;
  /**
   * Should it? False for static pages, which have no image by construction —
   * the US-018 branded card IS the designed answer for them, and flagging all
   * five on every store would be pure noise.
   */
  readonly expectsOwnImage: boolean;
  /** Store-relative path, or null when this entity has no storefront page. */
  readonly path: string | null;
  /** Is that path in the sitemap the store publishes right now? */
  readonly inSitemap: boolean;
  /**
   * US-004 — how many question/answer pairs this entity PUBLISHES in a
   * machine-readable form: `products.seo.qa` for a product (US-002),
   * `conditions.faqs` for a guide (US-017). Both are read through the same
   * parsers the `FAQPage` builders use, so the audit counts what the page
   * actually emits rather than what is stored.
   */
  readonly qaPairs: number;
  /** Is Q&A a thing this entity type can carry at all? Posts and pages cannot. */
  readonly expectsQa: boolean;
  /**
   * US-004 — the heading skeleton of the entity's authored HTML body, or null
   * when it has none. Only a Wire post has one; a condition page's headings are
   * rendered by the template, correctly nested, and are not the owner's to get
   * wrong.
   */
  readonly headings: HeadingStructure | null;
  /**
   * US-004 — would this entity's URL appear in the store's llms.txt? False for
   * the static pages, which the document does not list, and for anything the
   * owner excluded.
   */
  readonly inLlmsTxt: boolean;
}

export interface AuditSitemap {
  readonly entries: readonly SitemapEntry[];
  readonly locs: ReadonlySet<string>;
}
/** An id that produces the URL the storefront actually serves. */
const PLAUSIBLE_URL_KEY = /^[A-Za-z0-9._~-]+$/;

/**
 * The sitemap this store publishes right now, built by the route's own builder
 * from the route's own filters.
 *
 * `plan` and `pageSeo` ride along because US-022's `sitemapExclude` is honoured
 * for a Pro tenant — an owner who deliberately hid a page must not see the audit
 * report it as missing.
 */
export function buildAuditSitemap(input: SeoAuditInput): AuditSitemap {
  const entries = buildStoreSitemapEntries({
    tenant: input.tenant,
    tenantId: input.tenantId,
    plan: input.plan,
    pageSeo: input.pageSeo,
    products: input.products.map((row) => ({
      drGreenStrainId: row.drGreenStrainId,
      updatedAt: row.updatedAt,
      seo: row.seo,
    })),
    posts: input.posts.map((row) => ({
      slug: row.slug,
      updatedAt: row.updatedAt,
      seo: row.seo,
    })),
    conditions: input.conditions.map((row) => ({
      slug: row.slug,
      updatedAt: row.updatedAt,
      seo: row.seo,
    })),
  });

  return { entries, locs: new Set(entries.map((entry) => entry.loc)) };
}

/** Is this entity's own URL among the ones the sitemap advertises? */
function inSitemap(
  tenant: TenantUrlData,
  locs: ReadonlySet<string>,
  path: string | null,
): boolean {
  return path === null ? false : locs.has(storeCanonical(tenant, path));
}

/** The four tables plus the static pages, flattened into one auditable list. */
export function collectAuditEntities(
  input: SeoAuditInput,
  locs: ReadonlySet<string>,
): SeoAuditEntity[] {
  const { tenant } = input;

  // Resolved ONCE for the whole snapshot, exactly as the sitemap and llms.txt
  // renderers resolve it per document: the plan cannot change between two rows
  // of one audit, and the exclusion rules go dormant on Basic.
  const proUnlocked = indexingControlsUnlocked({
    tenantId: input.tenantId,
    plan: input.plan,
  });

  /** Would llms.txt list this row? Same predicate the document itself filters
   * on, imported rather than restated — a second copy could disagree with the
   * file the store publishes. */
  const listedInLlmsTxt = (path: string | null, seo: unknown): boolean =>
    path !== null && !isLlmsTxtExcluded(seo, proUnlocked);

  const pages: SeoAuditEntity[] = STORE_SEO_PAGES.map((page) => ({
    tab: "pages" as const,
    entityId: page.key,
    label: page.name,
    noun: "page",
    seo: readStorePageSeo(input.pageSeo, page.key),
    titleFallback: "the built-in page title",
    descriptionFallback: "the built-in page description",
    hasOwnImage: false,
    expectsOwnImage: false,
    path: page.path,
    inSitemap: inSitemap(tenant, locs, page.path),
    qaPairs: 0,
    expectsQa: false,
    headings: null,
    // The document lists conditions, products and posts; the static pages reach
    // a model through the sitemap it names, not through a line of their own.
    inLlmsTxt: false,
  }));

  const products: SeoAuditEntity[] = input.products.flatMap((row) => {
    const entityId = seoText(row.id);
    if (!entityId) return [];
    const strainId = seoText(row.drGreenStrainId);
    // A row that was never synced has no page at all — `productPath` would fall
    // back to the listing, which is a URL this product does not own.
    const path =
      strainId && PLAUSIBLE_URL_KEY.test(strainId) ? productPath(strainId) : null;
    return [
      {
        tab: "products" as const,
        entityId,
        label: seoText(row.name) || "Untitled product",
        noun: "product",
        seo: readEntitySeo(row.seo),
        titleFallback: "the strain name from Dr Green",
        // Unknown from here: the storefront description comes from the LIVE
        // strain, not this row. Stated as present rather than absent so the
        // finding never claims a page has no description when it may.
        descriptionFallback: "the strain description from Dr Green",
        hasOwnImage: Array.isArray(row.images)
          ? row.images.some((image) => seoText(image))
          : false,
        expectsOwnImage: true,
        path,
        inSitemap: inSitemap(tenant, locs, path),
        // `readEntitySeo` has already dropped every malformed pair, so this is
        // the count the page's accordion and its `FAQPage` node both render.
        qaPairs: readProductQa(readEntitySeo(row.seo).qa).length,
        expectsQa: true,
        headings: null,
        inLlmsTxt: listedInLlmsTxt(path, row.seo),
      },
    ];
  });

  const posts: SeoAuditEntity[] = input.posts.flatMap((row) => {
    const entityId = seoText(row.id);
    const slug = seoText(row.slug);
    if (!entityId) return [];
    return [
      {
        tab: "posts" as const,
        entityId,
        label: seoText(row.title) || slug || "Untitled post",
        noun: "post",
        seo: readEntitySeo(row.seo),
        titleFallback: "the post title",
        descriptionFallback: seoText(row.excerpt) ? "the post excerpt" : "",
        hasOwnImage: !!seoText(row.coverImage),
        expectsOwnImage: true,
        path: slug ? wirePostPath(slug) : null,
        inSitemap: inSitemap(tenant, locs, slug ? wirePostPath(slug) : null),
        // No Q&A field: the product editor is the only one that offers it, and
        // an article answers its questions in its prose.
        qaPairs: 0,
        expectsQa: false,
        headings: readHeadingStructure(row.content),
        inLlmsTxt: listedInLlmsTxt(slug ? wirePostPath(slug) : null, row.seo),
      },
    ];
  });

  const conditions: SeoAuditEntity[] = input.conditions.flatMap((row) => {
    const entityId = seoText(row.id);
    const slug = seoText(row.slug);
    if (!entityId) return [];
    const path = slug ? conditionPath(slug) : null;
    return [
      {
        tab: "conditions" as const,
        entityId,
        label: seoText(row.name) || slug || "Untitled condition",
        noun: "condition page",
        seo: readEntitySeo(row.seo),
        titleFallback: "the condition name",
        descriptionFallback: seoText(row.description)
          ? "the condition summary"
          : "",
        hasOwnImage: !!seoText(row.image),
        expectsOwnImage: true,
        path,
        inSitemap: inSitemap(tenant, locs, path),
        // The seeded pairs, read through the same parser US-017's `FAQPage`
        // node is built from, so the count is what the page publishes.
        qaPairs: readFaqEntries(row.faqs).length,
        expectsQa: true,
        // A condition page has no authored HTML body — `description` is a
        // one-line intro and every heading on the page is the template's.
        headings: null,
        inLlmsTxt: listedInLlmsTxt(path, row.seo),
      },
    ];
  });

  return [...pages, ...products, ...posts, ...conditions];
}
