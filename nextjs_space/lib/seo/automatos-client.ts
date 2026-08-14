/**
 * SEO Supercharge US-024 — the server-side wire to Automatos AI.
 *
 * WHAT THE SPIKE FOUND (2026-08-14, verified against the live API and its
 * published OpenAPI document at `https://api.automatos.app/openapi.json`):
 *
 *  - There is no SEO or completions endpoint a widget key can reach. The 664
 *    documented paths include `/api/chat`, but that one authenticates as a
 *    platform USER; the only surface a tenant's `automatosApiKey` opens is
 *    `/api/widgets/*`. So the completion channel is the chat endpoint.
 *  - `POST /api/widgets/auth` is documented as "Body sent by a BACKEND SERVER to
 *    obtain a browser-safe session token" — server-side use is the intended
 *    shape, not a workaround. Body `{api_key}`, response
 *    `{session_token, expires_at, permissions, workspace_id}`.
 *  - `POST /api/widgets/chat` takes `{message, agent_id?, model_id?,
 *    conversation_id?}` with `Authorization: Bearer <token>` and replies with an
 *    SSE stream: `message` frames carry `data.content` deltas, `done` carries
 *    `data.conversation_id`, `error` carries `data.message`.
 *  - Keys beginning `ak_pub_` are public and are sent straight as the bearer
 *    (this is what `public/automatos-widget.js` does in the browser); anything
 *    else is a secret key and must be exchanged first.
 *  - Failures are FastAPI-shaped `{"detail": "..."}`. An invalid key returns 401
 *    from both endpoints; rate limiting returns 429 with `Retry-After`.
 *  - Rejection round-trip measured at ~0.15–0.28s from this machine, so the
 *    timeout below is sized for model latency, not network latency.
 *
 * `agent_id` is a STRING on the wire while `tenants.automatosAgentId` is an
 * `Int?` — the conversion happens here so no caller has to remember it.
 *
 * SECRETS: `apiKey` is a stored tenant credential. It appears in exactly one
 * place — the Authorization header / auth body — and never in a log line, an
 * error message, or a returned value. Nothing in this module logs the request
 * body.
 */

import { logger } from "@/lib/logger";

/** The documented production host. Overridable for a staging Automatos tenant. */
export const AUTOMATOS_API_BASE_URL =
  process.env.AUTOMATOS_API_URL || "https://api.automatos.app";

/** Keys with this prefix are browser-safe and skip the session exchange. */
const PUBLIC_KEY_PREFIX = "ak_pub_";

/**
 * Whole-operation budget: session exchange + chat request + stream drain.
 *
 * A model completion is seconds, not milliseconds, so this cannot be the 5s an
 * ordinary JSON call gets. It is still bounded — the caller is an admin waiting
 * on a button, and a request that has not produced a draft in 20 seconds is
 * better reported as slow than left hanging.
 */
export const AUTOMATOS_TIMEOUT_MS = 20_000;

/**
 * Stop draining after this much text. A compliant answer is under 200
 * characters; anything approaching this is a model that ignored the contract and
 * will be refused by `parseAiDraft` regardless, so there is no reason to hold a
 * runaway stream in memory to find that out.
 */
const MAX_COMPLETION_CHARS = 4_000;

export interface AutomatosCredentials {
  /** `tenants.automatosApiKey`. Never logged, never returned. */
  readonly apiKey: string;
  /** `tenants.automatosAgentId` — Int in the column, string on the wire. */
  readonly agentId?: number | null;
}

export type AutomatosFailureReason =
  | "auth"
  | "rate_limited"
  | "timeout"
  | "upstream";

export type AutomatosCompletion =
  | { readonly ok: true; readonly text: string }
  | {
      readonly ok: false;
      readonly reason: AutomatosFailureReason;
      readonly retryAfterSeconds?: number;
      readonly status?: number;
    };

