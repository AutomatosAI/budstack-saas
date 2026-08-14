import { describe, it, expect } from "vitest";

// SEO Supercharge US-017 — FAQPage from `conditions.faqs`.
//
// The column is a Prisma `Json?` with no DB-level shape, and the node is emitted
// on a page with no `error.tsx` boundary above it, so every case here is a
// production failure mode rather than a hypothetical:
//
//  1. The SHAPE the seed actually stores round-trips — `{question, answer}`
//     objects in an array, in order (scripts/seed-conditions.ts:57-61).
//  2. A malformed entry is SKIPPED, not fatal, and never empties the block: one
//     junk row among four real ones must cost that row and nothing else.
//  3. Nothing invalid is ever emitted — no blank `Answer`, no `mainEntity: []`,
//     no FAQPage for a `faqs` that is not an array at all.
//  4. A Basic tenant emits nothing (the storefront degrades on plan, never
//     blocks) and no owner-typed question can break out of the script element.
import { serializeJsonLd, type JsonLdNode } from "@/lib/seo/json-ld";
import {
  buildConditionFaqJsonLd,
  readFaqEntries,
  type ConditionFaqJsonLdSource,
} from "@/lib/seo/faq-json-ld";

/** A custom domain, so expectations never depend on NEXT_PUBLIC_BASE_DOMAIN. */
const CUSTOM_DOMAIN = "acme-cannabis.example";
const STORE_URL = `https://${CUSTOM_DOMAIN}`;
const CONDITION_SLUG = "chronic-pain";
const CONDITION_URL = `${STORE_URL}/conditions/${CONDITION_SLUG}`;

/**
 * Two entries copied from the shape the conditions seed stores, which is the
 * only writer of this column in the repo.
 */
const SEEDED_FAQS = [
  {
    question: "Can medical cannabis help with anxiety?",
    answer:
      "Yes, many patients report relief from anxiety symptoms using medical cannabis, particularly CBD-rich products.",
  },
  {
    question: "Are there any side effects?",
    answer:
      "Common side effects may include drowsiness, dry mouth, and changes in appetite.",
  },
];

function source(
  overrides: Partial<ConditionFaqJsonLdSource> = {},
): ConditionFaqJsonLdSource {
  return {
    tenantId: "tenant-a",
    plan: "pro",
    subdomain: "acme",
    customDomain: CUSTOM_DOMAIN,
    slug: CONDITION_SLUG,
    faqs: SEEDED_FAQS,
    ...overrides,
  };
}

/** The single FAQPage node, asserting there is exactly one. */
function faqNode(nodes: readonly JsonLdNode[]): JsonLdNode {
  expect(nodes).toHaveLength(1);
  expect(nodes[0]["@type"]).toBe("FAQPage");
  return nodes[0];
}

function questionsOf(nodes: readonly JsonLdNode[]): Record<string, unknown>[] {
  return faqNode(nodes).mainEntity as Record<string, unknown>[];
}

describe("readFaqEntries — the stored shape", () => {
  it("reads the array of {question, answer} the seed writes, in order", () => {
    expect(readFaqEntries(SEEDED_FAQS)).toEqual([
      { question: SEEDED_FAQS[0].question, answer: SEEDED_FAQS[0].answer },
      { question: SEEDED_FAQS[1].question, answer: SEEDED_FAQS[1].answer },
    ]);
  });

  it("keeps an entry that carries extra keys, and only its two fields", () => {
    expect(
      readFaqEntries([
        { id: 7, order: 1, question: "Is it legal?", answer: "With a script." },
      ]),
    ).toEqual([{ question: "Is it legal?", answer: "With a script." }]);
  });

  it("trims, so a padded answer is not emitted with its whitespace", () => {
    expect(
      readFaqEntries([{ question: "  How long?  ", answer: "\n1-2 hours.\n" }]),
    ).toEqual([{ question: "How long?", answer: "1-2 hours." }]);
  });

  it("returns nothing for a faqs value that is not an array", () => {
    for (const value of [
      null,
      undefined,
      {},
      { question: "Not in an array", answer: "So not read." },
      "[]",
      42,
      true,
    ]) {
      expect(readFaqEntries(value), JSON.stringify(value) ?? "undefined").toEqual(
        [],
      );
    }
  });

  it("skips the malformed entry and keeps the rest", () => {
    const entries = readFaqEntries([
      // The legacy short-key shape a hand-edited row could hold.
      { q: "Short keys?", a: "Not the stored shape." },
      SEEDED_FAQS[0],
      null,
      "a string, not an entry",
      { question: "Missing its answer" },
      { answer: "Missing its question" },
      // Non-string values: the accordion would render `7`, this will not.
      { question: 7, answer: 9 },
      { question: "Blank answer", answer: "   " },
      { question: "", answer: "Blank question" },
      { question: { text: "nested" }, answer: ["also nested"] },
      SEEDED_FAQS[1],
    ]);

    expect(entries).toEqual([
      { question: SEEDED_FAQS[0].question, answer: SEEDED_FAQS[0].answer },
      { question: SEEDED_FAQS[1].question, answer: SEEDED_FAQS[1].answer },
    ]);
  });

  it("returns nothing when every entry is malformed", () => {
    expect(readFaqEntries([null, {}, { q: "x", a: "y" }, 3])).toEqual([]);
  });
});

