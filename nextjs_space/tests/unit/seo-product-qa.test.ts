import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

/**
 * LLM Visibility US-002 — product Q&A: storage, publication, and the AI contract.
 *
 * The five properties this file exists to hold:
 *
 *  1. WHAT IS STORED IS WHAT IS PUBLISHED. One parser (`readProductQa`) decides
 *     which pairs are real, and the accordion and the `FAQPage` node both take
 *     their list from `productQaEntries`, which calls it — so the markup can
 *     never describe a question the page does not show.
 *  2. THE PLAN GATE IS ON THE READ. A Basic tenant publishes neither the block
 *     nor the node, and their stored pairs survive untouched — dormant, not
 *     deleted, exactly like US-022's indexing rules.
 *  3. A `</script>` IN A QUESTION CANNOT CLOSE THE TAG. The one serializer is
 *     the only way a node reaches the DOM.
 *  4. THE AI CONTRACT REFUSES, NEVER REPAIRS. An over-long or malformed list
 *     comes back with no pairs at all rather than a quietly shortened one.
 *  5. THE PROMPT CONTAINS THIS TENANT'S OWN PRODUCT AND NOTHING ELSE.
 *
 * Pure modules throughout — no route, no prisma. The routes have their own file
 * (tests/unit/seo-product-qa-routes.test.ts).
 */

import {
  entitySeoQa,
  entitySeoWrite,
  isEmptyEntitySeo,
  readEntitySeo,
  withEntityImageAlt,
} from "@/lib/seo/entity-seo";
import {
  buildProductQaJsonLd,
  productQaEntries,
} from "@/lib/seo/faq-json-ld";
import { serializeJsonLd } from "@/lib/seo/json-ld";
import {
  PRODUCT_QA_LIMITS,
  hasQaField,
  readProductQa,
} from "@/lib/seo/product-qa";
import {
  QA_DRAFT_SOURCE_MAX_CHARS,
  buildQaDraftPrompt,
  parseQaDraft,
} from "@/lib/seo/qa-draft";
import { ProductQaSection } from "@/app/store/[slug]/products/[id]/product-qa-section";
import {
  SEO_QA_DRAFT_API_PATH,
  requestQaDraft,
} from "@/components/admin/seo/qa-draft-client";

const TENANT_A = "tenant-a";
const SUBDOMAIN = "acme";
const ORIGIN = `https://${SUBDOMAIN}.budstacks.io`;
const STRAIN_ID = "strain-123";

const PAIRS = [
  { question: "Is this good for evening use?", answer: "It is an indica-dominant hybrid, so most people take it later in the day." },
  { question: "How is it grown?", answer: "Indoors in Portugal, under EU-GMP conditions." },
];

/** A Pro tenant's product page source, as the storefront page builds it. */
function source(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: TENANT_A,
    plan: "pro",
    subdomain: SUBDOMAIN,
    customDomain: null,
    productId: STRAIN_ID,
    seo: { qa: PAIRS },
    ...overrides,
  };
}

describe("readProductQa — the one parser, fail-closed", () => {
  it("keeps valid pairs in the order they are stored", () => {
    expect(readProductQa(PAIRS)).toEqual(PAIRS);
  });

  it("is empty for anything that is not an array", () => {
    for (const value of [null, undefined, {}, "", "[]", 7, { qa: PAIRS }]) {
      expect(readProductQa(value)).toEqual([]);
    }
  });

  it("drops a malformed entry and keeps the rest", () => {
    const stored = [
      PAIRS[0],
      { question: "No answer" },
      { answer: "No question" },
      { question: 7, answer: "Not a string" },
      null,
      "a string entry",
      ["a", "b"],
      PAIRS[1],
    ];
    expect(readProductQa(stored)).toEqual(PAIRS);
  });

  it("returns only the two fields, whatever else the entry carries", () => {
    expect(
      readProductQa([{ ...PAIRS[0], id: "row-1", order: 3, html: "<b>x</b>" }]),
    ).toEqual([PAIRS[0]]);
  });

  it("collapses whitespace and refuses a blank field", () => {
    expect(
      readProductQa([{ question: "  Two   lines?\n\n", answer: "One\nanswer." }]),
    ).toEqual([{ question: "Two lines?", answer: "One answer." }]);

    expect(readProductQa([{ question: "   ", answer: "Real" }])).toEqual([]);
    expect(readProductQa([{ question: "Real?", answer: "\n\t " }])).toEqual([]);
  });

  it("caps the list at the stored maximum", () => {
    const many = Array.from({ length: 25 }, (_, index) => ({
      question: `Question ${index}?`,
      answer: `Answer ${index}.`,
    }));

    const parsed = readProductQa(many);
    expect(parsed).toHaveLength(PRODUCT_QA_LIMITS.maxPairs);
    // The FIRST ten, not an arbitrary ten: the order is the owner's.
    expect(parsed[0].question).toBe("Question 0?");
    expect(parsed[PRODUCT_QA_LIMITS.maxPairs - 1].question).toBe(
      `Question ${PRODUCT_QA_LIMITS.maxPairs - 1}?`,
    );
  });

  it("drops an entry that would not have passed the write route", () => {
    const longQuestion = "q".repeat(PRODUCT_QA_LIMITS.maxQuestionLength + 1);
    const longAnswer = "a".repeat(PRODUCT_QA_LIMITS.maxAnswerLength + 1);

    expect(
      readProductQa([
        { question: longQuestion, answer: "Fine." },
        { question: "Fine?", answer: longAnswer },
        PAIRS[0],
      ]),
    ).toEqual([PAIRS[0]]);
  });

  it("measures the limit after collapsing, not before", () => {
    // Exactly at the cap, padded with whitespace that would never render.
    const atCap = "q".repeat(PRODUCT_QA_LIMITS.maxQuestionLength);
    expect(
      readProductQa([{ question: `\n  ${atCap}  \n`, answer: "Fine." }]),
    ).toEqual([{ question: atCap, answer: "Fine." }]);
  });
});