export interface AutomatosCompletionRequest {
  readonly credentials: AutomatosCredentials;
  /** The fully-built prompt. This module never composes one. */
  readonly prompt: string;
  /**
   * LLM Visibility US-005 — `model_id` on the widget chat wire, confirmed in
   * the published OpenAPI document (`WidgetChatRequest.model_id`, optional
   * string) and in what the shipped browser SDK sends. Omitted entirely when
   * absent, so the workspace's own default answers — which is what every caller
   * before US-005 relied on.
   *
   * The value is a model id the WORKSPACE returned, never a vendor name this
   * platform invented: see `requestAutomatosWidgetModels`.
   */
  readonly modelId?: string | null;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
}

/** True when this tenant has enough stored to attempt a call at all. */
export function isAutomatosConfigured(
  credentials: AutomatosCredentials | null | undefined,
): credentials is AutomatosCredentials {
  return typeof credentials?.apiKey === "string" && credentials.apiKey.trim().length > 0;
}

/**
 * Remove the caller's own credentials from a string before it is logged.
 *
 * Upstream error bodies are not ours and can quote back what was sent — the live
 * API's 401 body is literally about the key it rejected. `lib/security/redact.ts`
 * cannot help here: it redacts by FIELD NAME, and this is a free-text blob. So
 * the values are scrubbed by identity, which is exact and cannot over-match.
 */
type Scrub = (text: string) => string;

function makeScrub(...secrets: readonly (string | undefined)[]): Scrub {
  const present = secrets.filter(
    (secret): secret is string => typeof secret === "string" && secret.length > 0,
  );
  return (text) =>
    present.reduce((scrubbed, secret) => scrubbed.split(secret).join("[REDACTED]"), text);
}

