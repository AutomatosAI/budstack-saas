/**
 * LLM Visibility US-005 — what the weekly citation sweep actually does when it
 * fires.
 *
 * SERVER ONLY, and written to be called from `scripts/email-worker.ts` without
 * dragging the worker's concerns in: it returns an outcome and prints nothing,
 * so the worker stays the only place that decides what appears in the logs, and
 * this stays testable without booting a queue — the shape
 * `reorder-reminder-runner.ts` established.
 *
 * Everything runs inside `bypassTenantScope`, which binds an EXPLICIT null
 * context. The worker has no request context, and every query underneath names
 * its tenantId itself, so this stays legal under TENANT_CONTEXT_STRICT.
 *
 * THE CAP IS A BILL. Each check is a model completion on the STORE'S OWN
 * Automatos account, so the ceiling below is money as much as it is load, and
 * it is enforced by a counter rather than left to the product of two list
 * lengths — a market that grew a category must not quietly become a bigger
 * invoice.
 */

import {
  loadAutomatosCredentials,
  isAutomatosConfigured,
  type AiAssistProvider,
} from "@/lib/seo/ai-assist";
import { citationHosts } from "@/lib/seo/citation-match";
import {
  probeCitation,
  resolveCitationEngines,
  type CitationEngine,
  type DiscoverModels,
} from "@/lib/seo/citation-engine";
import {
  buildCitationPrompts,
  CITATION_MAX_CHECKS_PER_RUN,
} from "@/lib/seo/citation-monitor";
import {
  findCitationTenants,
  loadCitationMarket,
  recordCitationChecks,
  type CitationCheckInput,
  type CitationTenant,
} from "@/lib/seo/citation-monitor-store";
import { bypassTenantScope } from "@/lib/tenant/tenant-scope-policy";

/** Consecutive upstream/timeout failures before a store's pass is abandoned. */
const MAX_CONSECUTIVE_TRANSIENT = 2;

/** What one store's pass produced. */
export interface CitationTenantOutcome {
  readonly tenantId: string;
  /** The models actually asked — ids from the workspace, or the default. */
  readonly engines: readonly string[];
  /** Questions this store's market produced. */
  readonly prompts: number;
  /** Completions actually spent. Never above CITATION_MAX_CHECKS_PER_RUN. */
  readonly attempted: number;
  /** Rows written. Equal to `attempted` unless the pass stopped early. */
  readonly recorded: number;
  /** Of those rows, how many found a link to the store. */
  readonly cited: number;
  /**
   * Why the pass ended before its cap, or null when it ran to the end. A store
   * whose key was rejected and a store whose models never mention it both
   * record few or no citations — this is the field that tells them apart.
   */
  readonly stopped: string | null;
  /**
   * The exception that ended this store's pass, or null. A store that threw is
   * the one outcome that must not look like a store nobody cites.
   */
  readonly error: string | null;
}

export interface CitationSweepOutcome {
  /** Stores swept: active, Pro-entitled, Automatos-connected. */
  readonly tenants: number;
  readonly recorded: number;
  readonly perTenant: readonly CitationTenantOutcome[];
}

/**
 * The two collaborators the sweep reaches the outside world through.
 *
 * Injectable for the same reason `generateSeoDraft` takes a `provider`: the
 * whole chain — engine resolution, metering, credential rules, matching,
 * writing — then runs for real under test, with only the network stubbed.
 * Production passes neither and gets the tenant's own Automatos workspace.
 */
export interface CitationRunOptions {
  readonly provider?: AiAssistProvider;
  readonly discoverModels?: DiscoverModels;
}

const NOTHING: CitationTenantOutcome = {
  tenantId: "",
  engines: [],
  prompts: 0,
  attempted: 0,
  recorded: 0,
  cited: 0,
  stopped: null,
  error: null,
};

/**
 * Is this outcome going to say the same thing to the next eleven calls?
 *
 * A missing credential, an exhausted meter, a rejected key and a limiter that
 * is down are all facts about the ACCOUNT, not about the question — asking
 * again inside the same run buys nothing and, for the metered cases, costs a
 * token to be told so. A timeout or an upstream 5xx might genuinely be about
 * this one call, so those get another go (bounded by
 * {@link MAX_CONSECUTIVE_TRANSIENT}).
 */
function isTerminalSkip(outcome: {
  readonly status: string;
  readonly reason?: string;
}): boolean {
  if (outcome.status === "unavailable" || outcome.status === "rate_limited") {
    return true;
  }
  return (
    outcome.status === "error" &&
    (outcome.reason === "auth" ||
      outcome.reason === "lookup_failed" ||
      outcome.reason === "rate_limiter_unavailable")
  );
}

