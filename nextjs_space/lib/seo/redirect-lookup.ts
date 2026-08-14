/**
 * SEO Supercharge US-020 — how middleware learns a tenant's redirect table
 * without a database it cannot reach.
 *
 * WHY THIS FILE EXISTS AT ALL. Next 14 runs middleware in the EDGE runtime.
 * There is no Prisma there, no `pg`, no TCP socket — `middleware.ts` imports
 * exactly three pure modules today (`parse-host`, `custom-domain-rewrite`,
 * `security/csp`) and reaches the database precisely never. So "look the
 * redirect up in middleware" cannot mean a query; it has to mean a cached copy
 * of the table, refreshed over HTTP from a Node-runtime route
 * (`app/api/public/seo/redirects`) that CAN query.
 *
 * THE COST MODEL, which is the part the story cares about:
 *   - warm cache (effectively every request): one Map lookup and, only for a
 *     store host, a scan of an array that is EMPTY for every tenant with no
 *     redirects. No fetch, no query, no await that resolves late. This is the
 *     99% case and it is free;
 *   - soft-stale (past `REFRESH_AFTER_MS`): the cached table is used AS IS and
 *     a refresh is kicked off behind the request. The visitor waits for
 *     nothing. Stale-while-revalidate, because a redirect that is 60 seconds
 *     out of date is a non-event and a storefront that waits on an internal
 *     HTTP round trip is not;
 *   - cold (first request for this host on this instance, or past
 *     `HARD_EXPIRY_MS`): one fetch, bounded by `FETCH_TIMEOUT_MS`. On timeout
 *     or error the table resolves EMPTY and the request proceeds — a redirect
 *     that fails to fire leaves the site exactly as it was before this feature
 *     existed, which is the only acceptable failure direction for a storefront.
 *
 * A tenant with no redirects therefore pays one fetch every `HARD_EXPIRY_MS`
 * per instance and nothing else, ever. That is the "zero-cost for tenants with
 * no redirects" the story asks for; a true zero would need the table to arrive
 * with the request, and nothing in the edge runtime carries it.
 *
 * NOT A SECURITY BOUNDARY. Everything here is a cache. The plan gate (`seo.pro`)
 * and the tenant scoping both live in the feed route, so a poisoned or stale
 * cache can only ever fail to redirect — it cannot hand one tenant another
 * tenant's rules, because the key is the host and the feed resolves the tenant
 * from that same host itself.
 */

import type { TenantHostHint } from "@/lib/parse-host";
import {
  matchRedirect,
  SEO_REDIRECT_MAX_PER_TENANT,
  type SeoRedirectRule,
} from "./redirects";

/** The Node-runtime feed. Public (see the route's own docstring for why). */
export const STORE_REDIRECTS_FEED_PATH = "/api/public/seo/redirects";

/** Past this, the cached table is served but a refresh starts behind it. */
const REFRESH_AFTER_MS = 60_000;

/** Past this, the next request blocks on a refresh rather than serving stale. */
const HARD_EXPIRY_MS = 10 * 60_000;

/**
 * How long a failed or timed-out refresh is remembered as "no redirects".
 * Short, so an outage costs a minute of dormant redirects rather than ten; long
 * enough that a feed that is down is not re-asked on every single request.
 */
const FAILURE_TTL_MS = 15_000;

/**
 * The refresh deadline. A storefront request is already in flight behind this;
 * anything past a fraction of a second is worse for the visitor than the
 * redirect not firing.
 */
const FETCH_TIMEOUT_MS = 800;

/**
 * How many tenants one instance caches.
 *
 * `*.budstacks.io` is a WILDCARD in Cloudflare, so `anything.budstacks.io`
 * reaches this app and would mint a cache entry. Without a bound, walking
 * random subdomains is a memory-growth attack on the edge runtime. Oldest
 * insertion is evicted first (Map preserves insertion order) — crude, but the
 * working set is "hosts with live traffic", which is small and self-renewing.
 */
const MAX_CACHED_TENANTS = 1_000;

interface CacheEntry {
  readonly rules: SeoRedirectRule[];
  readonly refreshAt: number;
  readonly hardExpiresAt: number;
}

const tableCache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CacheEntry>>();

/**
 * Paths middleware must never redirect.
 *
 * `/api` and `/__clerk` are host-agnostic plumbing where a 301 breaks a POST
 * rather than fixing a link; `/_next` is the build output; the admin surfaces
 * have their own apex redirect a few lines further down middleware.ts; `/auth`
 * and `/onboarding` are platform routes that deliberately stay on the tenant
 * host. `isReservedRedirectPath` refuses to STORE rules for most of these — this
 * is the second half of the same rule, applied to the incoming request, so a row
 * that predates a reserved-path addition still cannot fire.
 */
const NON_REDIRECTABLE_PREFIXES = [
  "/api/",
  "/_next",
  "/__clerk",
  "/tenant-admin",
  "/super-admin",
  "/auth/",
  "/onboarding",
] as const;

export function isRedirectablePath(pathname: string): boolean {
  if (pathname === "/api") return false;
  return !NON_REDIRECTABLE_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
}

/**
 * Which tenant's table applies, and what prefix its paths sit under.
 *
 * `basePath` is the difference between production and local dev. On a tenant
 * host the request path IS the store path (`/old-page`). Under dev's path-based
 * routing the same page is `/store/{slug}/old-page`, so the stored rule
 * (`/old-page`) only matches after the prefix is peeled off — and the
 * destination has to be put back under it. Covering both is what makes this
 * feature reproducible on a laptop instead of only in production.
 */