describe("buildConditionFaqJsonLd — the plan gate", () => {
  it("emits nothing for a Basic tenant", () => {
    const nodes = buildConditionFaqJsonLd(source({ plan: "basic" }));

    expect(nodes).toEqual([]);
    expect(serializeJsonLd(nodes)).toBeNull();
  });

  it("emits nothing when the plan cannot be resolved", () => {
    for (const plan of [null, undefined, "", "enterprise", 3, {}]) {
      expect(
        buildConditionFaqJsonLd(source({ plan })),
        JSON.stringify(plan) ?? "undefined",
      ).toEqual([]);
    }
  });

  it("emits for every plan that includes seo.pro", () => {
    for (const plan of ["trial", "pro", "custom"]) {
      expect(
        buildConditionFaqJsonLd(source({ plan })).length,
        `plan ${plan}`,
      ).toBe(1);
    }
  });
});

describe("buildConditionFaqJsonLd — the node", () => {
  it("states each pair as a Question with an acceptedAnswer", () => {
    const questions = questionsOf(buildConditionFaqJsonLd(source()));

    expect(questions).toEqual([
      {
        "@type": "Question",
        name: SEEDED_FAQS[0].question,
        acceptedAnswer: { "@type": "Answer", text: SEEDED_FAQS[0].answer },
      },
      {
        "@type": "Question",
        name: SEEDED_FAQS[1].question,
        acceptedAnswer: { "@type": "Answer", text: SEEDED_FAQS[1].answer },
      },
    ]);
  });

  it("anchors the node to the condition's canonical on the primary host", () => {
    const node = faqNode(buildConditionFaqJsonLd(source()));

    expect(node["@id"]).toBe(`${CONDITION_URL}#faq`);
    expect(node.url).toBe(CONDITION_URL);
  });

  it("uses the custom domain, never the subdomain, when one is set", () => {
    const node = faqNode(buildConditionFaqJsonLd(source()));

    expect(String(node["@id"])).not.toContain("acme.");
  });

  it("emits nothing when the row has no valid pair", () => {
    for (const faqs of [null, [], [{ q: "x", a: "y" }], {}]) {
      const nodes = buildConditionFaqJsonLd(source({ faqs }));

      expect(nodes, JSON.stringify(faqs)).toEqual([]);
      expect(serializeJsonLd(nodes)).toBeNull();
    }
  });

  it("keeps the surviving pairs when one entry is junk", () => {
    const questions = questionsOf(
      buildConditionFaqJsonLd(
        source({ faqs: [SEEDED_FAQS[0], { question: "No answer" }] }),
      ),
    );

    expect(questions).toHaveLength(1);
    expect(questions[0]).toMatchObject({ name: SEEDED_FAQS[0].question });
  });

  it("cannot break out of the script element it is serialized into", () => {
    const hostile = "</script><script>alert(1)</script>";
    const json = serializeJsonLd(
      buildConditionFaqJsonLd(
        source({ faqs: [{ question: hostile, answer: hostile }] }),
      ),
    );

    expect(json).not.toBeNull();
    expect(json).not.toContain("</script>");
    expect(json).not.toContain("<");
    // The VALUE survives the escaping — it is the markup that cannot.
    expect(JSON.parse(json as string)).toMatchObject({
      mainEntity: [
        {
          name: hostile,
          acceptedAnswer: { text: hostile },
        },
      ],
    });
  });

  it("serializes as one document, with @context, when it is the only node", () => {
    const json = serializeJsonLd(buildConditionFaqJsonLd(source()));

    expect(JSON.parse(json as string)).toMatchObject({
      "@context": "https://schema.org",
      "@type": "FAQPage",
    });
  });
});
