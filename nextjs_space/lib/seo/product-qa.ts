/**
 * LLM Visibility US-002 — the questions a product answers, and the one parser
 * that decides which of them are real.
 *
 * WHY A PRODUCT NEEDS THIS AT ALL. An answer engine does not rank a page, it
 * ANSWERS a question, and the pages it can answer from are the ones that state a
 * question and answer it in the same breath. A strain description does not: it is
 * marketing prose about aroma and lineage, and "is this good for sleep?" has to
 * be inferred from it. A stored pair is the same content in the shape the
 * extraction actually reads — and, emitted as `FAQPage`, in the shape a machine
 * reads without inferring anything.
 *
 * WHERE IT LIVES. `products.seo.qa` — a key in the authored Json record every
 * other SEO field already shares (`lib/seo/entity-seo.ts`), so there is no
 * migration, no new column and no second thing for `products/sync` to preserve
 * (it never writes `seo` at all — app/api/tenant-admin/products/sync/route.ts
 * :55-102 — so authored pairs survive every catalogue re-sync).
 *
 * DEPENDENCY-FREE, AND DELIBERATELY SO. `entity-seo.ts` imports this module and
 * is itself imported by a client component; it states in its own docstring that
 * it carries no zod, no next and no prisma, and this file inherits that contract.
 * That is why the validation here is hand-rolled rather than a zod schema — the
 * SHAPE is asserted in both directions (the write route's zod schema on the way
 * in, this parser on the way out), which is the same arrangement
 * `isCanonicalOverrideUrl` already has.
 *
 * THE LIMITS ARE ONE SET OF NUMBERS. The route's zod schema, the editor's
 * character counters, the AI draft contract and this reader all import
 * {@link PRODUCT_QA_LIMITS}. A value that was legal when it was written stays
 * legal when it is read.
 */

import { seoText } from "@/lib/seo/store-identity";

/** One question and the answer to it, both trimmed and known non-empty. */
export interface ProductQaPair {
  readonly question: string;
  readonly answer: string;
}

export interface ProductQaLimits {
  readonly maxPairs: number;
  readonly maxQuestionLength: number;
  readonly maxAnswerLength: number;
}

/**
 * How much Q&A one product may carry.
 *
 * Ten pairs is where a page stops being a product page with answers on it and
 * starts being an FAQ that happens to sell something; it is also comfortably
 * more than the three or four questions a shopper actually repeats. 200
 * characters is a question — anything longer is a paragraph with a question mark
 * at the end, which is not what gets matched. 1000 for an answer is roughly a
 * substantial paragraph: long enough to answer properly, short enough that the
 * accordion stays readable and the `FAQPage` node stays a summary rather than a
 * second copy of the page.
 */
export const PRODUCT_QA_LIMITS: ProductQaLimits = {
  maxPairs: 10,
  maxQuestionLength: 200,
  maxAnswerLength: 1000,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * One line of text, at the length the writer was held to.
 *
 * Whitespace is collapsed for the same reason the AI contract collapses it: the
 * question renders in a `<summary>` and lands in a JSON-LD `name`, and the length
 * that decides the limit has to be measured on what is actually published. The
 * cap is applied AFTER collapsing, so a compliant string padded with newlines is
 * not rejected for characters nobody sees.
 *
 * "" when the value is not a usable string or does not fit — the caller drops
 * the entry rather than storing a clipped one.
 */
function qaField(value: unknown, maxLength: number): string {
  const text = seoText(value).replace(/\s+/g, " ");
  return text.length > 0 && text.length <= maxLength ? text : "";
}

/**
 * One stored entry, or null.
 *
 * Extra keys on the entry are ignored rather than fatal — an editor's `id` or an
 * ordering field is still a valid question and answer, and only the two fields
 * below are ever returned, so nothing unvetted reaches the page.
 */
function readProductQaPair(value: unknown): ProductQaPair | null {
  if (!isRecord(value)) return null;

  const question = qaField(value.question, PRODUCT_QA_LIMITS.maxQuestionLength);
  const answer = qaField(value.answer, PRODUCT_QA_LIMITS.maxAnswerLength);
  if (!question || !answer) return null;

  return { question, answer };
}

/**
 * The usable pairs in a raw `products.seo.qa` value, in the order they are
 * stored — the order the accordion renders them in.
 *
 * SKIP THE ENTRY, KEEP THE PAGE, exactly as `readFaqEntries` does for a
 * condition: this runs in the product page's render path, which has no
 * `error.tsx` boundary above it, so a hand-edited blob must degrade to fewer
 * questions rather than to a blank page for a shopper. Dropping an entry can
 * only ever make the page and the `FAQPage` node describe LESS than was stored,
 * which is the safe direction — the pair that is dropped is dropped from both,
 * because both read this function.
 *
 * Empty for anything that is not an array. The excess beyond `maxPairs` is cut
 * rather than treated as fatal, for the same reason: the cap is the write
 * route's, and a blob that got past it by another path still has ten good
 * questions in it.
 */
export function readProductQa(value: unknown): readonly ProductQaPair[] {
  if (!Array.isArray(value)) return [];

  const entries: readonly unknown[] = value;
  return entries
    .flatMap((entry: unknown) => {
      const pair = readProductQaPair(entry);
      return pair ? [pair] : [];
    })
    .slice(0, PRODUCT_QA_LIMITS.maxPairs);
}

/**
 * Did this request try to write Q&A?
 *
 * PRESENCE, not length — the same rule `hasIndexingFields` follows. An empty
 * array is how the editor says "I removed the last question", which is a Pro
 * write and must be gated as one; an ABSENT key is a save that never mentioned
 * Q&A (a Basic tenant saving a title), which must leave whatever is stored
 * exactly where it is. JSON has no `undefined`, so the two are distinguishable.
 */
export function hasQaField(body: { readonly qa?: unknown }): boolean {
  return body.qa !== undefined;
}
