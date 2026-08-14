import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * SEO Supercharge US-025 — the browser half, and the shaping that decides what
 * the model is told.
 *
 * WHY THESE TWO IN ONE FILE: they are the two halves of the same promise. The
 * source module decides that the prompt carries the tenant's own stored copy and
 * nothing else; the client module decides that whatever comes back either lands
 * in the field as a draft or becomes a sentence the owner can act on — never
 * `undefined` in an input, and never a half-parsed body treated as text.
 *
 * `requestSeoDraft` is asserted against a stubbed `fetch` speaking the real
 * response shapes the route returns (tests/unit/seo-ai-assist-route.test.ts pins
 * those), so the two ends cannot drift apart silently.
 */

import { UPGRADE_REQUIRED_CODE } from "@/lib/entitlements/plan";
import {
  draftFailureMessage,
  requestSeoDraft,
  SEO_AI_ASSIST_API_PATH,
} from "@/components/admin/seo/ai-assist-client";
import { AUTOMATOS_CONNECT } from "@/lib/seo/ai-assist-contract";
import {
  conditionAiAssistSource,
  htmlToPromptText,
  postAiAssistSource,
  productAiAssistSource,
  storePageAiAssistSource,
} from "@/lib/seo/ai-assist-source";

const REQUEST = {
  kind: "title",
  entityType: "product",
  entityId: "p1",
} as const;

function respondWith(
  status: number,
  body: unknown,
  init: { readonly json?: boolean } = {},
) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: init.json === false
      ? () => Promise.reject(new SyntaxError("not json"))
      : () => Promise.resolve(body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestSeoDraft", () => {
  it("posts the entity reference and nothing else", async () => {
    const fetchMock = respondWith(200, {
      status: "ok",
      kind: "title",
      text: "Bois Pacifique — indica hybrid",
      provider: "automatos",
    });

    const outcome = await requestSeoDraft(REQUEST);
    expect(outcome).toEqual({ ok: true, text: "Bois Pacifique — indica hybrid" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(SEO_AI_ASSIST_API_PATH);
    expect(init.method).toBe("POST");
    // No prompt, no copy, no tenant id — the server reads the row itself.
    expect(JSON.parse(init.body)).toEqual({
      kind: "title",
      entityType: "product",
      entityId: "p1",
    });
  });

  it("reads the unavailable state off a 200, not off an error", async () => {
    respondWith(200, {
      status: "unavailable",
      reason: "not_connected",
      connect: AUTOMATOS_CONNECT,
    });

    expect(await requestSeoDraft(REQUEST)).toEqual({
      ok: false,
      unavailable: true,
    });
  });

  it("refuses a 200 whose body is not a draft", async () => {
    // A proxy page, a stale deploy, an empty object: anything but a string here
    // would put `undefined` into the field the owner is about to save.
    for (const body of [{ status: "ok" }, { status: "ok", text: "   " }, "text", null]) {
      respondWith(200, body);
      const outcome = await requestSeoDraft(REQUEST);
      expect(outcome.ok).toBe(false);
      if (!outcome.ok && !outcome.unavailable) {
        expect(outcome.error).toMatch(/could not read/i);
      }
    }
  });

  it("survives a body that is not JSON at all", async () => {
    respondWith(200, null, { json: false });
    const outcome = await requestSeoDraft(REQUEST);
    expect(outcome.ok).toBe(false);
  });

  it("turns a dropped connection into a sentence, never a throw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    const outcome = await requestSeoDraft(REQUEST);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok && !outcome.unavailable) {
      expect(outcome.error).toMatch(/connection/i);
    }
  });

  it("carries the plan refusal through as an upgrade, not a retry", async () => {
    respondWith(403, {
      error: "This feature is not included in your plan.",
      code: UPGRADE_REQUIRED_CODE,
      feature: "seo.pro",
      plan: "basic",
    });

    const outcome = await requestSeoDraft(REQUEST);
    expect(outcome).toEqual({
      ok: false,
      unavailable: false,
      error: "This feature is not included in your plan.",
      upgradeRequired: true,
    });
  });
});