function retryAfterFrom(response: Response): number | undefined {
  const header = response.headers.get("retry-after");
  if (!header) return undefined;
  const seconds = Number.parseInt(header, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined;
}

/**
 * Map an unsuccessful HTTP response onto a reason, without reading its body into
 * anything the caller can surface: the upstream `{"detail": "..."}` goes to our
 * own log (through {@link makeScrub}) and is dropped from the result. A
 * provider's error prose is not a message a store owner can act on, and
 * forwarding it verbatim is how internals leak into a UI.
 */
async function failureFrom(
  response: Response,
  stage: "auth" | "chat",
  scrub: Scrub,
): Promise<AutomatosCompletion> {
  const detail = await response.text().catch(() => "");
  logger.warn("[seo/ai-assist] automatos request failed", {
    stage,
    status: response.status,
    detail: scrub(detail).slice(0, 200),
  });

  if (response.status === 401 || response.status === 403) {
    return { ok: false, reason: "auth", status: response.status };
  }
  if (response.status === 429) {
    return {
      ok: false,
      reason: "rate_limited",
      status: 429,
      retryAfterSeconds: retryAfterFrom(response),
    };
  }
  return { ok: false, reason: "upstream", status: response.status };
}

/**
 * The `Authorization` value for a chat call: the key itself when it is public,
 * otherwise a freshly exchanged session token.
 *
 * No token cache. The browser SDK caches in `sessionStorage` because it holds
 * one user's session; a server cache would be a shared map keyed by tenant
 * credential, which is a cross-tenant mix-up waiting to happen for the sake of
 * ~150ms on a button click that already costs seconds.
 */
async function resolveAuthorization(
  baseUrl: string,
  apiKey: string,
  signal: AbortSignal,
  scrub: Scrub,
): Promise<{ ok: true; header: string } | AutomatosCompletion> {
  if (apiKey.startsWith(PUBLIC_KEY_PREFIX)) {
    return { ok: true, header: `Bearer ${apiKey}` };
  }

  const response = await fetch(`${baseUrl}/api/widgets/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
    cache: "no-store",
    signal,
  });

  if (!response.ok) return failureFrom(response, "auth", scrub);

  const session: unknown = await response.json().catch(() => null);
  const token =
    typeof session === "object" && session !== null
      ? (session as Record<string, unknown>).session_token
      : undefined;

  if (typeof token !== "string" || !token) {
    logger.warn("[seo/ai-assist] automatos auth returned no session token");
    return { ok: false, reason: "upstream", status: response.status };
  }

  return { ok: true, header: `Bearer ${token}` };
}

interface SseFrame {
  readonly event: string;
  readonly data: Record<string, unknown>;
}

/**
 * Parse one `\n\n`-delimited SSE frame. `data:` lines that are not JSON are
 * treated as raw content, matching what the shipped browser SDK does with them
 * (`public/automatos-widget.js`) — the provider streams bare text deltas in some
 * modes, and dropping them would silently lose half a sentence.
 */
function parseFrame(frame: string): SseFrame | null {
  let event = "message";
  let data: Record<string, unknown> | null = null;

  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (!line.startsWith("data:")) continue;

    const payload = line.slice(5).trim();
    if (!payload) continue;
    try {
      const parsed: unknown = JSON.parse(payload);
      data =
        typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : { content: payload };
    } catch {
      data = { content: payload };
    }
  }

  return data ? { event, data } : null;
}

/**
 * Drain the SSE body into the assistant's full answer.
 *
 * Ends on `done`, on an `error` frame, on end-of-stream, or at
 * {@link MAX_COMPLETION_CHARS}. Tool frames are ignored: this path asks for one
 * short string and has no tool results to render.
 */
async function readCompletionStream(
  body: ReadableStream<Uint8Array>,
  scrub: Scrub,
): Promise<AutomatosCompletion> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";

  const consume = (frame: string): AutomatosCompletion | null => {
    const parsed = parseFrame(frame);
    if (!parsed) return null;

    if (parsed.event === "error") {
      const message = parsed.data.message;
      logger.warn("[seo/ai-assist] automatos stream error frame", {
        detail: typeof message === "string" ? scrub(message).slice(0, 200) : undefined,
      });
      return { ok: false, reason: "upstream" };
    }
    if (parsed.event === "done") return { ok: true, text };
    if (parsed.event === "message" && typeof parsed.data.content === "string") {
      text += parsed.data.content;
      if (text.length >= MAX_COMPLETION_CHARS) return { ok: true, text };
    }
    return null;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      // The trailing element is whatever arrived after the last blank line — an
      // incomplete frame — and stays in the buffer until the rest of it lands.
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        if (!frame.trim()) continue;
        const finished = consume(frame);
        if (finished) return finished;
      }
    }

    // A stream that ended without `done` still delivered whatever it delivered;
    // the trailing partial frame is worth one last look.
    if (buffer.trim()) consume(buffer);
    return { ok: true, text };
  } finally {
    reader.releaseLock();
  }
}

/**
 * One completion from the tenant's own Automatos workspace.
 *
 * Never throws for an expected failure — auth, rate limit, timeout and upstream
 * all come back as a typed result, because the caller has to render each of them
 * differently and an exception would flatten them into "something went wrong".
 */
export async function requestAutomatosCompletion(
  request: AutomatosCompletionRequest,
): Promise<AutomatosCompletion> {
  const baseUrl = (request.baseUrl || AUTOMATOS_API_BASE_URL).replace(/\/$/, "");
  const { apiKey } = request.credentials;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    request.timeoutMs ?? AUTOMATOS_TIMEOUT_MS,
  );
  let scrub = makeScrub(apiKey);

  try {
    const auth = await resolveAuthorization(baseUrl, apiKey, controller.signal, scrub);
    if (!("header" in auth)) return auth;

    // Everything logged from here also hides the minted session token.
    scrub = makeScrub(apiKey, auth.header.slice("Bearer ".length));

    const agentId = request.credentials.agentId;
    const response = await fetch(`${baseUrl}/api/widgets/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: auth.header,
      },
      body: JSON.stringify({
        message: request.prompt,
        ...(typeof agentId === "number" ? { agent_id: String(agentId) } : {}),
        ...(request.modelId ? { model_id: request.modelId } : {}),
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) return failureFrom(response, "chat", scrub);
    if (!response.body) return { ok: false, reason: "upstream", status: response.status };

    return await readCompletionStream(response.body, scrub);
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, reason: "timeout" };
    logger.error("[seo/ai-assist] automatos request threw", {
      message: scrub(error instanceof Error ? error.message : String(error)),
    });
    return { ok: false, reason: "upstream" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * An ordinary JSON round trip, not a model completion — sized accordingly.
 */
export const AUTOMATOS_CONFIG_TIMEOUT_MS = 5_000;

/** Enough to choose from; the caller asks at most two of them. */
const MAX_ADVERTISED_MODELS = 12;

export type AutomatosWidgetModels =
  | { readonly ok: true; readonly models: readonly string[] }
  | { readonly ok: false; readonly reason: AutomatosFailureReason };

/**
 * WHAT THE SPEC SAYS AND WHAT IT DOES NOT (verified 2026-08-14 against the
 * published OpenAPI document, 664 paths):
 *
 *  - `GET /api/widgets/config` is documented as "Return the public widget
 *    config for the authenticated workspace. Works for both public keys (raw
 *    API key) and server-key JWTs since both route through `widget_auth`" — so
 *    it is reachable with exactly the credentials this tenant already stored,
 *    and it is the ONLY workspace-scoped discovery surface a widget key opens.
 *    (`/api/models/` exists but authenticates as a platform USER, like
 *    `/api/chat` — outside what a tenant's key can reach.)
 *  - Its response is `{workspace_id, config}` where `config` is declared
 *    `additionalProperties: true` WITH NO DECLARED KEYS. The spec therefore does
 *    not promise a model list, and no live key exists on this machine to
 *    discover one.
 *
 * So this reads OPTIMISTICALLY AND FAILS TO NOTHING: the three key names below
 * are the plausible ones, each accepted as strings or as objects carrying an
 * id, and ANY other shape — including the likely one, a config with no models
 * in it at all — returns an empty list. An empty list is not an error: the
 * caller then asks the workspace's default model as a single engine, which is
 * US-005's specified fallback. Nothing about this call can make a run fail.
 */
export async function requestAutomatosWidgetModels(request: {
  readonly credentials: AutomatosCredentials;
  readonly baseUrl?: string;
  readonly timeoutMs?: number;
}): Promise<AutomatosWidgetModels> {
  const baseUrl = (request.baseUrl || AUTOMATOS_API_BASE_URL).replace(/\/$/, "");
  const { apiKey } = request.credentials;
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    request.timeoutMs ?? AUTOMATOS_CONFIG_TIMEOUT_MS,
  );
  let scrub = makeScrub(apiKey);

  try {
    const auth = await resolveAuthorization(baseUrl, apiKey, controller.signal, scrub);
    if (!("header" in auth)) {
      return { ok: false, reason: auth.ok ? "upstream" : auth.reason };
    }

    scrub = makeScrub(apiKey, auth.header.slice("Bearer ".length));

    const response = await fetch(`${baseUrl}/api/widgets/config`, {
      headers: { Accept: "application/json", Authorization: auth.header },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      const failure = await failureFrom(response, "auth", scrub);
      return { ok: false, reason: failure.ok ? "upstream" : failure.reason };
    }

    const body: unknown = await response.json().catch(() => null);
    return { ok: true, models: readModelIds(body) };
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, reason: "timeout" };
    logger.error("[seo/ai-assist] automatos config request threw", {
      message: scrub(error instanceof Error ? error.message : String(error)),
    });
    return { ok: false, reason: "upstream" };
  } finally {
    clearTimeout(timer);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** A model id from a string entry or from an object that carries one. */
function modelIdFrom(entry: unknown): string | null {
  if (typeof entry === "string") return entry.trim() || null;

  const record = asRecord(entry);
  if (!record) return null;

  for (const key of ["model_id", "id", "model", "name"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Model ids advertised by the workspace config, or none. See the caller. */
function readModelIds(body: unknown): readonly string[] {
  const config = asRecord(asRecord(body)?.config);
  if (!config) return [];

  const list = ["models", "enabled_models", "available_models"]
    .map((key) => config[key])
    .find((value): value is unknown[] => Array.isArray(value));
  if (!list) return [];

  const seen = new Set<string>();
  for (const entry of list) {
    const id = modelIdFrom(entry);
    if (id) seen.add(id);
    if (seen.size >= MAX_ADVERTISED_MODELS) break;
  }
  return [...seen];
}
