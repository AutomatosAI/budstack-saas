import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// SEO Supercharge US-024 — AI drafting on the tenant's own Automatos account.
//
// The four properties this file exists to hold:
//
//  1. THE CONTRACT IS A REFUSAL, NOT A TRIM. A draft over its limit comes back
//     `refused` with no text at all. Nothing in the result can be pasted into a
//     field, because a clipped sentence in a search result is worse than a
//     second click.
//  2. NO CREDENTIALS IS NOT AN ERROR. It is `unavailable` plus the connect
//     prompt — and it never reaches the provider, so there is no platform-key
//     fallback to accidentally fall into.
//  3. THE PROMPT CARRIES THIS TENANT'S CONTENT AND NOTHING ELSE. Asserted by
//     construction: the builder is given a closed source shape and the output is
//     checked for the absence of anything not on it.
//  4. THE SECRET STAYS PUT. The api key reaches exactly one place — the wire —
//     and appears in no log line and no returned value on any path.
//
// The transport is exercised against a stubbed `fetch` speaking real SSE frames,
// so the session exchange, the public-key shortcut, chunk reassembly and the
// 401/429 mappings all run for real rather than being taken on trust.

const prismaMock = vi.hoisted(() => ({
  tenants: { findFirst: vi.fn() },
}));
const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const loggerMock = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit }));
vi.mock("@/lib/logger", () => ({ logger: loggerMock }));

import {
  AI_ASSIST_KINDS,
  AI_ASSIST_MAX_LENGTH,
  AI_ASSIST_SOURCE_MAX_CHARS,
  buildAiAssistPrompt,
  parseAiDraft,
  type AiAssistSource,
} from "@/lib/seo/ai-assist-contract";
import {
  isAutomatosConfigured,
  requestAutomatosCompletion,
} from "@/lib/seo/automatos-client";
import {
  AI_ASSIST_RATE_LIMIT,
  AUTOMATOS_CONNECT,
  automatosProvider,
  generateSeoDraft,
  loadAutomatosCredentials,
  type AiAssistProvider,
} from "@/lib/seo/ai-assist";

const TENANT_A = "tenant-a";
const SECRET_KEY = "ak_sec_tenant_a_key";
const PUBLIC_KEY = "ak_pub_tenant_a_key";
const SESSION_TOKEN = "session-token-abc";
const BASE_URL = "https://api.automatos.test";

const SOURCE: AiAssistSource = {
  entityKind: "product",
  name: "Bois Pacifique",
  body: "An indica-dominant hybrid grown in Portugal.",
  storeName: "Acme Cannabis Co",
};

/** An SSE body that streams `content` deltas and closes with `done`. */
function sseBody(deltas: readonly string[], options: { done?: boolean } = {}) {
  const frames = deltas.map(
    (delta) => `event: message\ndata: ${JSON.stringify({ content: delta })}\n\n`,
  );
  if (options.done !== false) {
    frames.push(`event: done\ndata: ${JSON.stringify({ conversation_id: "c1" })}\n\n`);
  }
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const frame of frames) controller.enqueue(encoder.encode(frame));
      controller.close();
    },
  });
}