/** A short, log-safe description of why a pass stopped. Never a credential. */
function describeSkip(outcome: {
  readonly status: string;
  readonly reason?: string;
}): string {
  return outcome.reason ? `${outcome.status}:${outcome.reason}` : outcome.status;
}

/**
 * Run one store's checks: every model against every question, up to the cap.
 *
 * THE ORDER IS MODEL-OUTER, QUESTION-INNER so that a pass which stops early has
 * asked one model the whole market rather than every model the first question —
 * a complete row for one engine is a usable dashboard, half a row for each is
 * not.
 *
 * The rows are written ONCE at the end, with a single `checkedAt` for the whole
 * run. Nothing is written for a check that never produced an answer: "the key
 * was rejected" and "the model did not mention you" are opposite facts and a
 * row cannot be allowed to blur them.
 */
export async function runTenantCitationChecks(
  tenant: CitationTenant,
  now: Date,
  options: CitationRunOptions = {},
): Promise<CitationTenantOutcome> {
  const credentials = await loadAutomatosCredentials(tenant.tenantId);
  // The key was cleared between the SQL filter and here, or is whitespace.
  // Not an error: it is the same "not connected" state the tab already renders.
  if (!isAutomatosConfigured(credentials)) {
    return { ...NOTHING, tenantId: tenant.tenantId, stopped: "not_connected" };
  }

  const [engines, market] = await Promise.all([
    resolveCitationEngines(credentials, options.discoverModels),
    loadCitationMarket(tenant.tenantId, tenant.country),
  ]);
  const prompts = buildCitationPrompts(market);
  const hosts = citationHosts({
    subdomain: tenant.subdomain,
    customDomain: tenant.customDomain,
  });

  const checks: CitationCheckInput[] = [];
  let attempted = 0;
  let consecutiveTransient = 0;
  let stopped: string | null = null;

  outer: for (const engine of engines as readonly CitationEngine[]) {
    for (const prompt of prompts) {
      if (attempted >= CITATION_MAX_CHECKS_PER_RUN) {
        stopped = "cap_reached";
        break outer;
      }

      attempted += 1;
      const probe = await probeCitation({
        tenantId: tenant.tenantId,
        engine,
        prompt,
        hosts,
        ...(options.provider ? { provider: options.provider } : {}),
      });

      if (probe.status === "skipped") {
        const reason = describeSkip(probe.outcome);
        if (isTerminalSkip(probe.outcome)) {
          stopped = reason;
          break outer;
        }
        consecutiveTransient += 1;
        if (consecutiveTransient >= MAX_CONSECUTIVE_TRANSIENT) {
          stopped = reason;
          break outer;
        }
        continue;
      }

      consecutiveTransient = 0;
      checks.push({
        engine: probe.engine,
        prompt: probe.prompt,
        cited: probe.cited,
        citedUrl: probe.citedUrl,
        mentionText: probe.mentionText,
      });
    }
  }

  const recorded = await recordCitationChecks(tenant.tenantId, checks, now);

  return {
    tenantId: tenant.tenantId,
    engines: engines.map((engine) => engine.engine),
    prompts: prompts.length,
    attempted,
    recorded,
    cited: checks.filter((check) => check.cited).length,
    stopped,
    error: null,
  };
}

/**
 * The whole sweep: every entitled, connected store, one after another.
 *
 * SERIAL on purpose. Each store's pass holds a database connection while a
 * model thinks — up to twelve times — and running every store's at once would
 * make a weekly diagnostic the heaviest thing on the pool the storefront
 * shares.
 *
 * ONE STORE'S FAILURE DOES NOT STOP THE REST, and the catch is what makes that
 * true. `findCitationTenants` imposes an order, so an exception escaping this
 * loop would silently cost every store sorting after the broken one its checks
 * for the week — and a store that failed would be indistinguishable from a
 * store nobody cites, since both record nothing.
 *
 * Nothing is rethrown: the queue is configured `attempts: 1` precisely so a
 * half-finished sweep is not re-run, which would spend a second set of
 * completions on the stores that already succeeded.
 */
export async function runCitationSweep(
  now: Date = new Date(),
  options: CitationRunOptions = {},
): Promise<CitationSweepOutcome> {
  return bypassTenantScope(async () => {
    const tenants = await findCitationTenants();
    const perTenant: CitationTenantOutcome[] = [];

    for (const tenant of tenants) {
      try {
        perTenant.push(await runTenantCitationChecks(tenant, now, options));
      } catch (cause) {
        perTenant.push({
          ...NOTHING,
          tenantId: tenant.tenantId,
          error: cause instanceof Error ? cause.message : String(cause),
        });
      }
    }

    return {
      tenants: tenants.length,
      recorded: perTenant.reduce((total, outcome) => total + outcome.recorded, 0),
      perTenant,
    };
  });
}
