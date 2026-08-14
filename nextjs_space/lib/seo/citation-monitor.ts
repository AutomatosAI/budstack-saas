/**
 * LLM Visibility US-005 — the rules the AI citation monitor obeys, with no I/O
 * in sight.
 *
 * PURE AND BROWSER-SAFE, like `reorder-reminder.ts` and `ai-crawlers.ts`: the
 * dashboard tab needs the copy and the caps, the API route needs the same caps
 * to bound what it returns, and the sweep needs the prompt set. None of them
 * should drag Prisma or BullMQ in behind them — that half lives in
 * `citation-monitor-store.ts` and `citation-monitor-runner.ts`.
 *
 * WHAT THIS MEASURES, STATED HONESTLY (it is an acceptance criterion, not a
 * disclaimer): every row in this feature is what the TENANT'S OWN configured
 * model answered, with whatever retrieval that model's workspace has. It is not
 * ChatGPT, not Google's AI Overviews, and not any consumer app — those cannot
 * be queried from a server without impersonating a user, and none of them
 * publishes a citation API. So the honest claim is narrow and this module's copy
 * makes it: "your model, asked your market's questions, linked you or did not".
 * Nothing here may be phrased as a ranking, a score, or a trend in visibility.
 *
 * THE SPEND IS THE TENANT'S. Every check is a completion on the tenant's own
 * Automatos workspace (`lib/seo/ai-assist.ts`), so the caps below are a bill
 * as much as a budget — see {@link CITATION_MAX_CHECKS_PER_RUN}.
 */

/** The job the repeatable scheduler produces, and the worker listens for. */
export const LLM_CITATION_JOB = "llm-citation-sweep";

/**
 * The scheduler's id. STABLE AND FIXED, which is what makes registration
 * idempotent: `upsertJobScheduler` keys on this string, so every worker in a
 * scaled-out deployment registering the same id on boot converges on ONE
 * scheduler rather than N of them producing N sweeps a week.
 */
export const LLM_CITATION_SCHEDULER_ID = "llm-citation-weekly";

/**
 * Mondays at 04:00 UTC.
 *
 * WEEKLY rather than daily, and the reason is cost, not caution: each run
 * spends up to {@link CITATION_MAX_CHECKS_PER_RUN} model completions on the
 * tenant's own account, and the thing being measured moves on the timescale of
 * a site's content, not a day. A fixed hour rather than an interval so restarts
 * do not walk the run around the clock, and an off-peak one because the sweep
 * holds a connection per store while a model thinks.
 */
export const LLM_CITATION_CRON = "0 4 * * 1";

/** Prompts asked per tenant per run — the market questions below, capped. */
export const CITATION_MAX_PROMPTS_PER_RUN = 6;

/**
 * Distinct models asked per tenant per run.
 *
 * Two, not "all of them": the workspace may enable a dozen, and this is a
 * weekly diagnostic rather than a benchmark. Which two is decided by
 * `citation-engine.ts` from the order the workspace returns them in, so a
 * tenant who reorders their models changes what is asked — deliberately, since
 * the first-listed model is the one their widget actually answers on.
 */
export const CITATION_MAX_ENGINES_PER_RUN = 2;

/**
 * The hard ceiling on completions per tenant per run: 6 x 2.
 *
 * Stated as its own constant because it is the number that matters to a store
 * owner — it is their AI account being spent, roughly a dozen short completions
 * a week — and because the sweep asserts against it rather than against the two
 * factors separately.
 */
export const CITATION_MAX_CHECKS_PER_RUN =
  CITATION_MAX_PROMPTS_PER_RUN * CITATION_MAX_ENGINES_PER_RUN;

/**
 * The engine label used when the workspace does not expose a model list.
 *
 * NOT A VENDOR NAME, and that is the rule: labels are model ids the workspace
 * itself returned, never a guess at who is behind them. When there is no list
 * to vary across, the run asks the agent's default model and says exactly that.
 */
export const CITATION_DEFAULT_ENGINE = "workspace-default";

/** How much of the answer around a link is kept as evidence. */
export const CITATION_MENTION_MAX_CHARS = 300;

