import { publishedGuides } from "@/lib/documents/registry";
import type { Guide } from "@/lib/documents/types";
import {
  PLATFORM_ROUTE_FALLBACKS,
  type PlatformRouteFallback,
} from "@/lib/seo/platform-page-metadata";

/**
 * US-014 — the ONE list of budstacks.io routes whose metadata a super-admin can
 * author, and the key every `platform_seo_settings` row is looked up by.
 *
 * `lib/seo/store-pages.ts`'s counterpart for the platform. Its header records
 * what happens without a single list: three hardcoded page lists disagreed with
 * each other and with the storefront, so an owner could author metadata for a
 * URL that had redirected away. This list exists so the admin, the write route's
 * validation and (US-015) the pages that read the result cannot drift apart.
 *
 * WHAT IS IN IT: every PUBLIC marketing route, taken from `isPublicRoute` in
 * middleware.ts. Anything not in that allowlist answers a signed-out request
 * with a Clerk redirect, so authoring a title for it would be authoring a title
 * for a login wall.
 *
 * WHY THE GUIDES ARE ROWS AND POSTS ARE NOT. `/documents/{slug}` is a FINITE,
 * code-defined set — `GUIDES` is a registry of data modules, so each guide has a
 * stable path a settings row can key on. `/blog/{slug}` and `/learn/{slug}` are
 * database rows that already carry their own authored metadata (`platform_posts
 * .seo`, `learning_resources`), and a settings table cannot hold a row per row
 * of another table. That is the same line the US-013 seed drew; it seeded the
 * static routes only, so a guide starts with no row and falls back (US-015).
 *
 * SERVER-SIDE ONLY, deliberately: `GUIDES` pulls in eighteen guide modules'
 * prose, which has no business in a browser bundle. The admin page resolves the
 * list server-side and passes it down as data; a client component may import
 * the TYPE (erased at compile time) but never the function.
 */

/** The sections the admin list is grouped into. */
export type PlatformSeoRouteGroup = "Marketing" | "Documentation" | "Legal";

export interface PlatformSeoRoute {
  /**
   * The `platform_seo_settings.routePath` key: rooted, no host, no trailing
   * slash, no query. "/" is the homepage and the only single-slash value.
   */
  readonly path: string;
  /** Label in the admin list. */
  readonly name: string;
  readonly group: PlatformSeoRouteGroup;
}

/**
 * The static public routes — the same fifteen the US-013 migration seeded, in
 * the order they appear in `isPublicRoute`.
 */
export const PLATFORM_SEO_STATIC_ROUTES: readonly PlatformSeoRoute[] = [
  { path: "/", name: "Homepage", group: "Marketing" },
  { path: "/marketplace", name: "Marketplace", group: "Marketing" },
  { path: "/learn", name: "Learning Center", group: "Marketing" },
  { path: "/blog", name: "Blog", group: "Marketing" },
  { path: "/contact", name: "Contact", group: "Marketing" },
  { path: "/faq", name: "FAQ", group: "Marketing" },
  { path: "/documents", name: "The BudStacks Guide", group: "Documentation" },
  { path: "/regulatory", name: "Regulatory information", group: "Legal" },
  { path: "/terms", name: "Terms of Service", group: "Legal" },
  { path: "/privacy", name: "Privacy Policy", group: "Legal" },
  { path: "/cookies", name: "Cookie Policy", group: "Legal" },
  { path: "/dpa", name: "Data Processing Agreement", group: "Legal" },
  { path: "/aup", name: "Acceptable Use Policy", group: "Legal" },
  { path: "/legal/changelog", name: "Changelog", group: "Legal" },
  { path: "/legal/subprocessors", name: "Sub-processors", group: "Legal" },
];

/**
 * One row per PUBLISHED guide, in series order.
 *
 * `coming-soon` guides are excluded because `app/documents/[slug]/page.tsx`
 * calls `notFound()` for anything that is not published, so a row here would be
 * metadata for a 404. US-016 gave the sitemap the same problem, so the filter
 * and the series ordering now live once in `publishedGuides()` — this list and
 * the sitemap's `/documents/{slug}` entries cannot disagree about which guides
 * exist.
 */
function guideRoutes(): PlatformSeoRoute[] {
  return publishedGuides().map((guide) => ({
    path: `/documents/${guide.slug}`,
    name: `Part ${guide.part} — ${guide.title}`,
    group: "Documentation" as const,
  }));
}

/** Every authorable route: the static list, then the guides beneath it. */
export function platformSeoRoutes(): readonly PlatformSeoRoute[] {
  return [...PLATFORM_SEO_STATIC_ROUTES, ...guideRoutes()];
}

/**
 * The metadata one guide page SHIPS with — its own title and summary, suffixed
 * with the series name.
 *
 * ONE definition, called by both the page (`app/documents/[slug]/page.tsx`, via
 * `generatePlatformGuideMetadata`) and US-020's audit. A second copy in the
 * audit would let it report a title the page does not serve — which is exactly
 * the class of defect the audit exists to find.
 */
export function platformGuideFallback(guide: Guide): PlatformRouteFallback {
  return {
    title: `${guide.title} — The BudStacks Guide`,
    description: guide.summary,
  };
}

/**
 * What each authorable route serves before `platform_seo_settings` has an
 * opinion — the static pages' shipped strings, then every published guide's.
 *
 * US-020's audit reads this to tell "this page has a title of its own" from
 * "this page falls through to the platform default", which is the difference
 * between a described page and one sharing a sentence with fourteen others.
 * Server-side only, like the rest of this module: it reaches the guide registry.
 */
export function platformRouteFallbacks(): ReadonlyMap<
  string,
  PlatformRouteFallback
> {
  return new Map<string, PlatformRouteFallback>([
    ...Object.entries(PLATFORM_ROUTE_FALLBACKS),
    ...publishedGuides().map(
      (guide): [string, PlatformRouteFallback] => [
        `/documents/${guide.slug}`,
        platformGuideFallback(guide),
      ],
    ),
  ]);
}

/**
 * Is this a route the write API may store a row for?
 *
 * The write route's validation, so an unknown or misspelt path is refused
 * rather than filed as a row no page will ever read — the write-only-column
 * defect the SEO workstream exists to close.
 */
export function isPlatformSeoRoutePath(path: string): boolean {
  return platformSeoRoutes().some((route) => route.path === path);
}

/** The groups in list order, so the admin page does not restate them. */
export const PLATFORM_SEO_ROUTE_GROUPS: readonly PlatformSeoRouteGroup[] = [
  "Marketing",
  "Documentation",
  "Legal",
];