describe("hasQaField — presence, not length", () => {
  it("is true for an empty list — clearing the last question is a Pro write", () => {
    expect(hasQaField({ qa: [] })).toBe(true);
    expect(hasQaField({ qa: PAIRS })).toBe(true);
  });

  it("is false only when the key was never sent", () => {
    expect(hasQaField({})).toBe(false);
    expect(hasQaField({ qa: undefined })).toBe(false);
  });
});

describe("the authored record — qa is a field of the same blob", () => {
  it("lifts stored pairs, and drops an empty list", () => {
    expect(readEntitySeo({ title: "T", qa: PAIRS }).qa).toEqual(PAIRS);
    expect(readEntitySeo({ title: "T", qa: [] }).qa).toBeUndefined();
    expect(readEntitySeo({ title: "T", qa: "nonsense" }).qa).toBeUndefined();
  });

  it("counts as authored content — an empty one does not", () => {
    expect(isEmptyEntitySeo(readEntitySeo({ qa: PAIRS }))).toBe(false);
    expect(isEmptyEntitySeo(readEntitySeo({ qa: [] }))).toBe(true);
    expect(isEmptyEntitySeo(readEntitySeo({ qa: [{ question: "Q?" }] }))).toBe(
      true,
    );
  });

  it("is its own half of the record", () => {
    expect(entitySeoQa(readEntitySeo({ title: "T", qa: PAIRS }))).toEqual({
      qa: PAIRS,
    });
    expect(entitySeoQa(readEntitySeo({ title: "T" }))).toEqual({});
  });
});

describe("entitySeoWrite — two independent preserve decisions", () => {
  const STORED = { title: "old", qa: PAIRS, sitemapExclude: true };

  it("writes the submitted pairs when the caller was entitled to send them", () => {
    const written = entitySeoWrite(STORED, { title: "new", qa: [PAIRS[1]] }, {
      preserveIndexing: true,
      preserveQa: false,
    });
    expect(written).toEqual({
      title: "new",
      qa: [PAIRS[1]],
      sitemapExclude: true,
    });
  });

  it("preserves stored pairs through a save that may not write them", () => {
    // A Basic tenant saving a title: no `qa` key, no indexing keys — and
    // neither group is erased.
    expect(
      entitySeoWrite(STORED, { title: "new" }, {
        preserveIndexing: true,
        preserveQa: true,
      }),
    ).toEqual({ title: "new", qa: PAIRS, sitemapExclude: true });
  });

  it("lets a Pro tenant clear the list they wrote", () => {
    expect(
      entitySeoWrite(STORED, { title: "new", qa: [] }, {
        preserveIndexing: true,
        preserveQa: false,
      }),
    ).toEqual({ title: "new", sitemapExclude: true });
  });

  it("keeps the two groups independent", () => {
    // Q&A written, indexing preserved — the combination the editor produces when
    // only the Q&A section changed.
    expect(
      entitySeoWrite(STORED, { title: "new", qa: [PAIRS[0]] }, {
        preserveIndexing: true,
        preserveQa: false,
      }).sitemapExclude,
    ).toBe(true);

    // Indexing written, Q&A preserved — the inverse.
    const inverse = entitySeoWrite(
      STORED,
      { title: "new", sitemapExclude: false },
      { preserveIndexing: false, preserveQa: true },
    );
    expect(inverse.sitemapExclude).toBeUndefined();
    expect(inverse.qa).toEqual(PAIRS);
  });

  it("still behaves exactly as it did with no options at all", () => {
    // The pre-US-002 contract: no flags means the submitted record wins whole.
    expect(entitySeoWrite(STORED, { title: "new", sitemapExclude: true })).toEqual(
      { title: "new", sitemapExclude: true },
    );
  });

  it("survives the Wire editor writing an alt into the same column", () => {
    expect(withEntityImageAlt(STORED, "A jar of dried flower")).toEqual({
      title: "old",
      imageAlt: "A jar of dried flower",
      sitemapExclude: true,
      qa: PAIRS,
    });
  });
});

