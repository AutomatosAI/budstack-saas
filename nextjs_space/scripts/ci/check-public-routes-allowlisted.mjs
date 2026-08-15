#!/usr/bin/env node
/**
 * Public-route guard: a public page must be in `isPublicRoute`, or it answers
 * anonymous traffic with a redirect to the Clerk login.
 *
 * `isPublicRoute` in middleware.ts is an ALLOWLIST. A new marketing or legal
 * page renders correctly in development (where you are signed in) and 307s for
 * every real visitor and every crawler. Nothing in the build catches it.
 *
 * This has now happened four times:
 *   1. /robots.txt and /sitemap.xml            (SEO US-006)
 *   2. /api/integrations/automatos/posts       (fix f59ac74)
 *   3. /dpa, /aup, /regulatory, /faq           (found by PRD review, 2026-08-15)
 *   4. /documents + every guide beneath it     (found while fixing 3 — the whole
 *      18-page guide hub, built as top-of-funnel marketing, had never been
 *      reachable logged-out)
 *
 * …and #3 also took POST /api/platform/leads with it, so platform lead capture
 * recorded nothing from the moment it shipped.
 *
 * WHY THIS IS A SOURCE CHECK AND NOT AN HTTP PROBE. CI never starts the app
 * (typecheck, lint and build only), so there is no origin to curl. Comparing
 * the route tree against the allowlist needs no server and fails at PR time
 * rather than after deploy.
 *
 * Exits non-zero (CI failure) if a public-looking page is not allowlisted.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");

/**
 * Top-level route segments that are NOT public, with the reason. Anything else
 * carrying a page.tsx is treated as public and must be allowlisted.
 *
 * Deliberately an explicit list: a new segment defaults to "must be public",
 * so forgetting to classify it fails the build instead of silently shipping
 * behind a login wall. If you add a genuinely private area, name it here.
 */
const INTENTIONALLY_PRIVATE = new Map([
  ["tenant-admin", "tenant admin console — auth required"],
  ["super-admin", "platform admin console — auth required"],
]);

/** Extract the string literals passed to createRouteMatcher([...]). */
function readPublicPatterns(middlewareSource) {
  const start = middlewareSource.indexOf("const isPublicRoute = createRouteMatcher([");
  if (start === -1) {
    console.error("✗ Could not find isPublicRoute in middleware.ts.");
    process.exit(1);
  }
  const end = middlewareSource.indexOf("]);", start);
  const block = middlewareSource.slice(start, end);

  return [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/**
 * Clerk's matcher accepts path-to-regexp style patterns. Only `(.*)` appears in
 * this file, so translating that one form is enough — and being narrow here is
 * deliberate: a pattern this does not understand should fail loudly rather than
 * quietly match everything.
 */
function patternToRegExp(pattern) {
  const WILDCARD = "(.*)";
  // Split on the wildcard FIRST, escape each literal piece completely, then
  // rejoin with a real `.*`. Escaping the whole string and un-escaping after
  // is the obvious approach and is wrong: `*` has to be in the escape class to
  // handle a literal asterisk, which leaves `(\.\*)` to detect — and getting
  // that dance slightly wrong yields `(\.*)`, "zero or more literal dots",
  // which still matches the bare path and so passes its own test.
  const escaped = pattern
    .split(WILDCARD)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`);
}

const middlewarePath = join(appRoot, "middleware.ts");
const patterns = readPublicPatterns(readFileSync(middlewarePath, "utf8"));
const matchers = patterns.map(patternToRegExp);
const isPublic = (path) => matchers.some((re) => re.test(path));

/** Top-level segments under app/ that render a page. */
const segments = readdirSync(join(appRoot, "app"), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  // Route groups `(name)`, private folders `_name`, and dynamic segments are
  // not addressable top-level paths.
  .filter((n) => !n.startsWith("(") && !n.startsWith("_") && !n.startsWith("["))
  .filter((n) => existsSync(join(appRoot, "app", n, "page.tsx")))
  .sort();

const violations = [];

for (const segment of segments) {
  if (INTENTIONALLY_PRIVATE.has(segment)) continue;
  const path = `/${segment}`;
  if (!isPublic(path)) {
    violations.push({
      path,
      hint: `app/${segment}/page.tsx renders a public page but /${segment} is not in isPublicRoute`,
    });
  }
}

/**
 * Every URL the platform sitemap advertises must also be fetchable. Listing a
 * path for crawlers that answers them with a login redirect is worse than not
 * listing it.
 */
const sitemapPath = join(appRoot, "app", "sitemap.ts");
if (existsSync(sitemapPath)) {
  const sitemapSource = readFileSync(sitemapPath, "utf8");
  const block = sitemapSource.slice(
    sitemapSource.indexOf("MARKETING_PATHS"),
    sitemapSource.indexOf("];", sitemapSource.indexOf("MARKETING_PATHS")),
  );
  for (const [, path] of block.matchAll(/path:\s*"([^"]*)"/g)) {
    const url = path === "" ? "/" : path;
    if (!isPublic(url)) {
      violations.push({
        path: url,
        hint: `app/sitemap.ts advertises ${url} to crawlers but it is not in isPublicRoute`,
      });
    }
  }
}

if (violations.length > 0) {
  console.error("✗ Public-route guard failed — these answer anonymous requests with a login redirect:");
  for (const v of violations) {
    console.error(`  - ${v.path}`);
    console.error(`      ${v.hint}`);
  }
  console.error("\n  Add them to isPublicRoute in middleware.ts, or — if the page really is");
  console.error("  private — name it in INTENTIONALLY_PRIVATE in this script with a reason.");
  process.exit(1);
}

console.log(
  `✓ Public-route guard: ${segments.length} top-level pages and every sitemap path are reachable logged-out.`,
);