/** Rows the dashboard reads. Ten weeks of two engines, give or take. */
export const CITATION_HISTORY_LIMIT = 120;

/**
 * The store's market, as the prompt builder needs it. Every field comes off the
 * tenant's own rows — there is no shared or cross-tenant context anywhere in
 * this feature.
 */
export interface CitationMarket {
  /** Display country: `businessCountry` if set, else the `countryCode`. */
  readonly country: string;
  /** Condition names the store publishes pages for. */
  readonly conditions: readonly string[];
  /** Product categories the store sells. */
  readonly categories: readonly string[];
}

/** The country a patient would name, from the two columns that can carry one. */
export function resolveCitationCountry(tenant: {
  readonly businessCountry?: unknown;
  readonly countryCode?: unknown;
}): string {
  const named =
    typeof tenant.businessCountry === "string" ? tenant.businessCountry.trim() : "";
  if (named) return named;
  const code =
    typeof tenant.countryCode === "string" ? tenant.countryCode.trim() : "";
  return code || "Europe";
}

/** Trim, drop empties, dedupe case-insensitively, keep the given order. */
function cleanTopics(values: readonly string[], limit: number): string[] {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const value of values) {
    const topic = typeof value === "string" ? value.trim() : "";
    if (!topic) continue;
    const key = topic.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(topic);
    if (kept.length >= limit) break;
  }
  return kept;
}

/**
 * The questions this store's market actually asks, in the framing that gets
 * answered.
 *
 * MEDICAL-INFORMATION FRAMING IS DELIBERATE, and the rationale is engine
 * content policy rather than style. Every major model applies a restricted-goods
 * policy to cannabis: a bare commercial prompt ("where can I buy cannabis in
 * Portugal") is the shape most likely to be refused outright or answered with a
 * safety notice and no links, which would make every row in this feature a
 * false negative about the store rather than a fact about it. The prompts below
 * ask what a PATIENT asks — legal access, treatment for a condition, what a
 * product category is for — which is both the real query behind the traffic and
 * the shape a model will answer with sources. A refusal then means the model
 * refused, not that the framing invited it.
 *
 * DETERMINISTIC AND ORDERED, so week-over-week rows compare: the same store
 * with the same catalogue asks the same questions in the same order, and a
 * change in the results is a change in the answers rather than in the questions.
 *
 * Returns at most {@link CITATION_MAX_PROMPTS_PER_RUN}; a store with no
 * conditions and no categories still gets the two access questions, which are
 * the ones every store's market asks.
 */
export function buildCitationPrompts(market: CitationMarket): readonly string[] {
  const country = market.country.trim() || "Europe";
  const conditions = cleanTopics(market.conditions, 3);
  const categories = cleanTopics(market.categories, 2);

  const prompts = [
    `How does a patient legally access medical cannabis in ${country}, and which licensed providers or clinics can they be referred to?`,
    ...conditions.map(
      (condition) =>
        `Which medical cannabis providers in ${country} treat patients with ${condition}, and what does the referral process involve?`,
    ),
    ...categories.map(
      (category) =>
        `What should a patient in ${country} know about ${category} medical cannabis products, and which licensed suppliers dispense them?`,
    ),
    `Which medical cannabis clinics or dispensaries serving ${country} publish prescribing information and product details online?`,
  ];

  return prompts.slice(0, CITATION_MAX_PROMPTS_PER_RUN);
}

/**
 * The dashboard's copy, in one place so the tab and any future surface cannot
 * come to describe this feature differently.
 *
 * Every sentence is bounded by what the data supports. `caveat` is not
 * decoration — it is the acceptance criterion that this feature never promises
 * a ranking — and it renders on the tab itself, not behind a tooltip.
 */
export const CITATION_MONITOR_COPY = {
  headline: "AI citation monitor",
  body: "Once a week your own Automatos model is asked the questions your market asks, and we record whether its answer linked to your store.",
  caveat:
    "This measures what YOUR configured model answers, on your own Automatos account. It is not ChatGPT, Google AI Overviews or any consumer app, and it is not a ranking — no tool can see inside those products, and anything claiming to would be guessing.",
  spendNote:
    "Each weekly run costs up to a dozen short completions on your own Automatos workspace.",
  emptyHeadline: "No checks yet",
  emptyBody:
    "The first run happens on the next weekly sweep. Results appear here per model, newest first.",
} as const;