describe("productQaEntries — the gate is on the read", () => {
  it("publishes an entitled tenant's pairs", () => {
    expect(productQaEntries(source())).toEqual(PAIRS);
  });

  it("unlocks trial and custom, like every other Pro surface", () => {
    for (const plan of ["trial", "pro", "custom"]) {
      expect(productQaEntries(source({ plan }))).toEqual(PAIRS);
    }
  });

  it("publishes nothing for a Basic tenant, and nothing for an unreadable plan", () => {
    for (const plan of ["basic", null, undefined, "", "enterprise", 7]) {
      expect(productQaEntries(source({ plan }))).toEqual([]);
    }
  });

  it("is empty when the owner has authored no Q&A", () => {
    expect(productQaEntries(source({ seo: null }))).toEqual([]);
    expect(productQaEntries(source({ seo: { title: "T" } }))).toEqual([]);
  });
});

describe("buildProductQaJsonLd — the node the answer engines read", () => {
  it("states every visible pair, and only those", () => {
    const [node] = buildProductQaJsonLd(source());

    expect(node["@type"]).toBe("FAQPage");
    expect(node["@id"]).toBe(`${ORIGIN}/products/${STRAIN_ID}#faq`);
    expect(node.url).toBe(`${ORIGIN}/products/${STRAIN_ID}`);
    expect(node.mainEntity).toEqual(
      PAIRS.map((pair) => ({
        "@type": "Question",
        name: pair.question,
        acceptedAnswer: { "@type": "Answer", text: pair.answer },
      })),
    );
  });

  it("describes exactly what the section renders", () => {
    // The property the whole design turns on: structured data is policed on
    // matching the visible content, and these two are the same array.
    const stored = [...PAIRS, { question: "Broken" }, { question: "  ", answer: "x" }];
    const withJunk = source({ seo: { qa: stored } });

    const [node] = buildProductQaJsonLd(withJunk);
    const questions = (node.mainEntity as Array<{ name: string }>).map(
      (entry) => entry.name,
    );
    expect(questions).toEqual(
      productQaEntries(withJunk).map((pair) => pair.question),
    );
  });

  it("emits nothing at all for a Basic tenant", () => {
    expect(buildProductQaJsonLd(source({ plan: "basic" }))).toEqual([]);
  });

  it("emits nothing for a product with no valid pair", () => {
    expect(buildProductQaJsonLd(source({ seo: { qa: [] } }))).toEqual([]);
    expect(buildProductQaJsonLd(source({ seo: { qa: [{ answer: "x" }] } }))).toEqual(
      [],
    );
  });

  it("anchors to the custom domain when the store has one", () => {
    const [node] = buildProductQaJsonLd(
      source({ customDomain: "shop.acme.test" }),
    );
    expect(node["@id"]).toBe(`https://shop.acme.test/products/${STRAIN_ID}#faq`);
  });

  it("cannot close the script element it lives in", () => {
    const nodes = buildProductQaJsonLd(
      source({
        seo: {
          qa: [
            {
              question: "</script><script>alert(1)</script> is this safe?",
              answer: "Yes — & <b>escaped</b>.",
            },
          ],
        },
      }),
    );

    const serialized = serializeJsonLd(nodes) ?? "";
    expect(serialized).not.toContain("</script>");
    expect(serialized).not.toContain("<script>");
    // …and the VALUE round-trips unchanged, so the escaping is not censorship.
    const parsed = JSON.parse(serialized) as {
      mainEntity: Array<{ name: string }>;
    };
    expect(parsed.mainEntity[0].name).toBe(
      "</script><script>alert(1)</script> is this safe?",
    );
  });
});

