/**
 * SEO Supercharge US-024 — AI drafting for SEO fields, on the TENANT's own
 * Automatos AI account.
 *
 * The architecture is the cross-sell: there is no platform API key and no
 * platform-funded fallback in this PRD. A tenant who has not connected Automatos
 * gets `unavailable` and an invitation to connect — never a quietly-degraded
 * result billed to us. That is also why the credential read below touches ONLY
 * the `tenants.automatosApiKey` / `automatosAgentId` COLUMNS: any copies in
 * `tenants.settings` are dead (resolved in the Automatos-extras session, PRD
 * #236), and settings JSON is tenant-writable in the first place.
 *
 * The provider interface exists so that swapping or adding a provider is a
 * config change rather than surgery on every call site. Everything above it —
 * the result union, the contract, the rate limit — is provider-agnostic.
 *
 * WHAT THIS MODULE IS NOT: the gate. `canEditSeo` (member) and
 * `FEATURES.SEO_PRO` (tenant plan) are enforced by the route in US-025, before
 * anything here runs. This module assumes an authorised, entitled caller and
 * concerns itself with availability, metering and the output contract.
 */

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  AI_ASSIST_MAX_LENGTH,
  AUTOMATOS_CONNECT,
  buildAiAssistPrompt,
  parseAiDraft,
  type AiAssistKind,
  type AiAssistSource,
  type AiDraftRefusal,
  type AutomatosConnectPrompt,
} from "@/lib/seo/ai-assist-contract";
import {
  isAutomatosConfigured,
  requestAutomatosCompletion,
  type AutomatosCredentials,
} from "@/lib/seo/automatos-client";
import type { ProductQaPair } from "@/lib/seo/product-qa";
import {
  buildQaDraftPrompt,
  parseQaDraft,
  type QaDraftRefusal,
  type QaDraftSource,
} from "@/lib/seo/qa-draft";

export { isAutomatosConfigured, AUTOMATOS_CONNECT };
export type { AutomatosCredentials, AutomatosConnectPrompt };

/**
 * Per-TENANT metering, and fail-closed, because every call spends the tenant's
 * own Automatos quota and this sits one click from a write.
 *
 * 30 in 5 minutes is above what authoring looks like (two fields per entity, a
 * human reading each draft before saving) and well below what a loop looks like.
 * Keyed on the tenant rather than the member deliberately: the bill lands on the
 * tenant's workspace, so that is the thing being protected.
 */
export const AI_ASSIST_RATE_LIMIT = {
  maxRequests: 30,
  windowMs: 5 * 60_000,
} as const;

const RATE_LIMIT_PREFIX = "seo-ai-assist";

export type AiAssistErrorReason =
  | "auth"
  | "timeout"
  | "upstream"
  | "lookup_failed"
  | "rate_limiter_unavailable";

/**
 * The outcomes that are not a draft, named once because US-002's Q&A drafting
 * shares every one of them: the same credentials, the same meter, the same
 * provider, the same two ways for it to fail. Only the OK arm and the refusal
 * reason differ between the two contracts, which is exactly what the split says.
 */
export type AiAssistNoDraft =
  | { readonly status: "unavailable"; readonly reason: "not_connected"; readonly connect: AutomatosConnectPrompt }
  | { readonly status: "rate_limited"; readonly retryAfterSeconds?: number }
  | { readonly status: "error"; readonly reason: AiAssistErrorReason };

export type AiAssistResult =
  | { readonly status: "ok"; readonly kind: AiAssistKind; readonly text: string; readonly provider: string }
  | { readonly status: "refused"; readonly reason: AiDraftRefusal; readonly maxLength: number; readonly length?: number }
  | AiAssistNoDraft;

/** US-002 — the same union for a Q&A draft: a list of pairs, or one of the above. */
export type QaDraftResult =
  | { readonly status: "ok"; readonly pairs: readonly ProductQaPair[]; readonly provider: string }
  | { readonly status: "refused"; readonly reason: QaDraftRefusal }
  | AiAssistNoDraft;

/** One provider's completion call, stripped of everything provider-specific. */
export interface AiAssistProviderRequest {
  readonly credentials: AutomatosCredentials;
  readonly prompt: string;
  /**
   * LLM Visibility US-005 — which of the workspace's models should answer.
   * Absent means "whatever the tenant's agent defaults to", which is what every
   * caller before US-005 asked for and still asks for.
   */
  readonly modelId?: string | null;
}

export type AiAssistProviderResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly reason: AiAssistErrorReason | "rate_limited"; readonly retryAfterSeconds?: number };

