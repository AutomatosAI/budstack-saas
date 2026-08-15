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

/**
 * Unauthenticated API handlers that must STAY unauthenticated. A route.ts gives
 * no signal about whether it expects a session, so these are declared rather
 * than discovered — the point is that dropping one from the allowlist fails CI.
 * `/api/platform/leads` is here because that is precisely what happened: it
 * shipped in #254 and answered every submission with a redirect to Clerk.
 */
const PUBLIC_API_HANDLERS = [
  {
    path: "/api/platform/leads",
    file: "app/api/platform/leads/route.ts",
    why: "homepage CTA + Operator 101 download — a prospect has no account and no tenant",
  },
];

/**
 * Every page in the App Router tree, as an addressable path.
 *
 * Recursive, not top-level only: `app/documents/[slug]/page.tsx` is 18 guide
 * pages, and a top-level scan cannot see that dropping `/documents/(.*)` puts
 * all of them back behind the login wall. Walking the whole tree is also what
 * surfaced /auth/forgot-password, /auth/callback, /legal/changelog and
 * /legal/subprocessors as already broken.
 *
 * Dynamic segments become a probe value so the matcher test means something.
 * An OPTIONAL catch-all `[[...rest]]` also matches its parent, so it yields the
 * parent path — that is the only reason /auth/login resolves at all, since
 * there is no app/auth/login/page.tsx, just [[...rest]].
 */
function collectRoutes(dir, segments = []) {
  const routes = [];

  if (existsSync(join(dir, "page.tsx"))) {
    routes.push(`/${segments.join("/")}`.replace(/\/+$/, "") || "/");
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    if (name.startsWith("_") || name === "node_modules") continue;

    let next;
    if (name.startsWith("(") && name.endsWith(")")) {
      next = segments; // route group — organisational, not addressable
    } else if (name.startsWith("[[") && name.endsWith("]]")) {
      next = segments; // optional catch-all — also matches the parent
    } else if (name.startsWith("[")) {
      next = [...segments, "__probe__"];
    } else {
      next = [...segments, name];
    }

    routes.push(...collectRoutes(join(dir, name), next));
  }

  return routes;
}

const violations = [];

const routes = [...new Set(collectRoutes(join(appRoot, "app")))].sort();

for (const route of routes) {
  if (route === "/") continue; // the root page, allowlisted as "/"
  const topSegment = route.split("/")[1];
  if (INTENTIONALLY_PRIVATE.has(topSegment)) continue;
  if (!isPublic(route)) {
    violations.push({
      path: route,
      hint: `a page.tsx renders ${route} but no isPublicRoute pattern matches it`,
    });
  }
}

for (const handler of PUBLIC_API_HANDLERS) {
  // A removed route is not this guard's business — only a still-present
  // unauthenticated handler that has lost its allowlist entry.
  if (!existsSync(join(appRoot, handler.file))) continue;
  if (!isPublic(handler.path)) {
    violations.push({
      path: handler.path,
      hint: `${handler.file} is unauthenticated by design (${handler.why}) but is not in isPublicRoute`,
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
  `✓ Public-route guard: ${routes.length} pages, ${PUBLIC_API_HANDLERS.length} public API handler(s) and every sitemap path are allowlisted.`,
);