describe("ProductQaSection — what a shopper (and a crawler) is shown", () => {
  // The component is a Server Component built by the classic JSX transform under
  // vitest's esbuild (tsconfig `jsx: preserve`), so `React` has to be in scope
  // to call it directly. Next's own build uses the automatic runtime; this is a
  // test-harness detail, not a runtime dependency of the component.
  beforeEach(() => {
    vi.stubGlobal("React", React);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders no element for an empty list", () => {
    // The section takes ONLY the gated array, so "Basic renders neither" is the
    // same fact as `productQaEntries` returning [] — asserted end to end here.
    expect(
      ProductQaSection({ pairs: productQaEntries(source({ plan: "basic" })) }),
    ).toBeNull();
    expect(ProductQaSection({ pairs: [] })).toBeNull();
  });

  it("puts every question and answer in the markup", () => {
    // The element tree is plain objects, so this asserts what the initial HTML
    // carries — the whole reason the block is a Server Component rather than a
    // section of the client page, whose first render is a spinner.
    const markup = JSON.stringify(ProductQaSection({ pairs: PAIRS }));

    for (const pair of PAIRS) {
      expect(markup).toContain(pair.question);
      expect(markup).toContain(pair.answer);
    }
    // `<details>`: collapsed content that stays in the DOM, with no client JS.
    expect(markup).toContain('"details"');
  });
});

describe("buildQaDraftPrompt — this tenant's own product, and the guardrails", () => {
  const SOURCE = {
    name: "Bois Pacifique",
    body: "An indica-dominant hybrid grown in Portugal.",
    storeName: "Acme Cannabis Co",
  };

  it("carries the product's own copy and the store's own name", () => {
    const prompt = buildQaDraftPrompt(SOURCE);
    expect(prompt).toContain("Bois Pacifique");
    expect(prompt).toContain("An indica-dominant hybrid grown in Portugal.");
    expect(prompt).toContain("Acme Cannabis Co");
  });

  it("bans the claims a Q&A block would otherwise invent", () => {
    const prompt = buildQaDraftPrompt(SOURCE);
    expect(prompt).toContain("Use ONLY the facts below");
    expect(prompt).toMatch(/medical benefits, potency, price/);
    expect(prompt).toContain("leave that question out");
  });

  it("asks for the array the parser accepts, with the stored limits stated", () => {
    const prompt = buildQaDraftPrompt(SOURCE);
    expect(prompt).toContain('[{"question": "...", "answer": "..."}]');
    expect(prompt).toContain(String(PRODUCT_QA_LIMITS.maxQuestionLength));
    expect(prompt).toContain(String(PRODUCT_QA_LIMITS.maxAnswerLength));
  });

  it("clips the product copy rather than sending an unbounded description", () => {
    const prompt = buildQaDraftPrompt({
      name: "Long One",
      body: "word ".repeat(2000),
    });
    expect(prompt.length).toBeLessThan(QA_DRAFT_SOURCE_MAX_CHARS + 800);
  });

  it("omits what the source does not carry", () => {
    const prompt = buildQaDraftPrompt({ name: "Bare" });
    expect(prompt).not.toContain("product description:");
    expect(prompt).not.toContain("store name:");
  });
});