export interface AiAssistProvider {
  /** Stable id, surfaced in the result and the US-025 audit row. */
  readonly id: string;
  /** Human-facing name, for the connect card and the button label. */
  readonly label: string;
  complete(request: AiAssistProviderRequest): Promise<AiAssistProviderResult>;
}

export const automatosProvider: AiAssistProvider = {
  id: "automatos",
  label: AUTOMATOS_CONNECT.provider,
  async complete(request) {
    const completion = await requestAutomatosCompletion({
      credentials: request.credentials,
      prompt: request.prompt,
      modelId: request.modelId ?? null,
    });
    return completion.ok
      ? { ok: true, text: completion.text }
      : { ok: false, reason: completion.reason, retryAfterSeconds: completion.retryAfterSeconds };
  },
};

/**
 * This tenant's stored Automatos credentials, or null when there are none.
 *
 * Throws on a query failure rather than returning null: "the database is down"
 * and "this tenant has not connected Automatos" are different answers, and
 * collapsing them shows a connected tenant a connect-your-account card that
 * would be a lie. The caller maps the throw to `lookup_failed`.
 *
 * `findFirst` on a flat field per repo convention, and the row is annotated
 * explicitly because the `prisma` export in lib/db.ts is any-widened by the
 * build-time mock Proxy — an inferred result trips TS7006.
 */
export async function loadAutomatosCredentials(
  tenantId: string,
): Promise<AutomatosCredentials | null> {
  const row: { automatosApiKey: string | null; automatosAgentId: number | null } | null =
    await prisma.tenants.findFirst({
      where: { id: tenantId },
      select: { automatosApiKey: true, automatosAgentId: true },
    });

  const apiKey = row?.automatosApiKey?.trim();
  if (!apiKey) return null;

  return { apiKey, agentId: row?.automatosAgentId ?? null };
}

/**
 * Has this tenant connected an Automatos account? For SERVER-RENDERED pages
 * (US-025), so the editor shows either generate buttons or the connect card,
 * without spending a generation or a rate-limit token to find out which.
 *
 * A LOOKUP FAILURE ANSWERS `true`, on purpose. This decides presentation only —
 * the route re-checks — and the two wrong answers are not equal: showing the
 * button costs a click that reports the real error, while showing the connect
 * card tells a tenant who HAS connected to go and connect, which is a lie they
 * would act on. Same reasoning as `loadAutomatosCredentials` refusing to collapse
 * "the database is down" into "not connected".
 */
export async function isAiAssistConnected(tenantId: string): Promise<boolean> {
  try {
    return isAutomatosConfigured(await loadAutomatosCredentials(tenantId));
  } catch {
    return true;
  }
}

export interface GenerateSeoDraftRequest {
  readonly tenantId: string;
  readonly kind: AiAssistKind;
  readonly source: AiAssistSource;
  /** Injectable for tests and for a future second provider. */
  readonly provider?: AiAssistProvider;
}

function unavailable(): AiAssistNoDraft {
  return { status: "unavailable", reason: "not_connected", connect: AUTOMATOS_CONNECT };
}

/**
 * Meter first, work second.
 *
 * The limit is charged before the credential lookup and before the provider
 * call, so it cannot be sidestepped by sending a request that fails early — an
 * unconfigured tenant hammering the button is still a loop against our database.
 * `failMode: 'closed'` means a Redis outage stops the path rather than opening
 * it: an unmetered flood against the tenant's paid AI account is the worse of
 * the two failures.
 */
async function checkAssistRateLimit(tenantId: string): Promise<AiAssistNoDraft | null> {
  const limit = await checkRateLimit(`${RATE_LIMIT_PREFIX}:${tenantId}`, {
    ...AI_ASSIST_RATE_LIMIT,
    failMode: "closed",
  });
  if (limit.success) return null;

  if (limit.response.status === 429) {
    const header = limit.response.headers.get("retry-after");
    const seconds = header ? Number.parseInt(header, 10) : Number.NaN;
    return {
      status: "rate_limited",
      ...(Number.isFinite(seconds) ? { retryAfterSeconds: seconds } : {}),
    };
  }

  // 503 — the limiter itself is down and chose to fail closed.
  return { status: "error", reason: "rate_limiter_unavailable" };
}

/**
 * Meter, resolve the tenant's credentials, ask the provider — everything both
 * contracts do identically, in the order they have to do it in.
 *
 * Returns the completion's raw text, or the outcome that stopped it. Factored so
 * that adding the Q&A contract (US-002) added an OUTPUT PARSER and nothing else:
 * one place still decides how a tenant's AI quota is spent, and a change to the
 * metering or the credential rule cannot apply to one caller and miss the other.
 *
 * EXPORTED FOR US-005's citation monitor, which is the first caller that is not
 * a draft: it needs this exact sequence — one meter, one credential rule, one
 * provider — and a completion the contract parsers must not touch, because the
 * answer being judged is prose from a search-grounded model rather than a field
 * being written. A parallel client would have been a second place deciding how
 * the tenant's account is spent; this is the one place, with one more caller.
 *
 * `modelId` is optional and defaults to the workspace's own default model.
 */
