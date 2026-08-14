/**
 * LLM Visibility US-005 — every database read and write the citation monitor
 * makes, in one place.
 *
 * SERVER ONLY. Split from the rules (`citation-monitor.ts`) and the sweep
 * (`citation-monitor-runner.ts`) for the reason the reorder automation split
 * the same three ways: the dashboard needs the rules in a browser bundle, and
 * the sweep needs to be testable without a queue.
 *
 * EVERY QUERY NAMES ITS tenantId, without exception. The sweep runs inside
 * `bypassTenantScope`, which binds an EXPLICIT null context — under that
 * binding lib/db.ts's scope extension falls through and adds nothing, so a
 * query that forgot its tenantId here would read every store's rows. The `where`
 * clauses below are the isolation, not a convenience.
 *
 * Row shapes are annotated rather than inferred throughout: the `prisma` export
 * in lib/db.ts is any-widened by its build-time mock Proxy, so an inferred row
 * collapses to `any` and takes the caller's types with it (TS7006).
 */

import { prisma } from "@/lib/db";
import { isSeoProUnlocked } from "@/lib/seo/pro-features";
import {
  CITATION_HISTORY_LIMIT,
  resolveCitationCountry,
  type CitationCheckRow,
  type CitationMarket,
} from "@/lib/seo/citation-monitor";

/** Conditions read for prompt topics. Three are used; the rest are headroom. */
const MAX_CONDITION_TOPICS = 50;

/** Products scanned for their categories, ordered so the read is stable. */
const MAX_CATEGORY_ROWS = 200;

/** One store the sweep will run for. */
export interface CitationTenant {
  readonly tenantId: string;
  readonly subdomain: string;
  readonly customDomain: string | null;
  readonly businessName: string;
  readonly country: string;
}

interface CitationTenantRow {
  id: string;
  subdomain: string;
  customDomain: string | null;
  businessName: string;
  businessCountry: string | null;
  countryCode: string | null;
  plan: string | null;
}

/**
 * The stores this sweep will spend money for: active, entitled, and connected.
 *
 * THE KEY IS FILTERED IN SQL AND NEVER SELECTED. `automatosApiKey: { not: null }`
 * makes the database do the connected-or-not test, so no tenant credential is
 * loaded into the worker's memory to answer a question about presence. The
 * credential itself is read once per store, later and lower down, by
 * `loadAutomatosCredentials` — the one function allowed to hold it.
 *
 * The plan gate is applied HERE rather than in the runner because it decides
 * whether a store is swept at all: the monitor is a Pro feature, and a Basic
 * tenant's Automatos account must not be charged for a feature they cannot see.
 * `isSeoProUnlocked` is the same fail-closed predicate the SEO Manager renders
 * from, so an unrecognised plan value skips the store rather than sweeping it.
 */
export async function findCitationTenants(): Promise<readonly CitationTenant[]> {
  const rows: CitationTenantRow[] = await prisma.tenants.findMany({
    where: { isActive: true, automatosApiKey: { not: null } },
    orderBy: { subdomain: "asc" },
    select: {
      id: true,
      subdomain: true,
      customDomain: true,
      businessName: true,
      businessCountry: true,
      countryCode: true,
      plan: true,
    },
  });

  return rows
    .filter((row) => isSeoProUnlocked({ id: row.id, plan: row.plan }))
    .map((row) => ({
      tenantId: row.id,
      subdomain: row.subdomain,
      customDomain: row.customDomain,
      businessName: row.businessName,
      country: resolveCitationCountry(row),
    }));
}

/**
 * What this store sells and treats — the material the prompts are built from.
 *
 * Published conditions only, because an unpublished one has no storefront page:
 * asking a model about a topic this store does not publish would measure
 * somebody else's content. Categories come off live products (the soft-delete
 * extension supplies `deletedAt: null`), capped and alphabetically ordered so
 * the same catalogue produces the same questions week after week.
 */
export async function loadCitationMarket(
  tenantId: string,
  country: string,
): Promise<CitationMarket> {
  const [conditions, products]: [{ name: string }[], { category: string }[]] =
    await Promise.all([
      prisma.conditions.findMany({
        where: { tenantId, published: true },
        orderBy: { name: "asc" },
        take: MAX_CONDITION_TOPICS,
        select: { name: true },
      }),
      prisma.products.findMany({
        where: { tenantId },
        orderBy: { category: "asc" },
        take: MAX_CATEGORY_ROWS,
        select: { category: true },
      }),
    ]);

  return {
    country,
    conditions: conditions.map((row) => row.name),
    categories: products.map((row) => row.category),
  };
}

/** One observation on its way into the table. */
export interface CitationCheckInput {
  readonly engine: string;
  readonly prompt: string;
  readonly cited: boolean;
  readonly citedUrl: string | null;
  readonly mentionText: string | null;
}

/**
 * Write one store's run.
 *
 * ONE `createMany` PER STORE rather than a write per check: the rows are a
 * single run's evidence and there is nothing to reconcile between them, so the
 * cheap shape is also the correct one. `checkedAt` is passed explicitly and is
 * the SAME instant for every row in a run — the dashboard groups by run, and
 * twelve timestamps a few minutes apart would fan one weekly check out into
 * twelve.
 */
export async function recordCitationChecks(
  tenantId: string,
  checks: readonly CitationCheckInput[],
  checkedAt: Date,
): Promise<number> {
  if (checks.length === 0) return 0;

  const result: { count: number } = await prisma.llm_citation_checks.createMany({
    data: checks.map((check) => ({
      tenantId,
      engine: check.engine,
      prompt: check.prompt,
      cited: check.cited,
      citedUrl: check.citedUrl,
      mentionText: check.mentionText,
      checkedAt,
    })),
  });

  return result.count;
}

interface StoredCitationRow {
  id: string;
  engine: string;
  prompt: string;
  cited: boolean;
  citedUrl: string | null;
  mentionText: string | null;
  checkedAt: Date;
}

/**
 * This store's recent checks, newest first.
 *
 * `checkedAt` leaves as an ISO STRING, not a Date. It crosses to a client
 * component, where a Date-typed prop that is actually a string is the #229
 * class of render crash — the conversion happens once, here, so no caller has
 * to remember it.
 */
export async function readCitationChecks(
  tenantId: string,
  limit: number = CITATION_HISTORY_LIMIT,
): Promise<readonly CitationCheckRow[]> {
  const rows: StoredCitationRow[] = await prisma.llm_citation_checks.findMany({
    where: { tenantId },
    orderBy: { checkedAt: "desc" },
    take: limit,
    select: {
      id: true,
      engine: true,
      prompt: true,
      cited: true,
      citedUrl: true,
      mentionText: true,
      checkedAt: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    engine: row.engine,
    prompt: row.prompt,
    cited: row.cited,
    citedUrl: row.citedUrl,
    mentionText: row.mentionText,
    checkedAt: row.checkedAt.toISOString(),
  }));
}
