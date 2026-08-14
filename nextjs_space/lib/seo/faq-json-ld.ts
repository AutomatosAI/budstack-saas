/**
 * SEO Supercharge US-017 — FAQPage structured data for a condition page.
 *
 * THE CONTENT IS ALREADY THERE. Every seeded condition carries four questions
 * and answers (scripts/seed-conditions.ts), and the page renders them as an
 * accordion (condition-detail-client.tsx:425-484). Nothing described them to a
 * machine: an accordion is a `<button>` and a collapsed `<div>`, so the answers
 * were prose a crawler had to guess at. This states them.
 *
 * WHAT THE STORED SHAPE ACTUALLY IS. `conditions.faqs` is a Prisma `Json?`
 * (prisma/schema.prisma:273) — no DB-level shape at all — but the only writer in
 * the repo is the conditions seed, and it stores an ARRAY of
 * `{ question, answer }` (seed-conditions.ts:57-61). The storefront agrees:
 * `Array.isArray(condition.faqs) ? … : []`, then `faq.question` / `faq.answer`.
 * So `{question, answer}` is the shape, verified on the writer and the reader
 * rather than assumed — and it is validated anyway, because a Json column is one
 * `psql` session away from holding anything.
 *
 * SKIP THE ENTRY, KEEP THE PAGE. Malformed entries are dropped individually and
 * the rest still emit; only a `faqs` that is not an array, or one with no valid
 * pair left in it, produces no node. This runs in the condition page's render
 * path, which has no `error.tsx` boundary above it, so a bad blob must degrade
 * to omission — a throw here is a blank page for a shopper.
 *
 * NEVER MORE THAN THE PAGE SHOWS. The rule structured data is actually policed
 * on is that the markup must match the visible content. Dropping an invalid
 * entry can only ever make the node describe LESS than the accordion renders,
 * which is the safe direction; the entries themselves are the same rows, read
 * from the same resolution the page body's API performs (own tenant, then the
 * master tenant), so the two cannot describe different content.
 *
 * WHAT IT BUYS, HONESTLY. Google has restricted FAQ rich results to
 * authoritative government and health sites since 2023, so a storefront should
 * not expect the expandable Q/A block in Google's own SERP. The node is still
 * what every other consumer reads — other engines, and the answer-extraction
 * crawlers that now sit in front of them — and it is the only machine-readable
 * form this content has ever had.
 *
 * Pro-gated by DEGRADING, like every builder here: a Basic tenant emits no
 * element and the accordion still renders.
 */

import { z } from "zod";

import { storeCanonical } from "@/lib/seo/canonical";
import { conditionPath } from "@/lib/seo/condition-paths";
import type { JsonLdNode } from "@/lib/seo/json-ld";
import { isSeoProUnlocked } from "@/lib/seo/pro-features";

/** One question and the answer to it, both trimmed and known non-empty. */
export interface FaqEntry {
  readonly question: string;
  readonly answer: string;
}

/**
 * One stored entry, fail-closed.
 *
 * Not `.strict()`: an entry that carries an extra key — an editor's `id`, an
 * ordering field — is still a valid question and answer, and `parse` returns
 * only the two fields regardless, so nothing unvetted can reach a node.
 *
 * `.trim()` runs before `.min(1)` (zod applies string checks in declared
 * order), so an answer of `"   "` is rejected rather than emitted as an empty
 * `Answer` — a Question whose answer is blank is an invalid entity, not a
 * partial one.
 */
const faqEntrySchema = z.object({
  question: z.string().trim().min(1),
  answer: z.string().trim().min(1),
});

/**
 * The usable question/answer pairs in a raw `conditions.faqs` value, in the
 * order they are stored — the order the accordion renders them in.
 *
 * Empty for anything that is not an array: an object, a string, null, or the
 * `{}` a hand-edited row could hold.
 */
export function readFaqEntries(value: unknown): readonly FaqEntry[] {
  if (!Array.isArray(value)) return [];

  const entries: readonly unknown[] = value;
  return entries.flatMap((entry: unknown) => {
    const parsed = faqEntrySchema.safeParse(entry);
    if (!parsed.success) return [];
    return [{ question: parsed.data.question, answer: parsed.data.answer }];
  });
}

export interface ConditionFaqJsonLdSource {
  /** `tenants.id` — the plan gate's subject. */
  readonly tenantId: string;
  /** Raw `tenants.plan`; parsed fail-closed by the gate. */
  readonly plan: unknown;
  readonly subdomain: string;
  readonly customDomain: string | null;
  /** `conditions.slug` — the segment the storefront route is keyed by. */
  readonly slug: unknown;
  /** Raw `conditions.faqs` Json — parsed here, never trusted. */
  readonly faqs: unknown;
}

/**
 * The `FAQPage` node for a condition page, or an empty array.
 *
 * Empty for two ordinary states: the tenant is not on Pro, or the row has no
 * valid pair to describe. A FAQPage with an empty `mainEntity` is not a smaller
 * truth than a full one — it is a page claiming to answer questions it does not
 * answer.
 *
 * The `@id` is anchored to the page's canonical (US-007's primary host, so a
 * tenant on a custom domain publishes one statement rather than a second copy
 * on `{subdomain}.budstacks.io`) and fragment-suffixed, so it names the FAQ
 * entity rather than colliding with the `#breadcrumb` node in the same graph.
 */
export function buildConditionFaqJsonLd(
  source: ConditionFaqJsonLdSource,
): readonly JsonLdNode[] {
  if (!isSeoProUnlocked({ id: source.tenantId, plan: source.plan })) return [];

  const entries = readFaqEntries(source.faqs);
  if (entries.length === 0) return [];

  const url = storeCanonical(source, conditionPath(source.slug));

  return [
    {
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      url,
      mainEntity: entries.map((entry) => ({
        "@type": "Question",
        name: entry.question,
        acceptedAnswer: { "@type": "Answer", text: entry.answer },
      })),
    },
  ];
}
