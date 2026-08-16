import {
  resolvePlatformPageSeo,
  type PlatformRouteFallback,
  type PlatformSeoOverride,
} from "@/lib/seo/platform-page-metadata";
import {
  resolvePlatformPostSeo,
  type PlatformPostMetadataSource,
} from "@/lib/seo/platform-post-metadata";
import { scoreSeoAudit } from "@/lib/seo/audit";
import {
  SEO_AUDIT_WEIGHTS,
  type SeoAuditCheckId,
  type SeoAuditFinding,
  type SeoAuditResult,
} from "@/lib/seo/audit-types";

/**
 * Platform US-020 — the SEO audit we sell to tenants, pointed at budstacks.io.
 *
 * `lib/seo/audit.ts`'s counterpart for the platform, and deliberately a
 * different set of questions rather than a copy of that engine. A store's audit
 * asks about products, conditions, a redirect table and a generated sitemap;
 * budstacks.io has none of those. What it has is a fixed list of marketing
 * routes (`platformSeoRoutes()`), a `platform_seo_settings` row that may
 * override each one, and a blog — so the four things worth asking are whether a
 * page has a title, a description and a social card of its OWN, and whether it
 * tells a crawler which address it lives at.
 *
 * IT JUDGES WHAT THE PAGE SERVES, NOT WHAT THE TABLE HOLDS. Every check runs
 * over the output of the SAME resolvers `generateMetadata` calls
 * (`resolvePlatformPageSeo`, `resolvePlatformPostSeo`), which is why a route
 * with an empty settings row but a title in its own page file is not reported as
 * missing one, and why an og:image reference this origin cannot serve counts as
 * the default it will actually render as. An audit that re-derived the cascade
 * would eventually disagree with the tags it claims to describe — the exact
 * defect it exists to find.
 *
 * PURE, like the tenant engine: no prisma, no clock, no request. The queries
 * live in app/api/platform/seo/audit/route.ts and the 15-minute cache is the
 * tenant audit's own (`cachedSeoAudit`).
 *
 * WHAT IT DOES NOT COVER, stated because a score that looks complete and is not
 * is worse than no score:
 *  - `/learn/{slug}`. Those are `learning_resources` rows whose metadata is
 *    built inline in the page rather than by a shared resolver, so auditing them
 *    would mean a second copy of that logic here. They are in the sitemap; they
 *    are not in this score.
 *  - Whether a page actually CALLS its resolver. This judges the metadata the
 *    platform builders produce for a route; a new page that forgot to wire
 *    `generatePlatformRouteMetadata` would serve the layout's defaults and still
 *    read as clean here. That gap belongs to a CI guard, next to
 *    `check-public-routes-allowlisted.mjs`, not to a runtime panel.
 */

/**
 * The checks this audit runs, worst first.
 *
 * A SUBSET, plus one id the tenant audit does not have. `scoreSeoAudit` reports
 * exactly the checks it is given, so the platform result never claims to have
 * passed a deleted-product-leak check that has no meaning off a storefront —
 * and the panel's "N other checks passed" counts only checks that ran.
 */
export const PLATFORM_SEO_AUDIT_CHECKS: readonly SeoAuditCheckId[] = [
  "canonical-missing",
  "title-missing",
  "description-missing",
  "og-image-missing",
];

/**
 * The key this audit is cached under (`cachedSeoAudit`, shared with the tenant
 * audit).
 *
 * That Map is keyed on an opaque string that is a tenant id everywhere else, so
 * this one is deliberately shaped like something that cannot BE one (they are
 * UUIDs): one Map holds both, and a collision would serve a store's findings on
 * the platform page or the reverse.
 *
 * It lives HERE rather than in the route because a Next.js route module may
 * export only handlers and its own config fields — an extra export fails the
 * build with "not a valid Route export field", which `tsc --noEmit` does not
 * catch.
 */
export const PLATFORM_SEO_AUDIT_CACHE_KEY = "platform:budstacks.io";

/** Where a finding about a marketing route sends a super-admin. */
const ROUTE_TAB = "pages";
/** Where a finding about a blog post sends them — The Wire's own editor. */
const POST_TAB = "posts";

/** The super-admin editor for one post; the finding renders as a link to it. */
function postEditorHref(id: string): string {
  return `/super-admin/the-wire/${id}`;
}

/** One authorable route, with whatever the table and the page file say about it. */
export interface PlatformAuditRoute {
  /** The `platform_seo_settings.routePath` key — "/", "/blog", "/documents/x". */
  readonly path: string;
  /** The label the admin list uses, and the one the finding names. */
  readonly name: string;
  /** What the page ships with when nothing is authored. */
  readonly fallback?: PlatformRouteFallback;
  /** The authored row, or null when the route has none. */
  readonly setting?: PlatformSeoOverride | null;
}

/** One published article: everything its metadata is built from, plus its id. */
export interface PlatformAuditPost extends PlatformPostMetadataSource {
  /** `platform_posts.id` — the editor the finding links to. */
  readonly id: string;
}

export interface PlatformSeoAuditInput {
  readonly routes: readonly PlatformAuditRoute[];
  readonly posts: readonly PlatformAuditPost[];
}

/**
 * Does this canonical actually name the page it is on?
 *
 * NOT a comparison of the resolver's output with itself — that would pass by
 * construction and prove nothing. It parses the declared URL and asks whether
 * its path is this page's path, which fails in the three ways that matter: no
 * canonical at all, one that collapsed to the bare origin (`platformCanonical`
 * returns the base when `new URL` cannot parse the path, so every such page
 * would declare the HOMEPAGE canonical), and one pointing at some other address
 * entirely. A page whose canonical names a different URL is asking Google to
 * index that URL instead of it.
 *
 * Trailing slashes are normalised away on both sides: `/blog` and `/blog/` are
 * one page, and the tags are built with the slash stripped.
 */
