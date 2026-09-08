/**
 * Routes that must be reached by a full document load.
 *
 * The Content-Security-Policy is built per route in middleware
 * (lib/security/csp.ts), and the analytics pages are the one place the admin
 * policy is wider: they carry `'unsafe-eval'` for plotly.js. A policy belongs
 * to the DOCUMENT, so a client-side `<Link>` navigation into analytics keeps
 * the policy of the page the user started on — plotly then fails to run —
 * and a `<Link>` out of analytics carries the widened policy onto pages that
 * should not have it. Both directions are avoided by rendering those links
 * as plain anchors, which the admin navigation does via these helpers.
 *
 * Kept free of React/Next imports so it is unit-testable in the node runner.
 */

/** Pathname prefixes whose CSP variant differs from the rest of the admin. */
export const FULL_DOCUMENT_ROUTES = [
  "/tenant-admin/analytics",
  "/super-admin/analytics",
] as const;

function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** True when `href` points at a route that needs its own document. */
export function needsFullDocument(href: string): boolean {
  const path = href.split(/[?#]/)[0];
  return FULL_DOCUMENT_ROUTES.some((route) => matchesRoute(path, route));
}

/**
 * True when a link from the page at `pathname` to `href` must be a full load:
 * either the destination needs its own document, or the current page is one
 * whose widened policy must not travel to the destination.
 */
export function shouldFullLoad(pathname: string | null, href: string): boolean {
  return needsFullDocument(href) || (pathname !== null && needsFullDocument(pathname));
}
