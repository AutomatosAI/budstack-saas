/**
 * SEO Supercharge US-023 — the audit's 15-minute cache.
 *
 * WHY CACHE AT ALL. One audit is four tenant-scoped reads that can each return
 * thousands of rows, and the panel that shows it re-mounts every time an owner
 * clicks back to the tab. Nothing in the result changes second to second, so
 * recomputing it per view spends the shared connection pool on an answer we
 * already had.
 *
 * IN-PROCESS, NOT A DB TABLE (the story allows either, and asks that the choice
 * be documented). The result is derived data — every input is already in
 * Postgres and the audit is a pure function of them — so persisting it would add
 * a table, a migration and a staleness problem in exchange for surviving a
 * restart, which for a 15-minute cache is worth nothing. The cost is that N app
 * instances hold N copies; they agree, because they compute the same function
 * over the same rows.
 *
 * KEYED ON TENANT ID, AND ONLY ON TENANT ID. This is the impersonation-safety
 * requirement in the story's notes: under PRD-302 a super-admin acting as a
 * store has the impersonated tenant's id in `ctx.tenantId`, and that is the
 * store whose audit they must see. Keying on a session, a user or a Clerk org
 * would hand an impersonating operator their OWN cached result, or worse, leave
 * one tenant's findings under a key another tenant can reach. The tenant id is
 * the only thing in the request that identifies the data.
 *
 * STALENESS IS THE OWNER'S TO RESOLVE. A `refresh` recompute bypasses the cache
 * so that fixing three findings and re-running does not show the old score for a
 * quarter of an hour. It is a recompute, not a write, behind `canViewSeo` +
 * `seo.pro` — the worst an admin can do with it is make their own store's audit
 * accurate. Invalidating from the SEO write routes instead would be tighter and
 * is the better long-term shape; it also touches six routes this story has no
 * other reason to open.
 */

import type { SeoAuditResult } from "@/lib/seo/audit-types";

/** ~15 minutes, per the story. */
export const SEO_AUDIT_TTL_MS = 15 * 60_000;

/**
 * How many tenants one instance remembers. Bounded because this Map lives for
 * the life of the process and a large platform has more stores than any one
 * instance needs to hold audits for. Oldest insertion is evicted first (Map
 * preserves insertion order) — crude, but the working set is "stores whose
 * owner is looking at the SEO Manager right now", which is small.
 */
const MAX_CACHED_TENANTS = 500;

interface CacheEntry {
  readonly result: SeoAuditResult;
  /** Epoch ms — when this audit was computed. */
  readonly generatedAt: number;
  readonly expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<CacheEntry>>();

/** What the route answers with. `cached` is shown as "audited N minutes ago". */
export interface SeoAuditSnapshot {
  readonly audit: SeoAuditResult;
  /** ISO 8601 — crosses to the client as a string, never as a Date (#229). */
  readonly generatedAt: string;
  readonly cached: boolean;
  /** Seconds until this result is recomputed on its own. */
  readonly expiresIn: number;
}

function remember(tenantId: string, result: SeoAuditResult): CacheEntry {
  const now = Date.now();
  const entry: CacheEntry = {
    result,
    generatedAt: now,
    expiresAt: now + SEO_AUDIT_TTL_MS,
  };

  if (!cache.has(tenantId) && cache.size >= MAX_CACHED_TENANTS) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  cache.set(tenantId, entry);
  return entry;
}

function snapshot(entry: CacheEntry, cached: boolean): SeoAuditSnapshot {
  return {
    audit: entry.result,
    generatedAt: new Date(entry.generatedAt).toISOString(),
    cached,
    expiresIn: Math.max(0, Math.round((entry.expiresAt - Date.now()) / 1000)),
  };
}

/**
 * The tenant's audit — from cache when it is fresh, otherwise computed once.
 *
 * Concurrent callers for one tenant share a single run: the panel mounting twice
 * (React strict mode in dev, an owner double-clicking Re-run) must not double
 * the queries. A failed run is NOT cached — the next request retries rather than
 * being told for fifteen minutes that the audit is unavailable.
 */
export async function cachedSeoAudit(
  tenantId: string,
  run: () => Promise<SeoAuditResult>,
  options: { readonly refresh?: boolean } = {},
): Promise<SeoAuditSnapshot> {
  if (!options.refresh) {
    const entry = cache.get(tenantId);
    if (entry && Date.now() < entry.expiresAt) return snapshot(entry, true);
  }

  const pending = inFlight.get(tenantId);
  if (pending) return snapshot(await pending, false);

  const started = run()
    .then((result) => remember(tenantId, result))
    .finally(() => {
      inFlight.delete(tenantId);
    });

  inFlight.set(tenantId, started);
  return snapshot(await started, false);
}

/** Drop one tenant's cached audit — for a write path that invalidates it. */
export function invalidateSeoAudit(tenantId: string): void {
  cache.delete(tenantId);
}

/** Test-only: start from cold. */
export function resetSeoAuditCache(): void {
  cache.clear();
  inFlight.clear();
}