describe("parseQaDraft — refused, never repaired", () => {
  const DRAFT = [
    { question: "Is it strong?", answer: "THC is on the label." },
    { question: "How is it stored?", answer: "Cool and dark." },
  ];

  it("accepts a clean array", () => {
    expect(parseQaDraft(JSON.stringify(DRAFT))).toEqual({ ok: true, pairs: DRAFT });
  });

  it("unwraps a markdown fence — transport, not repair", () => {
    const fenced = "```json\n" + JSON.stringify(DRAFT) + "\n```";
    expect(parseQaDraft(fenced)).toEqual({ ok: true, pairs: DRAFT });
  });

  it("normalises whitespace inside a pair", () => {
    const parsed = parseQaDraft(
      JSON.stringify([{ question: " Is it   strong?\n", answer: "Yes.\n\nVery." }]),
    );
    expect(parsed).toEqual({
      ok: true,
      pairs: [{ question: "Is it strong?", answer: "Yes. Very." }],
    });
  });

  it("refuses anything that is not a JSON array of pairs", () => {
    expect(parseQaDraft("Sure! Here you go:")).toEqual({
      ok: false,
      reason: "not_json",
    });
    expect(parseQaDraft('{"qa": []}')).toEqual({ ok: false, reason: "not_array" });
    expect(parseQaDraft('{"text": "a title"}')).toEqual({
      ok: false,
      reason: "not_array",
    });
    expect(parseQaDraft("[]")).toEqual({ ok: false, reason: "empty" });
    expect(parseQaDraft('["just a string"]')).toEqual({
      ok: false,
      reason: "not_pairs",
    });
    expect(parseQaDraft('[{"question": "Q?"}]')).toEqual({
      ok: false,
      reason: "not_pairs",
    });
    expect(parseQaDraft('[{"question": "Q?", "answer": "   "}]')).toEqual({
      ok: false,
      reason: "not_pairs",
    });
  });

  it("refuses the WHOLE list when one pair breaks a limit", () => {
    const overLongQuestion = [
      DRAFT[0],
      {
        question: "q".repeat(PRODUCT_QA_LIMITS.maxQuestionLength + 1),
        answer: "Fine.",
      },
    ];
    expect(parseQaDraft(JSON.stringify(overLongQuestion))).toEqual({
      ok: false,
      reason: "question_too_long",
    });

    const overLongAnswer = [
      DRAFT[0],
      {
        question: "Fine?",
        answer: "a".repeat(PRODUCT_QA_LIMITS.maxAnswerLength + 1),
      },
    ];
    expect(parseQaDraft(JSON.stringify(overLongAnswer))).toEqual({
      ok: false,
      reason: "answer_too_long",
    });
  });

  it("refuses a list longer than the store may save", () => {
    const many = Array.from(
      { length: PRODUCT_QA_LIMITS.maxPairs + 1 },
      (_, index) => ({ question: `Q${index}?`, answer: `A${index}.` }),
    );
    expect(parseQaDraft(JSON.stringify(many))).toEqual({
      ok: false,
      reason: "too_many",
    });
  });

  it("measures a limit after normalising, like the storage parser", () => {
    const atCap = "q".repeat(PRODUCT_QA_LIMITS.maxQuestionLength);
    const parsed = parseQaDraft(
      JSON.stringify([{ question: `\n ${atCap} \n`, answer: "Fine." }]),
    );
    expect(parsed.ok).toBe(true);
  });
});

describe("requestQaDraft — every response is a rendered state", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function respondWith(status: number, body: unknown) {
    fetchMock.mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    });
  }

  it("posts the product id and nothing else", async () => {
    respondWith(200, { status: "ok", pairs: PAIRS, provider: "automatos" });
    await requestQaDraft("p1");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(SEO_QA_DRAFT_API_PATH);
    expect(JSON.parse(init.body)).toEqual({ productId: "p1" });
  });

  it("returns the pairs on success", async () => {
    respondWith(200, { status: "ok", pairs: PAIRS, provider: "automatos" });
    expect(await requestQaDraft("p1")).toEqual({ ok: true, pairs: PAIRS });
  });

  it("re-checks the pairs against the storage limits", async () => {
    // A server that answered with something unsavable is not a draft: every
    // entry is dropped by the reader, so there is nothing to put in the editor.
    respondWith(200, {
      status: "ok",
      pairs: [{ question: "Q?", answer: "" }],
      provider: "automatos",
    });
    const outcome = await requestQaDraft("p1");
    expect(outcome.ok).toBe(false);
  });

  it("reports the missing account as a state, not an error", async () => {
    respondWith(200, { status: "unavailable", reason: "not_connected" });
    expect(await requestQaDraft("p1")).toEqual({ ok: false, unavailable: true });
  });

  it("names the plan gate so the editor offers an upgrade, not a retry", async () => {
    respondWith(403, {
      code: "upgrade_required",
      feature: "seo.pro",
      error: "Your plan does not include this.",
    });

    const outcome = await requestQaDraft("p1");
    expect(outcome).toMatchObject({ ok: false, upgradeRequired: true });
  });

  it("explains a refusal in terms of the list, not a character count", async () => {
    respondWith(422, { status: "refused", reason: "too_many" });
    const outcome = await requestQaDraft("p1");
    expect(outcome).toMatchObject({ ok: false, unavailable: false });
    if (!outcome.ok && !outcome.unavailable) {
      expect(outcome.error).toContain(String(PRODUCT_QA_LIMITS.maxPairs));
    }
  });

  it("falls back to a sentence for a refusal it has no wording for", async () => {
    respondWith(422, { status: "refused", reason: "not_pairs" });
    const outcome = await requestQaDraft("p1");
    expect(outcome).toMatchObject({ ok: false, upgradeRequired: false });
  });

  it("survives a body that is not JSON, and a network failure", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("not json");
      },
    });
    expect((await requestQaDraft("p1")).ok).toBe(false);

    fetchMock.mockRejectedValue(new Error("offline"));
    expect((await requestQaDraft("p1")).ok).toBe(false);
  });
});