describe("draftFailureMessage", () => {
  it("surfaces the rate limit with the wait, per the story", async () => {
    const { error, upgradeRequired } = draftFailureMessage(429, {
      status: "rate_limited",
      retryAfterSeconds: 45,
    });
    expect(error).toContain("45 seconds");
    expect(upgradeRequired).toBe(false);
  });

  it("says 'in a moment' rather than 'in NaN seconds'", () => {
    expect(draftFailureMessage(429, { status: "rate_limited" }).error).toContain(
      "in a moment",
    );
    expect(
      draftFailureMessage(429, { status: "rate_limited", retryAfterSeconds: "soon" })
        .error,
    ).toContain("in a moment");
  });

  it("rounds a long wait up to minutes", () => {
    expect(
      draftFailureMessage(429, { status: "rate_limited", retryAfterSeconds: 150 }).error,
    ).toContain("3 minutes");
  });

  it("says how far over the limit a refused draft went", () => {
    const { error } = draftFailureMessage(422, {
      status: "refused",
      reason: "too_long",
      maxLength: 60,
      length: 74,
    });
    expect(error).toContain("74");
    expect(error).toContain("60");
  });

  it("falls back to plain wording for the other refusals", () => {
    for (const reason of ["not_json", "no_text_field", "empty"]) {
      const { error } = draftFailureMessage(422, {
        status: "refused",
        reason,
        maxLength: 60,
      });
      expect(error).toMatch(/usable text/i);
    }
  });

  it("points a rejected key at settings, and never quotes it", () => {
    const { error } = draftFailureMessage(502, { status: "error", reason: "auth" });
    expect(error).toMatch(/settings/i);
    expect(error).not.toMatch(/ak_|key\s*[:=]/i);
  });

  it("distinguishes their outage from ours", () => {
    expect(
      draftFailureMessage(502, { status: "error", reason: "upstream" }).error,
    ).toMatch(/Automatos AI could not be reached/i);
    expect(
      draftFailureMessage(503, { status: "error", reason: "rate_limiter_unavailable" })
        .error,
    ).toMatch(/temporarily unavailable/i);
  });

  it("prefers the server's own sentence for a permission refusal", () => {
    const { error, upgradeRequired } = draftFailureMessage(403, {
      error: "You do not have permission to do that.",
    });
    expect(error).toBe("You do not have permission to do that.");
    // No upgrade code -> "ask your admin", not "buy the plan".
    expect(upgradeRequired).toBe(false);
  });

  it("still says something when the body says nothing", () => {
    expect(draftFailureMessage(500, null).error).toBeTruthy();
    expect(draftFailureMessage(500, {}).error).toBeTruthy();
  });
});

describe("the prompt source", () => {
  it("carries the product's own name and copy, plus the store's name", () => {
    expect(
      productAiAssistSource(
        { name: "Bois Pacifique", description: "Indica-dominant." },
        { storeName: "Acme Cannabis Co" },
      ),
    ).toEqual({
      entityKind: "product",
      name: "Bois Pacifique",
      body: "Indica-dominant.",
      storeName: "Acme Cannabis Co",
    });
  });

  it("omits what is absent rather than sending empty strings", () => {
    expect(productAiAssistSource({ name: "Unnamed", description: null })).toEqual({
      entityKind: "product",
      name: "Unnamed",
    });
    expect(
      conditionAiAssistSource({ name: "Chronic pain", description: null }, {
        storeName: "   ",
      }),
    ).toEqual({ entityKind: "condition", name: "Chronic pain" });
  });

  it("prefers a post's own excerpt — the author's summary of the article", () => {
    expect(
      postAiAssistSource({
        title: "Sleep and CBD",
        excerpt: "What the trials actually measured.",
        content: "<p>Three thousand words</p>",
      }),
    ).toEqual({
      entityKind: "post",
      name: "Sleep and CBD",
      body: "What the trials actually measured.",
    });
  });

  it("falls back to the body with its markup removed", () => {
    const source = postAiAssistSource({
      title: "Sleep and CBD",
      excerpt: "  ",
      content: "<h2>Findings</h2><p>Two trials &amp; one review.</p>",
    });
    expect(source.body).toBe("Findings Two trials & one review.");
  });

  it("names the store page rather than inventing content for it", () => {
    expect(storePageAiAssistSource("about", { storeName: "Acme" })).toEqual({
      entityKind: "page",
      name: "About Us",
      storeName: "Acme",
    });
  });
});

describe("htmlToPromptText", () => {
  it("drops tags without welding words together", () => {
    expect(htmlToPromptText("<p>One</p><p>Two</p>")).toBe("One Two");
  });

  it("removes script and style bodies, not just their tags", () => {
    expect(
      htmlToPromptText("<p>Copy</p><script>alert('x')</script><style>p{}</style>"),
    ).toBe("Copy");
  });

  it("decodes the entities a rich-text editor writes", () => {
    expect(htmlToPromptText("<p>Tom &amp; Jerry &nbsp;&quot;quoted&quot;</p>")).toBe(
      'Tom & Jerry "quoted"',
    );
  });

  it("keeps prose that merely contains a less-than sign", () => {
    expect(htmlToPromptText("<p>THC &lt; 0.2%</p>")).toBe("THC < 0.2%");
  });
});
