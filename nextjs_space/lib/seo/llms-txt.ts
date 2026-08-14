/**
 * LLM Visibility US-003 — the store's llms.txt: one markdown document that
 * states what this business is, where it is, and what it publishes.
 *
 * WHAT THIS IS WORTH, STATED HONESTLY (it is an acceptance criterion, not a
 * disclaimer): llms.txt is a PROPOSED standard. No major AI company has
 * committed to reading it, adoption sits around 10% of sites, and the largest
 * study of it to date — SE Ranking, 300,000 domains — found no measurable
 * change in AI citations for the sites that published one. Nothing in this
 * module, and nothing in the UI that advertises it, may claim otherwise. It
 * ships because it is free: the content is the catalogue the owner already
 * maintains, it needs no upkeep, and it is correct the moment the standard is
 * adopted. That is the whole case.
 *
 * THE EXHAUSTIVE LIST IS THE SITEMAP. This file renders a BUDGET of rows
 * ({@link LLMS_TXT_MAX_PRODUCTS}, {@link LLMS_TXT_MAX_POSTS}) so a store with
 * thousands of products publishes a document a model can actually read. Every
 * section therefore opens with its index URL, the identity block names the
 * sitemap, and a truncated section says so in the file — a silently shortened
 * inventory reads as a complete one.
 *
 * EXCLUSIONS ARE HONOURED, BOTH KINDS. An entity the owner kept out of the
 * sitemap (`sitemapExclude`) or told crawlers not to index (`robots.noindex`)
 * is left out here too. The sitemap deliberately honours only the first of
 * those — the two controls are independent, and US-023's audit exists to report
 * the disagreement — but a document whose entire purpose is "here is my store,
 * please read it" cannot list a URL the owner asked not to have read. Both
 * resolve through the plan, so the rules go dormant on Basic exactly as they do
 * everywhere else.
 *
 * Pure and total: no prisma, no next, no env. Everything arrives as `unknown`
 * because the rows come through the any-widened `prisma` export (lib/db.ts).
 */

import { storeCanonical } from "@/lib/seo/canonical";
import { CONDITIONS_INDEX_PATH, conditionPath } from "@/lib/seo/condition-paths";
import {
  indexingControlsUnlocked,
  isEntityNoindexed,
  isSitemapExcluded,
} from "@/lib/seo/indexing";
import { buildPostalAddress, type StoreAddressSource } from "@/lib/seo/json-ld";
import { PRODUCTS_INDEX_PATH, productPath } from "@/lib/seo/product-paths";
import {
  seoText,
  storeDisplayName,
  truncateSeoText,
} from "@/lib/seo/store-identity";
import { readEntitySeo } from "@/lib/seo/entity-seo";
import { LLMS_TXT_PATH } from "@/lib/seo/llms-txt-copy";
import { WIRE_INDEX_PATH, wirePostPath } from "@/lib/seo/wire-paths";
import type { TenantUrlData } from "@/lib/tenant/tenant-utils";

// The published path lives in the dependency-free copy module (the SEO Manager
// card needs it in a browser bundle); re-exported here so a caller building the
// document and a caller linking to it reach one constant.
export { LLMS_TXT_PATH };

/**
 * How many rows each unbounded section renders.
 *
 * A budget, not a limit on what the store publishes: the sitemap carries every
 * URL, both indexes are linked from here, and a section that hits its budget
 * says so. The numbers are chosen so the whole document stays inside the
 * context a model will spend on one file.
 */
export const LLMS_TXT_MAX_PRODUCTS = 100;
export const LLMS_TXT_MAX_POSTS = 50;

/** How much of a row's body copy one line carries. */
const LLMS_TXT_SUMMARY_MAX_LENGTH = 200;

/**
 * The store description, when the owner has authored none anywhere. Mirrors the
 * sentence the homepage's own `<meta name="description">` falls back to
 * (app/store/[slug]/page.tsx), so the file and the page agree.
 */
export function defaultLlmsTxtSummary(businessName: string): string {
  return `Premium medical cannabis products and consultations from ${businessName}`;
}

/** Rows as they arrive from prisma — `unknown` fields, `any`-widened client. */
export interface LlmsTxtProductRow {
  /** What the storefront product route is keyed by (US-004). */
  readonly drGreenStrainId: unknown;
  readonly name: unknown;
  readonly description: unknown;
  readonly seo?: unknown;
}

export interface LlmsTxtPostRow {
  readonly slug: unknown;
  readonly title: unknown;
  readonly excerpt: unknown;
  readonly seo?: unknown;
}