function jsonDraft(text: string): string {
  return JSON.stringify({ text });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue({ success: true });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The auth exchange response a secret key gets. */
function authOk() {
  return new Response(
    JSON.stringify({
      session_token: SESSION_TOKEN,
      expires_at: "2026-08-14T12:00:00Z",
      permissions: [],
      workspace_id: "ws-1",
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function chatOk(text: string) {
  return new Response(sseBody([text]), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

describe("US-024 output contract", () => {
  it("pins the limit for each kind", () => {
    expect(AI_ASSIST_MAX_LENGTH.title).toBe(60);
    expect(AI_ASSIST_MAX_LENGTH.description).toBe(160);
    expect(AI_ASSIST_MAX_LENGTH.imageAlt).toBe(120);
    expect(AI_ASSIST_KINDS).toEqual(["title", "description", "imageAlt"]);
  });

  it.each(AI_ASSIST_KINDS)("accepts a draft exactly at the %s limit", (kind) => {
    const text = "a".repeat(AI_ASSIST_MAX_LENGTH[kind]);
    expect(parseAiDraft(kind, jsonDraft(text))).toEqual({ ok: true, text });
  });

  it.each(AI_ASSIST_KINDS)("REFUSES one character over the %s limit — and returns no text", (kind) => {
    const over = AI_ASSIST_MAX_LENGTH[kind] + 1;
    const result = parseAiDraft(kind, jsonDraft("a".repeat(over)));

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toBe("too_long");
    expect(result.length).toBe(over);
    // The whole point: nothing truncated came back to be saved.
    expect(result).not.toHaveProperty("text");
  });

  it("refuses prose, an array, a missing text field and an empty one", () => {
    expect(parseAiDraft("title", "Sure! Here is a title.")).toEqual({
      ok: false,
      reason: "not_json",
    });
    expect(parseAiDraft("title", '["a title"]')).toEqual({ ok: false, reason: "not_json" });
    expect(parseAiDraft("title", '{"title":"a title"}')).toEqual({
      ok: false,
      reason: "no_text_field",
    });
    expect(parseAiDraft("title", '{"text":42}')).toEqual({ ok: false, reason: "no_text_field" });
    expect(parseAiDraft("title", '{"text":"   "}')).toEqual({ ok: false, reason: "empty" });
  });

  it("unwraps a markdown fence and normalises whitespace to one line", () => {
    const fenced = '```json\n{"text": "Bois  Pacifique\\nIndica hybrid"}\n```';
    expect(parseAiDraft("title", fenced)).toEqual({
      ok: true,
      text: "Bois Pacifique Indica hybrid",
    });
  });

  it("measures the limit AFTER normalising, so trailing whitespace is not a refusal", () => {
    const atLimit = "a".repeat(AI_ASSIST_MAX_LENGTH.title);
    expect(parseAiDraft("title", jsonDraft(`  ${atLimit}\n`))).toEqual({
      ok: true,
      text: atLimit,
    });
  });
});

describe("US-024 prompt isolation", () => {
  it("carries only the entity content it was handed", () => {
    const prompt = buildAiAssistPrompt("description", SOURCE);

    expect(prompt).toContain(SOURCE.name);
    expect(prompt).toContain(SOURCE.body!);
    expect(prompt).toContain(SOURCE.storeName!);
    // Nothing that identifies the tenant, the platform, or any other store.
    expect(prompt).not.toContain(TENANT_A);
    expect(prompt.toLowerCase()).not.toContain("budstack");
  });

  it("states the kind's own limit and demands JSON", () => {
    for (const kind of AI_ASSIST_KINDS) {
      const prompt = buildAiAssistPrompt(kind, SOURCE);
      expect(prompt).toContain(String(AI_ASSIST_MAX_LENGTH[kind]));
      expect(prompt).toContain('{"text": "..."}');
    }
  });

  it("clips an oversized body rather than sending it whole", () => {
    const prompt = buildAiAssistPrompt("title", {
      ...SOURCE,
      body: "word ".repeat(2000),
    });
    expect(prompt.length).toBeLessThan(AI_ASSIST_SOURCE_MAX_CHARS + 1000);
  });

  it("omits absent optional facts instead of printing empties", () => {
    const prompt = buildAiAssistPrompt("title", {
      entityKind: "page",
      name: "About us",
    });
    expect(prompt).not.toContain("store name:");
    expect(prompt).not.toContain("content:");
  });
});

describe("US-024 transport", () => {
  it("exchanges a secret key for a session token, then chats with it", async () => {
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce(chatOk(jsonDraft("A title")));

    const result = await requestAutomatosCompletion({
      credentials: { apiKey: SECRET_KEY, agentId: 7 },
      prompt: "prompt",
      baseUrl: BASE_URL,
    });

    expect(result).toEqual({ ok: true, text: jsonDraft("A title") });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [authUrl, authInit] = fetchMock.mock.calls[0];
    expect(authUrl).toBe(`${BASE_URL}/api/widgets/auth`);
    expect(JSON.parse(String(authInit.body))).toEqual({ api_key: SECRET_KEY });

    const [chatUrl, chatInit] = fetchMock.mock.calls[1];
    expect(chatUrl).toBe(`${BASE_URL}/api/widgets/chat`);
    expect(chatInit.headers.Authorization).toBe(`Bearer ${SESSION_TOKEN}`);
    // agent_id is an Int in the column and a string on the wire.
    expect(JSON.parse(String(chatInit.body))).toEqual({
      message: "prompt",
      agent_id: "7",
    });
  });

  it("sends a public key straight as the bearer — no exchange", async () => {
    fetchMock.mockResolvedValueOnce(chatOk(jsonDraft("A title")));

    const result = await requestAutomatosCompletion({
      credentials: { apiKey: PUBLIC_KEY },
      prompt: "prompt",
      baseUrl: BASE_URL,
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE_URL}/api/widgets/chat`);
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${PUBLIC_KEY}`);
    // No agent configured — the key is not sent as one.
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ message: "prompt" });
  });

  it("reassembles content split across frames and stops at done", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode('event: message\ndata: {"content":"{\\"text\\":\\"Bois '));
        controller.enqueue(encoder.encode('Paci'));
        controller.enqueue(encoder.encode('fique\\"}"}\n\nevent: done\ndata: {"conversation_id":"c1"}\n\n'));
        controller.enqueue(encoder.encode('event: message\ndata: {"content":"IGNORED"}\n\n'));
        controller.close();
      },
    });
    fetchMock.mockResolvedValueOnce(
      new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } }),
    );

    const result = await requestAutomatosCompletion({
      credentials: { apiKey: PUBLIC_KEY },
      prompt: "prompt",
      baseUrl: BASE_URL,
    });

    expect(result).toEqual({ ok: true, text: '{"text":"Bois Pacifique"}' });
  });

  it("returns whatever streamed when the stream ends without a done frame", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(sseBody(["partial"], { done: false }), {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );

    const result = await requestAutomatosCompletion({
      credentials: { apiKey: PUBLIC_KEY },
      prompt: "prompt",
      baseUrl: BASE_URL,
    });

    expect(result).toEqual({ ok: true, text: "partial" });
  });

  it("maps 401 to auth, 429 to rate_limited with Retry-After, 500 to upstream", async () => {
    const cases = [
      { status: 401, expected: { ok: false, reason: "auth", status: 401 } },
      {
        status: 429,
        headers: { "retry-after": "45" },
        expected: { ok: false, reason: "rate_limited", status: 429, retryAfterSeconds: 45 },
      },
      { status: 500, expected: { ok: false, reason: "upstream", status: 500 } },
    ] as const;

    for (const testCase of cases) {
      fetchMock.mockReset();
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: "Invalid or expired API key" }), {
          status: testCase.status,
          headers: { ...(testCase as { headers?: Record<string, string> }).headers },
        }),
      );

      const result = await requestAutomatosCompletion({
        credentials: { apiKey: PUBLIC_KEY },
        prompt: "prompt",
        baseUrl: BASE_URL,
      });
      expect(result).toEqual(testCase.expected);
    }
  });

  it("maps an error frame mid-stream to upstream", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode(
            'event: message\ndata: {"content":"partial"}\n\nevent: error\ndata: {"message":"agent exploded"}\n\n',
          ),
        );
        controller.close();
      },
    });
    fetchMock.mockResolvedValueOnce(new Response(body, { status: 200 }));

    const result = await requestAutomatosCompletion({
      credentials: { apiKey: PUBLIC_KEY },
      prompt: "prompt",
      baseUrl: BASE_URL,
    });

    expect(result).toEqual({ ok: false, reason: "upstream" });
  });

  it("maps an aborted request to timeout", async () => {
    fetchMock.mockImplementationOnce((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    });

    const result = await requestAutomatosCompletion({
      credentials: { apiKey: PUBLIC_KEY },
      prompt: "prompt",
      baseUrl: BASE_URL,
      timeoutMs: 10,
    });

    expect(result).toEqual({ ok: false, reason: "timeout" });
  });

  it("treats a blank or missing key as not configured", () => {
    expect(isAutomatosConfigured(null)).toBe(false);
    expect(isAutomatosConfigured(undefined)).toBe(false);
    expect(isAutomatosConfigured({ apiKey: "   " })).toBe(false);
    expect(isAutomatosConfigured({ apiKey: PUBLIC_KEY })).toBe(true);
  });
});