/** One recorded observation, as every surface above the database sees it. */
export interface CitationCheckRow {
  readonly id: string;
  /** The model id that answered, or `workspace-default`. Never a vendor guess. */
  readonly engine: string;
  readonly prompt: string;
  readonly cited: boolean;
  readonly citedUrl: string | null;
  readonly mentionText: string | null;
  /** ISO 8601 — a STRING across the server/client boundary, never a Date. */
  readonly checkedAt: string;
}

/** One weekly run's result for one model — the unit the trend is drawn from. */
export interface CitationRun {
  /** ISO 8601. Every row a sweep wrote shares one instant, so this is the run. */
  readonly checkedAt: string;
  readonly checks: number;
  readonly cited: number;
}

/** Runs shown per model. Ten weeks is a trend; a year is a spreadsheet. */
export const CITATION_RUNS_SHOWN = 10;

/** One model's tally, which is the whole of what the dashboard claims. */
export interface CitationEngineSummary {
  readonly engine: string;
  readonly checks: number;
  readonly cited: number;
  /** Newest first, capped at {@link CITATION_RUNS_SHOWN}. */
  readonly runs: readonly CitationRun[];
  /** The most recent answer that linked the store, if there is one. */
  readonly latestMention: CitationCheckRow | null;
  /** ISO 8601 of the newest row for this model. */
  readonly lastCheckedAt: string | null;
}

/**
 * Group rows by the model that answered them, and by the run within that.
 *
 * Pure, and shared by every surface, so the tab cannot total one thing while
 * another surface totals something else. Input order is assumed newest-first
 * (the route's `orderBy`), which is what makes "latest" mean latest rather than
 * first-seen; engines and runs come out in the order they are first met, so a
 * stable read produces a stable table.
 *
 * A RUN IS A `checkedAt`, exactly — the sweep writes one instant across every
 * row it produced (`recordCitationChecks`), which is what makes grouping on it
 * a grouping by weekly run rather than by the minute a model happened to reply.
 */
export function summariseCitationChecks(
  rows: readonly CitationCheckRow[],
): readonly CitationEngineSummary[] {
  const order: string[] = [];
  const totals = new Map<string, { checks: number; cited: number }>();
  const mentions = new Map<string, CitationCheckRow>();
  const lastSeen = new Map<string, string>();
  const runOrder = new Map<string, string[]>();
  const runTotals = new Map<string, { checks: number; cited: number }>();

  for (const row of rows) {
    if (!totals.has(row.engine)) {
      order.push(row.engine);
      totals.set(row.engine, { checks: 0, cited: 0 });
      runOrder.set(row.engine, []);
      if (row.checkedAt) lastSeen.set(row.engine, row.checkedAt);
    }

    const total = totals.get(row.engine)!;
    totals.set(row.engine, {
      checks: total.checks + 1,
      cited: total.cited + (row.cited ? 1 : 0),
    });

    if (row.cited && !mentions.has(row.engine)) mentions.set(row.engine, row);

    const runKey = `${row.engine} ${row.checkedAt}`;
    const run = runTotals.get(runKey);
    if (!run) {
      runOrder.get(row.engine)!.push(row.checkedAt);
      runTotals.set(runKey, { checks: 1, cited: row.cited ? 1 : 0 });
    } else {
      runTotals.set(runKey, {
        checks: run.checks + 1,
        cited: run.cited + (row.cited ? 1 : 0),
      });
    }
  }

  return order.map((engine) => {
    const total = totals.get(engine)!;
    return {
      engine,
      checks: total.checks,
      cited: total.cited,
      runs: (runOrder.get(engine) ?? [])
        .slice(0, CITATION_RUNS_SHOWN)
        .map((checkedAt) => {
          const run = runTotals.get(`${engine} ${checkedAt}`)!;
          return { checkedAt, checks: run.checks, cited: run.cited };
        }),
      latestMention: mentions.get(engine) ?? null,
      lastCheckedAt: lastSeen.get(engine) ?? null,
    };
  });
}