export async function runAiAssistCompletion(
  tenantId: string,
  provider: AiAssistProvider,
  prompt: string,
  modelId?: string | null,
): Promise<{ readonly ok: true; readonly text: string } | { readonly ok: false; readonly result: AiAssistNoDraft }> {
  const limited = await checkAssistRateLimit(tenantId);
  if (limited) return { ok: false, result: limited };

  let credentials: AutomatosCredentials | null;
  try {
    credentials = await loadAutomatosCredentials(tenantId);
  } catch (error) {
    logger.error("[seo/ai-assist] credential lookup failed", {
      tenantId,
      message: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, result: { status: "error", reason: "lookup_failed" } };
  }

  if (!isAutomatosConfigured(credentials)) {
    return { ok: false, result: unavailable() };
  }

  const completion = await provider.complete({ credentials, prompt, modelId });
  if (completion.ok) return { ok: true, text: completion.text };

  return {
    ok: false,
    result:
      completion.reason === "rate_limited"
        ? {
            status: "rate_limited",
            ...(completion.retryAfterSeconds !== undefined
              ? { retryAfterSeconds: completion.retryAfterSeconds }
              : {}),
          }
        : { status: "error", reason: completion.reason },
  };
}

/**
 * Draft one SEO field from one entity's own content.
 *
 * The prompt is built from `source` alone — a closed shape carrying this
 * entity's name, its body copy and the tenant's own store name. Nothing here
 * reads another tenant's rows, and there is no shared context, conversation or
 * cache between tenants: each call is a fresh completion against the tenant's
 * own workspace credentials.
 *
 * The returned draft has passed the contract in `./ai-assist-contract`; an
 * over-long or malformed answer comes back `refused`, never trimmed to fit.
 */
export async function generateSeoDraft(
  request: GenerateSeoDraftRequest,
): Promise<AiAssistResult> {
  const provider = request.provider ?? automatosProvider;

  const completion = await runAiAssistCompletion(
    request.tenantId,
    provider,
    buildAiAssistPrompt(request.kind, request.source),
  );
  if (!completion.ok) return completion.result;

  const draft = parseAiDraft(request.kind, completion.text);
  const maxLength = AI_ASSIST_MAX_LENGTH[request.kind];
  if (!draft.ok) {
    logger.info("[seo/ai-assist] draft refused", {
      tenantId: request.tenantId,
      kind: request.kind,
      reason: draft.reason,
    });
    return {
      status: "refused",
      reason: draft.reason,
      maxLength,
      ...(draft.length !== undefined ? { length: draft.length } : {}),
    };
  }

  return { status: "ok", kind: request.kind, text: draft.text, provider: provider.id };
}

export interface GenerateQaDraftRequest {
  readonly tenantId: string;
  /** The product's own copy, read server-side from the tenant's own row. */
  readonly source: QaDraftSource;
  /** Injectable for tests and for a future second provider. */
  readonly provider?: AiAssistProvider;
}

/**
 * LLM Visibility US-002 — draft a product's Q&A from that product's own copy.
 *
 * Everything that decides whether a call happens is `generateSeoDraft`'s: the
 * same per-tenant meter (so twenty Q&A drafts and twenty title drafts share one
 * budget — it is one AI account being spent either way), the same
 * tenant-owned-credentials rule, the same provider. What is different is the
 * answer we will accept, and that lives entirely in `./qa-draft`.
 *
 * The returned pairs are the model's, normalised but never edited: a list that
 * broke the contract comes back `refused` with no pairs at all, because a
 * partially-repaired list is one the owner would save believing a human wrote
 * every line of it.
 */
export async function generateQaDraft(
  request: GenerateQaDraftRequest,
): Promise<QaDraftResult> {
  const provider = request.provider ?? automatosProvider;

  const completion = await runAiAssistCompletion(
    request.tenantId,
    provider,
    buildQaDraftPrompt(request.source),
  );
  if (!completion.ok) return completion.result;

  const draft = parseQaDraft(completion.text);
  if (!draft.ok) {
    logger.info("[seo/ai-assist] qa draft refused", {
      tenantId: request.tenantId,
      reason: draft.reason,
    });
    return { status: "refused", reason: draft.reason };
  }

  return { status: "ok", pairs: draft.pairs, provider: provider.id };
}