describe("US-024 service", () => {
  it("reads credentials from the COLUMNS, tenant-scoped", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue({
      automatosApiKey: `  ${SECRET_KEY}  `,
      automatosAgentId: 7,
    });

    await expect(loadAutomatosCredentials(TENANT_A)).resolves.toEqual({
      apiKey: SECRET_KEY,
      agentId: 7,
    });

    const query = prismaMock.tenants.findFirst.mock.calls[0][0];
    expect(query.where).toEqual({ id: TENANT_A });
    expect(query.select).toEqual({ automatosApiKey: true, automatosAgentId: true });
  });

  it("returns the connect prompt — and calls no provider — when nothing is stored", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue({
      automatosApiKey: null,
      automatosAgentId: null,
    });
    const provider: AiAssistProvider = {
      id: "spy",
      label: "Spy",
      complete: vi.fn(),
    };

    const result = await generateSeoDraft({
      tenantId: TENANT_A,
      kind: "title",
      source: SOURCE,
      provider,
    });

    expect(result).toEqual({
      status: "unavailable",
      reason: "not_connected",
      connect: AUTOMATOS_CONNECT,
    });
    expect(AUTOMATOS_CONNECT.settingsPath).toBe("/tenant-admin/settings");
    // No platform-key fallback: the provider is never reached.
    expect(provider.complete).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("meters per tenant, fail-closed, BEFORE the credential lookup", async () => {
    checkRateLimit.mockResolvedValue({
      success: false,
      response: new Response(null, { status: 429, headers: { "retry-after": "90" } }),
    });

    const result = await generateSeoDraft({
      tenantId: TENANT_A,
      kind: "title",
      source: SOURCE,
    });

    expect(result).toEqual({ status: "rate_limited", retryAfterSeconds: 90 });
    expect(checkRateLimit).toHaveBeenCalledWith(`seo-ai-assist:${TENANT_A}`, {
      ...AI_ASSIST_RATE_LIMIT,
      failMode: "closed",
    });
    // Metering is not skippable by a request that would have failed later.
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
  });

  it("reports the limiter's own outage as an error, not as a free pass", async () => {
    checkRateLimit.mockResolvedValue({
      success: false,
      response: new Response(null, { status: 503 }),
    });

    await expect(
      generateSeoDraft({ tenantId: TENANT_A, kind: "title", source: SOURCE }),
    ).resolves.toEqual({ status: "error", reason: "rate_limiter_unavailable" });
  });

  it("does not report a database failure as 'not connected'", async () => {
    prismaMock.tenants.findFirst.mockRejectedValue(new Error("connection reset"));

    await expect(
      generateSeoDraft({ tenantId: TENANT_A, kind: "title", source: SOURCE }),
    ).resolves.toEqual({ status: "error", reason: "lookup_failed" });
  });

  it("returns a contract-checked draft end to end through the real transport", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue({
      automatosApiKey: PUBLIC_KEY,
      automatosAgentId: null,
    });
    fetchMock.mockResolvedValueOnce(chatOk(jsonDraft("Bois Pacifique — indica hybrid")));

    const result = await generateSeoDraft({
      tenantId: TENANT_A,
      kind: "title",
      source: SOURCE,
    });

    expect(result).toEqual({
      status: "ok",
      kind: "title",
      text: "Bois Pacifique — indica hybrid",
      provider: "automatos",
    });
    // The prompt that went out is the one the builder makes from this source.
    const sent = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(sent.message).toBe(buildAiAssistPrompt("title", SOURCE));
  });

  it("refuses an over-long provider answer instead of trimming it", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue({
      automatosApiKey: PUBLIC_KEY,
      automatosAgentId: null,
    });
    const over = "a".repeat(AI_ASSIST_MAX_LENGTH.title + 20);
    fetchMock.mockResolvedValueOnce(chatOk(jsonDraft(over)));

    const result = await generateSeoDraft({
      tenantId: TENANT_A,
      kind: "title",
      source: SOURCE,
    });

    expect(result).toEqual({
      status: "refused",
      reason: "too_long",
      maxLength: AI_ASSIST_MAX_LENGTH.title,
      length: over.length,
    });
    expect(JSON.stringify(result)).not.toContain(over);
  });

  it("maps a provider auth failure to error, never to 'connect your account'", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue({
      automatosApiKey: PUBLIC_KEY,
      automatosAgentId: null,
    });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: "Invalid or expired API key" }), { status: 401 }),
    );

    await expect(
      generateSeoDraft({ tenantId: TENANT_A, kind: "title", source: SOURCE }),
    ).resolves.toEqual({ status: "error", reason: "auth" });
  });

  it("surfaces the provider's own 429 as rate_limited", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue({
      automatosApiKey: PUBLIC_KEY,
      automatosAgentId: null,
    });
    fetchMock.mockResolvedValueOnce(
      new Response("{}", { status: 429, headers: { "retry-after": "12" } }),
    );

    await expect(
      generateSeoDraft({ tenantId: TENANT_A, kind: "title", source: SOURCE }),
    ).resolves.toEqual({ status: "rate_limited", retryAfterSeconds: 12 });
  });

  it("never lets the api key reach a log line or a result", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue({
      automatosApiKey: SECRET_KEY,
      automatosAgentId: 7,
    });
    fetchMock
      .mockResolvedValueOnce(authOk())
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ detail: `key ${SECRET_KEY} is bad` }), { status: 500 }),
      );

    const result = await generateSeoDraft({
      tenantId: TENANT_A,
      kind: "title",
      source: SOURCE,
    });

    expect(result).toEqual({ status: "error", reason: "upstream" });
    expect(JSON.stringify(result)).not.toContain(SECRET_KEY);

    const logged = JSON.stringify([
      loggerMock.info.mock.calls,
      loggerMock.warn.mock.calls,
      loggerMock.error.mock.calls,
      loggerMock.debug.mock.calls,
    ]);
    expect(logged).not.toContain(SECRET_KEY);
    expect(logged).not.toContain(SESSION_TOKEN);
    // Positive proof the scrub ran, rather than the log line having vanished:
    // the upstream body quoted the key back and we kept the diagnostic without
    // it.
    expect(logged).toContain("[REDACTED]");
  });

  it("exposes the automatos provider under a stable id", () => {
    expect(automatosProvider.id).toBe("automatos");
    expect(automatosProvider.label).toBe("Automatos AI");
  });
});
