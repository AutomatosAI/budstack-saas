import type { SeoAuditStats } from "@/lib/seo/audit-types";

/**
 * Platform US-020 — the sentences {@link SeoAuditTab} writes about whatever it
 * is auditing.
 *
 * The panel is now rendered in two places over two different subjects: a store's
 * SEO Manager and the platform's own SEO page. Everything about it that is the
 * same — the score, the grade bands, the grouped findings, the deep link on each
 * one — stays in the component; the four places it names what it looked at do
 * not survive the move. "Checked 0 products, 0 condition pages and 0 redirects"
 * is what a shared component says about budstacks.io if nobody separates them,
 * and it is both meaningless and, read as a count, false.
 *
 * Copy rather than a `variant` flag: a flag inside the component would put both
 * audiences' wording in one file and grow a branch for every future subject.
 * These are plain data with the tenant set as the default, so the SEO Manager's
 * call site is unchanged.
 */

export interface SeoAuditCopy {
  /** While the first run is in flight. */
  readonly loading: string;
  /** What was examined — rendered under the score. */
  readonly stats: (stats: SeoAuditStats) => string;
  /** Nothing to fix, with the number of checks that passed. */
  readonly clean: (passed: number) => string;
}

/** SEO Supercharge US-023's wording, verbatim — the SEO Manager's default. */
export const TENANT_SEO_AUDIT_COPY: SeoAuditCopy = {
  loading: "Checking every page in your store…",
  stats: (stats) =>
    `Checked ${stats.products} products, ${stats.posts} posts, ${stats.conditions} condition pages, ${stats.pages} store pages and ${stats.redirects} redirects. Your sitemap publishes ${stats.sitemapEntries} URLs.`,
  clean: (passed) =>
    `All ${passed} checks passed. Titles, descriptions, images, your sitemap, your redirects and what the AI crawlers can read are all in order.`,
};

/**
 * Platform US-020's wording.
 *
 * It names ONLY the two dimensions the platform audit measures. The other four
 * `SeoAuditStats` fields are a storefront's and are zero here (see
 * `runPlatformSeoAudit`); rendering them would report "0 products" as a fact
 * about budstacks.io rather than as a field that does not apply.
 */
export const PLATFORM_SEO_AUDIT_COPY: SeoAuditCopy = {
  loading: "Checking every page on budstacks.io…",
  stats: (stats) =>
    `Checked ${stats.pages} marketing and guide ${stats.pages === 1 ? "route" : "routes"} and ${stats.posts} published blog ${stats.posts === 1 ? "post" : "posts"}.`,
  clean: (passed) =>
    `All ${passed} checks passed. Every route and article serves a title, a description and a social card of its own, and tells a search engine which address it lives at.`,
};
