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
  buildAiAssistPrompt,
  parseAiDraft,
  type AiAssistKind,
  type AiAssistSource,
  type AiDraftRefusal,
} from "@/lib/seo/ai-assist-contract";
import {
  isAutomatosConfigured,
  requestAutomatosCompletion,
  type AutomatosCredentials,
} from "@/lib/seo/automatos-client";

export { isAutomatosConfigured };
export type { AutomatosCredentials };

/**
 * What a tenant without credentials is shown instead of a generate button.
 *
 * Distinct from the PLAN upsell (`lib/entitlements/upgrade.ts`): that one sells
 * Pro, this one points an already-Pro tenant at the field they have not filled
 * in. Confusing the two sends someone to a checkout page for something they have
 * already bought, so the shapes are deliberately separate.
 */
export interface AutomatosConnectPrompt {
  readonly provider: string;
  readonly headline: string;
  readonly body: string;
  readonly actionLabel: string;
  /** In-app, relative — the settings page that owns the two columns. */
  readonly settingsPath: string;
}

export const AUTOMATOS_CONNECT: AutomatosConnectPrompt = {
  provider: "Automatos AI",
  headline: "Connect Automatos AI",
  body: "AI drafting runs on your own Automatos AI account, so your product copy stays in your workspace. Add your API key to switch it on.",
  actionLabel: "Add your Automatos API key",
  settingsPath: "/tenant-admin/settings",
} as const;

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

export type AiAssistResult =
  | { readonly status: "ok"; readonly kind: AiAssistKind; readonly text: string; readonly provider: string }
  | { readonly status: "unavailable"; readonly reason: "not_connected"; readonly connect: AutomatosConnectPrompt }
  | { readonly status: "rate_limited"; readonly retryAfterSeconds?: number }
  | { readonly status: "refused"; readonly reason: AiDraftRefusal; readonly maxLength: number; readonly length?: number }
  | { readonly status: "error"; readonly reason: AiAssistErrorReason };

/** One provider's completion call, stripped of everything provider-specific. */
export interface AiAssistProviderRequest {
  readonly credentials: AutomatosCredentials;
  readonly prompt: string;
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

export interface GenerateSeoDraftRequest {
  readonly tenantId: string;
  readonly kind: AiAssistKind;
  readonly source: AiAssistSource;
  /** Injectable for tests and for a future second provider. */
  readonly provider?: AiAssistProvider;
}

function unavailable(): AiAssistResult {
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
async function checkAssistRateLimit(tenantId: string): Promise<AiAssistResult | null> {
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

  const limited = await checkAssistRateLimit(request.tenantId);
  if (limited) return limited;

  let credentials: AutomatosCredentials | null;
  try {
    credentials = await loadAutomatosCredentials(request.tenantId);
  } catch (error) {
    logger.error("[seo/ai-assist] credential lookup failed", {
      tenantId: request.tenantId,
      message: error instanceof Error ? error.message : String(error),
    });
    return { status: "error", reason: "lookup_failed" };
  }

  if (!isAutomatosConfigured(credentials)) return unavailable();

  const completion = await provider.complete({
    credentials,
    prompt: buildAiAssistPrompt(request.kind, request.source),
  });

  if (!completion.ok) {
    return completion.reason === "rate_limited"
      ? {
          status: "rate_limited",
          ...(completion.retryAfterSeconds !== undefined
            ? { retryAfterSeconds: completion.retryAfterSeconds }
            : {}),
        }
      : { status: "error", reason: completion.reason };
  }

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