export function storeRedirectScope(
  hint: TenantHostHint,
  pathname: string,
): { key: string; basePath: string } | null {
  if (hint?.kind === "subdomain") {
    return { key: `sub:${hint.subdomain}`, basePath: "" };
  }
  if (hint?.kind === "customDomain") {
    return { key: `cd:${hint.host}`, basePath: "" };
  }
  const pathMatch = pathname.match(/^\/store\/([^/]+)/);
  if (pathMatch) {
    return { key: `slug:${pathMatch[1]}`, basePath: `/store/${pathMatch[1]}` };
  }
  return null;
}

/** Fail-closed parse of the feed's body — anything unexpected is no redirects. */
function parseFeedBody(body: unknown): SeoRedirectRule[] {
  if (typeof body !== "object" || body === null) return [];
  const raw = (body as { redirects?: unknown }).redirects;
  if (!Array.isArray(raw)) return [];

  const rules: SeoRedirectRule[] = [];
  for (const item of raw.slice(0, SEO_REDIRECT_MAX_PER_TENANT)) {
    if (typeof item !== "object" || item === null) continue;
    const { fromPath, toPath, statusCode } = item as Record<string, unknown>;
    if (typeof fromPath !== "string" || typeof toPath !== "string") continue;
    if (statusCode !== 301 && statusCode !== 308) continue;
    rules.push({ fromPath, toPath, statusCode });
  }
  return rules;
}

async function fetchTable(
  origin: string,
  host: string,
  pathname: string,
): Promise<SeoRedirectRule[]> {
  const url = new URL(STORE_REDIRECTS_FEED_PATH, origin);
  url.searchParams.set("host", host);
  // Only read for dev's `/store/{slug}` resolution; on a tenant host the feed
  // resolves from `host` alone and ignores it.
  url.searchParams.set("path", pathname);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`redirect feed responded ${response.status}`);
    }
    return parseFeedBody(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

function remember(
  key: string,
  rules: SeoRedirectRule[],
  fresh: boolean,
): CacheEntry {
  const now = Date.now();
  const entry: CacheEntry = fresh
    ? {
        rules,
        refreshAt: now + REFRESH_AFTER_MS,
        hardExpiresAt: now + HARD_EXPIRY_MS,
      }
    : {
        rules,
        refreshAt: now + FAILURE_TTL_MS,
        hardExpiresAt: now + FAILURE_TTL_MS,
      };

  if (!tableCache.has(key) && tableCache.size >= MAX_CACHED_TENANTS) {
    const oldest = tableCache.keys().next();
    if (!oldest.done) tableCache.delete(oldest.value);
  }
  tableCache.set(key, entry);
  return entry;
}

/** One refresh per key at a time — a burst of cold requests costs one fetch. */
function refresh(
  key: string,
  origin: string,
  host: string,
  pathname: string,
): Promise<CacheEntry> {
  const pending = inFlight.get(key);
  if (pending) return pending;

  const started = fetchTable(origin, host, pathname)
    .then((rules) => remember(key, rules, true))
    // A failed refresh keeps whatever is already cached (an outage should not
    // switch working redirects off) and retries soon.
    .catch(() => remember(key, tableCache.get(key)?.rules ?? [], false))
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, started);
  return started;
}

async function redirectTable(
  key: string,
  origin: string,
  host: string,
  pathname: string,
): Promise<SeoRedirectRule[]> {
  const now = Date.now();
  const entry = tableCache.get(key);

  if (entry && now < entry.hardExpiresAt) {
    if (now >= entry.refreshAt) {
      // Deliberately not awaited — see the cost model in the module docstring.
      void refresh(key, origin, host, pathname);
    }
    return entry.rules;
  }

  return (await refresh(key, origin, host, pathname)).rules;
}

export interface StoreRedirectDecision {
  /** Path (never an absolute URL) to redirect to, under the same host. */
  readonly location: string;
  readonly statusCode: number;
}

/**
 * The redirect that claims this request, or null.
 *
 * ONE HOP ONLY. A chain (`/a` → `/b` → `/c`) resolves by the browser following
 * each 301 in turn, which is what a crawler expects to see and what keeps this
 * function free of the chain-walking a loop would turn into an infinite one.
 * Loops are refused at write time (`findRedirectChainProblem`).
 *
 * Non-GET is left alone: a 301 on a POST is how a form submission silently
 * becomes a GET and loses its body.
 */
export async function resolveStoreRedirect(input: {
  readonly origin: string;
  readonly host: string;
  readonly pathname: string;
  readonly method: string;
  readonly hint: TenantHostHint;
}): Promise<StoreRedirectDecision | null> {
  if (input.method !== "GET" && input.method !== "HEAD") return null;
  if (!isRedirectablePath(input.pathname)) return null;

  const scope = storeRedirectScope(input.hint, input.pathname);
  if (!scope) return null;

  const rules = await redirectTable(
    scope.key,
    input.origin,
    input.host,
    input.pathname,
  );
  if (rules.length === 0) return null;

  const storePath = input.pathname.slice(scope.basePath.length) || "/";
  const rule = matchRedirect(rules, storePath);
  if (!rule) return null;

  // `/` under a base path is the store home, which is the base path itself.
  const destination = rule.toPath === "/" ? "" : rule.toPath;
  return {
    location: `${scope.basePath}${destination}` || "/",
    statusCode: rule.statusCode,
  };
}

/** Test-only: drop every cached table so a case starts from cold. */
export function resetStoreRedirectCache(): void {
  tableCache.clear();
  inFlight.clear();
}