export interface LlmsTxtConditionRow {
  readonly slug: unknown;
  readonly name: unknown;
  readonly description: unknown;
  readonly seo?: unknown;
}

export interface LlmsTxtSource {
  readonly tenant: TenantUrlData;
  /** `tenants.id` — the plan gate's subject for the exclusion rules. */
  readonly tenantId?: string;
  /** Raw `tenants.plan`; fail-closed to Basic, which excludes nothing. */
  readonly plan?: unknown;
  readonly businessName: unknown;
  /** The `tenants` address columns, exactly as the row carries them. */
  readonly address: StoreAddressSource;
  /**
   * What the store says it is: the authored homepage description, else the
   * tagline, else {@link defaultLlmsTxtSummary}. Resolved by the caller, which
   * is the side holding `pageSeo` and the parsed settings blob.
   */
  readonly summary: unknown;
  /** This tenant's published condition guides. */
  readonly conditions: readonly LlmsTxtConditionRow[];
  /** Live (not soft-deleted) products, in the owner's own display order. */
  readonly products: readonly LlmsTxtProductRow[];
  /** Published Wire posts, most recent first. */
  readonly posts: readonly LlmsTxtPostRow[];
}

/**
 * Markdown link TEXT, safe to sit between `[` and `]`.
 *
 * A product called `Blue Dream [Reserve]` would otherwise close the link early
 * and render the rest as literal text, and a name arriving with newlines (body
 * copy pasted into a title field) would break the list item in two. Both are
 * owner-typed values, so neither is hypothetical.
 */
export function escapeMarkdownText(value: unknown): string {
  return seoText(value)
    .replace(/\s+/g, " ")
    .replace(/([\\[\]])/g, "\\$1");
}

/**
 * A URL safe to sit between `(` and `)`.
 *
 * `storeCanonical` percent-encodes what `new URL` percent-encodes, and
 * parentheses are not on that list — an owner-typed slug containing one would
 * terminate the link at the wrong place. Encoding them here resolves to the
 * identical URL while leaving the markdown unambiguous.
 */
export function escapeMarkdownUrl(url: string): string {
  return url.replace(/\(/g, "%28").replace(/\)/g, "%29");
}

/** One `- [text](url): summary` line; the summary is omitted when there is none. */
function linkLine(text: string, url: string, summary: string): string {
  const link = `- [${escapeMarkdownText(text)}](${escapeMarkdownUrl(url)})`;
  return summary ? `${link}: ${escapeMarkdownText(summary)}` : link;
}

/**
 * What a row says about itself: the authored SEO description when there is one,
 * else its own body copy, truncated.
 *
 * The same precedence `lib/seo/product-metadata.ts` and
 * `lib/seo/condition-metadata.ts` apply to `<meta name="description">`, so the
 * sentence a model reads here is the sentence the page itself publishes.
 */
function rowSummary(seo: unknown, body: unknown): string {
  return (
    seoText(readEntitySeo(seo).description) ||
    truncateSeoText(body, LLMS_TXT_SUMMARY_MAX_LENGTH)
  );
}

/**
 * Is this entity one the owner asked not to be listed or not to be indexed?
 *
 * Exported for US-004's audit, which reports a store whose llms.txt has nothing
 * left to list. It asks the same question this renderer asks, so it calls this
 * rather than restating the rule — a second copy could disagree with the file
 * the store actually publishes, and then the finding would be about a document
 * that does not exist.
 */
export function isLlmsTxtExcluded(seo: unknown, proUnlocked: boolean): boolean {
  return (
    isSitemapExcluded(seo, proUnlocked) || isEntityNoindexed(seo, proUnlocked)
  );
}

interface LlmsTxtEntity {
  readonly key: unknown;
  readonly name: unknown;
  readonly body: unknown;
  readonly seo?: unknown;
}

interface LlmsTxtSection {
  readonly heading: string;
  /** The index page every row in this section lives under. */
  readonly indexPath: string;
  readonly indexLabel: string;
  readonly indexSummary: string;
  readonly rows: readonly LlmsTxtEntity[];
  readonly toPath: (key: string) => string;
  /** Rows rendered at most; undefined renders every publishable row. */
  readonly budget?: number;
}

