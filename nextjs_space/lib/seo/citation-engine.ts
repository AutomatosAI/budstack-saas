/**
 * LLM Visibility US-005 — asking one model one question, and reading the answer
 * for a link to the store.
 *
 * REUSE, NOT A SECOND CLIENT. Every call goes through
 * `runAiAssistCompletion` — the same per-tenant meter, the same
 * tenant-owned-credentials rule, the same provider and the same `unavailable`
 * state that AI drafting uses. A tenant who has not connected Automatos gets
 * that state here too, which is what makes the monitor tab a cross-sell surface
 * rather than an error screen (US-005 AC 5).
 *
 * WHAT IS DIFFERENT FROM A DRAFT is the answer we will accept. A draft is
 * parsed against a contract and refused when it breaks it; a citation check
 * takes the model's prose EXACTLY as written and asks one question of it — is
 * one of this store's hosts in there. There is nothing to refuse: an answer
 * that never mentions the store is the most common correct result this feature
 * has, and recording it is the baseline the dashboard's tally is measured
 * against.
 *
 * THE SHARED METER IS A DELIBERATE TRADE, stated so the next reader does not
 * have to rediscover it: a weekly run spends up to
 * `CITATION_MAX_CHECKS_PER_RUN` (12) of the 30-per-5-minutes budget that the
 * Generate buttons also draw on, so an owner drafting during the few minutes
 * their sweep runs could be told to wait. A second meter would have been a
 * second place deciding how one AI account is spent, which is the failure the
 * ai-assist module was factored to avoid. The sweep degrades gracefully either
 * way: a rate-limited check records nothing and the next weekly run asks again.
 */

import {
  runAiAssistCompletion,
  automatosProvider,
  type AiAssistNoDraft,
  type AiAssistProvider,
} from "@/lib/seo/ai-assist";
import {
  requestAutomatosWidgetModels,
  type AutomatosCredentials,
  type AutomatosWidgetModels,
} from "@/lib/seo/automatos-client";
import { findCitation } from "@/lib/seo/citation-match";
import {
  CITATION_DEFAULT_ENGINE,
  CITATION_MAX_ENGINES_PER_RUN,
} from "@/lib/seo/citation-monitor";

/** One model to ask, as the sweep holds it. */
export interface CitationEngine {
  /**
   * The label stored on every row. A model id the WORKSPACE returned, or
   * {@link CITATION_DEFAULT_ENGINE} — never a vendor name invented here.
   */
  readonly engine: string;
  /** Sent as `model_id`; null asks the agent's own default model. */
  readonly modelId: string | null;
}

/** The workspace default, as a one-engine list. The specified fallback. */
const DEFAULT_ENGINES: readonly CitationEngine[] = [
  { engine: CITATION_DEFAULT_ENGINE, modelId: null },
];

/**
 * The workspace-model lookup, as a type, so the sweep can be driven without a
 * network — the same reason every function here takes an optional `provider`.
 */
export type DiscoverModels = (request: {
  readonly credentials: AutomatosCredentials;
}) => Promise<AutomatosWidgetModels>;

/**
 * Which models this run will ask.
 *
 * MULTI-MODEL ONLY WHERE THE WORKSPACE PERMITS IT. The tenant's own Automatos
 * config is asked what it exposes (`requestAutomatosWidgetModels`, which
 * documents exactly what the published spec does and does not promise). If it
 * names models, the first {@link CITATION_MAX_ENGINES_PER_RUN} are asked
 * individually so the dashboard can show a row per model. If it names none —
 * the likely case, and every failure case — this returns the single
 * workspace-default engine, and the tab says the answering model was the
 * workspace default rather than pretending to know which one it was.
 *
 * `discover` is injectable so the sweep's behaviour is testable without a
 * network or a credential.
 */
export async function resolveCitationEngines(
  credentials: AutomatosCredentials,
  discover: DiscoverModels = requestAutomatosWidgetModels,
): Promise<readonly CitationEngine[]> {
  const result = await discover({ credentials });
  if (!result.ok || result.models.length === 0) return DEFAULT_ENGINES;

  const engines = result.models
    .slice(0, CITATION_MAX_ENGINES_PER_RUN)
    .map((modelId) => ({ engine: modelId, modelId }));

  return engines.length > 0 ? engines : DEFAULT_ENGINES;
}

/** What one check produced: an observation, or the reason there is none. */
export type CitationProbeResult =
  | {
      readonly status: "ok";
      readonly engine: string;
      readonly prompt: string;
      readonly cited: boolean;
      readonly citedUrl: string | null;
      readonly mentionText: string | null;
    }
  | { readonly status: "skipped"; readonly outcome: AiAssistNoDraft };

export interface CitationProbeRequest {
  readonly tenantId: string;
  readonly engine: CitationEngine;
  readonly prompt: string;
  /** Every host that IS this store — see `citation-match.ts`. */
  readonly hosts: readonly string[];
  /** Injectable for tests and for a future second provider. */
  readonly provider?: AiAssistProvider;
}

/**
 * Ask one model one question and record what its answer did with the store.
 *
 * A `skipped` result is never written to the database: "the tenant's key was
 * rejected" and "the model did not mention the store" are opposite facts, and a
 * row that could not tell them apart would make the dashboard's tally a lie.
 * The sweep reports skips in its outcome instead, where the worker prints them.
 */
export async function probeCitation(
  request: CitationProbeRequest,
): Promise<CitationProbeResult> {
  const completion = await runAiAssistCompletion(
    request.tenantId,
    request.provider ?? automatosProvider,
    request.prompt,
    request.engine.modelId,
  );

  if (!completion.ok) {
    return { status: "skipped", outcome: completion.result };
  }

  const match = findCitation(completion.text, request.hosts);
  return {
    status: "ok",
    engine: request.engine.engine,
    prompt: request.prompt,
    cited: match.cited,
    citedUrl: match.citedUrl,
    mentionText: match.mentionText,
  };
}