export function canonicalNamesRoute(canonical: string, path: string): boolean {
  if (!canonical) return false;

  try {
    const url = new URL(canonical);
    // Percent-decoded, because the path is assembled from author-typed slugs and
    // `new URL` encodes them on the way in — `/blog/caf%C3%A9` and `/blog/café`
    // are the same page.
    const declared = decodeURIComponent(url.pathname).replace(/\/+$/, "") || "/";
    const expected = path.replace(/\/+$/, "") || "/";
    return declared === expected;
  } catch {
    // An unparseable canonical is one no crawler can follow, which is the same
    // outcome as having none.
    return false;
  }
}

/**
 * One finding. Severity is READ FROM THE WEIGHTS TABLE rather than passed in,
 * exactly as `auditFinding` does on the tenant side (lib/seo/audit-checks.ts:47):
 * a check's severity is decided in one place, and a finding that disagreed with
 * the group heading above it would be the panel arguing with itself.
 */
function finding(
  check: SeoAuditCheckId,
  message: string,
  target: SeoAuditFinding["target"],
): SeoAuditFinding {
  return {
    check,
    severity: SEO_AUDIT_WEIGHTS[check].severity,
    message,
    target,
  };
}

/** The findings for one marketing route. */
function auditRoute(route: PlatformAuditRoute): SeoAuditFinding[] {
  const seo = resolvePlatformPageSeo({
    routePath: route.path,
    fallback: route.fallback,
    setting: route.setting,
  });

  const target = {
    tab: ROUTE_TAB,
    entityId: route.path,
    label: route.name,
  } as const;

  return [
    ...(canonicalNamesRoute(seo.canonical, route.path)
      ? []
      : [
          finding(
            "canonical-missing",
            `${route.name} does not tell a search engine which address it lives at, so every campaign link to it can be indexed as a page of its own.`,
            target,
          ),
        ]),
    ...(seo.usesDefaultTitle
      ? [
          finding(
            "title-missing",
            `${route.name} has no title of its own — it serves the platform default, the same one every unauthored page on the site serves.`,
            target,
          ),
        ]
      : []),
    ...(seo.usesDefaultDescription
      ? [
          finding(
            "description-missing",
            `${route.name} has no description of its own, so a search result for it reads as a description of BudStacks in general.`,
            target,
          ),
        ]
      : []),
    ...(seo.usesDefaultOgImage
      ? [
          finding(
            "og-image-missing",
            `${route.name} shares the platform's stock image when it is posted anywhere, rather than a card of its own.`,
            target,
          ),
        ]
      : []),
  ];
}

/**
 * The findings for one published article.
 *
 * NO TITLE CHECK. A post's `<title>` is its headline, which the write schema
 * requires and the editor cannot save empty, so there is nothing here that a
 * super-admin could act on — where a marketing route genuinely can have none.
 * A canonical check IS run: every article's URL is assembled from an author-typed
 * slug, which is the input `platformCanonical` can fail to parse.
 */
function auditPost(post: PlatformAuditPost): SeoAuditFinding[] {
  const seo = resolvePlatformPostSeo(post);
  const label = post.title || post.slug;

  const target = {
    tab: POST_TAB,
    entityId: post.id,
    label,
    href: postEditorHref(post.id),
  } as const;

  return [
    ...(canonicalNamesRoute(seo.canonical, `/blog/${post.slug}`)
      ? []
      : [
          finding(
            "canonical-missing",
            `"${label}" declares no usable canonical URL, so the article competes with every campaign and referral link that reaches it.`,
            target,
          ),
        ]),
    ...(seo.description
      ? []
      : [
          finding(
            "description-missing",
            `"${label}" has neither an excerpt nor an authored description, so a search result for it falls back to the platform's own sentence.`,
            target,
          ),
        ]),
    ...(seo.usesDefaultOgImage
      ? [
          finding(
            "og-image-missing",
            `"${label}" has no cover image, so sharing it shows the platform's stock card instead of the article.`,
            target,
          ),
        ]
      : []),
  ];
}

/**
 * Audit budstacks.io.
 *
 * `stats` carries the two dimensions the platform HAS: `pages` is every
 * authorable route (the fifteen marketing pages and every published guide) and
 * `posts` is every published article. The other four fields are a storefront's —
 * products, conditions, a redirect table, a generated sitemap — and are reported
 * as zero rather than invented; the platform panel's copy names only the two, so
 * a zero that means "not applicable" is never rendered as one that means "none"
 * (components/admin/seo/audit-copy.ts).
 */
export function runPlatformSeoAudit(
  input: PlatformSeoAuditInput,
): SeoAuditResult {
  const findings: SeoAuditFinding[] = [
    ...input.routes.flatMap(auditRoute),
    ...input.posts.flatMap(auditPost),
  ];

  return scoreSeoAudit(
    findings,
    {
      pages: input.routes.length,
      posts: input.posts.length,
      products: 0,
      conditions: 0,
      redirects: 0,
      sitemapEntries: 0,
      // Nothing here is capped: the route list is fixed in code and the blog is
      // tens of rows, not thousands. If that changes, this is where the ceiling
      // would be declared, the way the tenant route declares its own.
      truncated: [],
    },
    PLATFORM_SEO_AUDIT_CHECKS,
  );
}