function renderSection(
  tenant: TenantUrlData,
  section: LlmsTxtSection,
  proUnlocked: boolean,
): string[] {
  const indexUrl = storeCanonical(tenant, section.indexPath);

  const publishable = section.rows.filter((row) => {
    // A blank key would make the path helper fall back to its index, aliasing
    // the row onto a URL this section already lists.
    if (!seoText(row.key)) return false;
    return !isLlmsTxtExcluded(row.seo, proUnlocked);
  });

  const budget = section.budget ?? publishable.length;
  const shown = publishable.slice(0, budget);
  const dropped = publishable.length - shown.length;

  return [
    `## ${section.heading}`,
    "",
    linkLine(section.indexLabel, indexUrl, section.indexSummary),
    ...shown.map((row) =>
      linkLine(
        seoText(row.name),
        storeCanonical(tenant, section.toPath(seoText(row.key))),
        rowSummary(row.seo, row.body),
      ),
    ),
    // Never a silent truncation: a model reading this file must be able to tell
    // a complete list from a budgeted one, and where the rest of it lives.
    ...(dropped > 0
      ? [
          "",
          `${shown.length} of ${publishable.length} listed above. The complete list is at ${escapeMarkdownUrl(indexUrl)}.`,
        ]
      : []),
    "",
  ];
}

/**
 * The store's postal address on one line, or "" when the tenant has not filled
 * in enough of one.
 *
 * The completeness rule is `buildPostalAddress`'s, not a second copy of it: the
 * floor is street + locality + country, and below it the JSON-LD emits no
 * LocalBusiness — so this file must not assert an address the structured data
 * refuses to state either.
 */
export function llmsTxtAddressLine(source: StoreAddressSource): string {
  const address = buildPostalAddress(source);
  if (!address) return "";

  return [
    seoText(address.streetAddress),
    seoText(address.addressLocality),
    seoText(address.addressRegion),
    seoText(address.postalCode),
    seoText(address.addressCountry),
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * The complete llms.txt body for a store, trailing newline included.
 *
 * Shaped to llmstxt.org: an H1 naming the entity, a blockquote summarising it,
 * a details list, then H2 sections of markdown links. A consumer that only
 * understands the H1 and the link lists still gets every URL.
 */
export function renderStoreLlmsTxt(source: LlmsTxtSource): string {
  const { tenant } = source;

  const name =
    storeDisplayName(source.businessName, tenant.subdomain) || tenant.subdomain;
  const storeUrl = storeCanonical(tenant, "");
  const summary = seoText(source.summary) || defaultLlmsTxtSummary(name);

  // Resolved ONCE for the whole document: the plan cannot change between two
  // rows of one render (the sitemap makes the same call for the same reason).
  const proUnlocked = indexingControlsUnlocked({
    tenantId: source.tenantId,
    plan: source.plan,
  });

  const address = llmsTxtAddressLine(source.address);

  const lines = [
    `# ${escapeMarkdownText(name)}`,
    "",
    `> ${escapeMarkdownText(summary)}`,
    "",
    `- Store: ${escapeMarkdownUrl(storeUrl)}`,
    ...(address ? [`- Address: ${escapeMarkdownText(address)}`] : []),
    // The exhaustive URL list, named here because the sections below are
    // budgeted and this one is not.
    `- Sitemap: ${escapeMarkdownUrl(storeCanonical(tenant, "/sitemap.xml"))}`,
    "",
    ...renderSection(
      tenant,
      {
        heading: "Conditions",
        indexPath: CONDITIONS_INDEX_PATH,
        indexLabel: "All conditions",
        indexSummary: "Every condition guide this store publishes.",
        rows: source.conditions.map((row) => ({
          key: row.slug,
          name: row.name,
          body: row.description,
          seo: row.seo,
        })),
        toPath: conditionPath,
      },
      proUnlocked,
    ),
    ...renderSection(
      tenant,
      {
        heading: "Products",
        indexPath: PRODUCTS_INDEX_PATH,
        indexLabel: "All products",
        indexSummary: "The full catalogue, with live prices and availability.",
        rows: source.products.map((row) => ({
          key: row.drGreenStrainId,
          name: row.name,
          body: row.description,
          seo: row.seo,
        })),
        toPath: productPath,
        budget: LLMS_TXT_MAX_PRODUCTS,
      },
      proUnlocked,
    ),
    ...renderSection(
      tenant,
      {
        heading: "The Wire",
        indexPath: WIRE_INDEX_PATH,
        indexLabel: "The Wire",
        indexSummary: "Articles and updates published by this store.",
        rows: source.posts.map((row) => ({
          key: row.slug,
          name: row.title,
          body: row.excerpt,
          seo: row.seo,
        })),
        toPath: wirePostPath,
        budget: LLMS_TXT_MAX_POSTS,
      },
      proUnlocked,
    ),
  ];

  return `${lines.join("\n").trimEnd()}\n`;
}
