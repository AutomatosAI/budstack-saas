/**
 * LLM Visibility US-002 — what we ask an AI for when we ask for Q&A, and what we
 * are willing to accept back.
 *
 * A SECOND OUTPUT CONTRACT, NOT A SECOND ASSISTANT. The credential lookup, the
 * per-tenant meter, the provider interface and the tenant-own-account rule are
 * all US-024's and are reused unchanged (`lib/seo/ai-assist.ts`). What differs is
 * the SHAPE of a valid answer: `{"text": "..."}` cannot express a list, so this
 * module asks for a JSON array of pairs and judges one.
 *
 * THE RULE THE PARENT CONTRACT WROTE DOWN, APPLIED TO A LIST: a draft that
 * violates the contract is REFUSED, never repaired. That is stricter here than
 * it is for a single field, on purpose — the alternative is silently dropping
 * the two pairs of eleven that were over-length, which hands an owner a shorter
 * list than the model wrote and than they were shown a count of. One refusal and
 * one more click is honest; a quietly edited list is not.
 *
 * NOTHING IS SAVED, and nothing here writes. The pairs land in the editor as
 * ordinary editable rows and the owner's own save is still the only writer —
 * the same review step every AI-drafted field in this feature goes through.
 *
 * Pure module — no I/O, no next, no prisma. The limits it validates against are
 * `PRODUCT_QA_LIMITS`, which the storage parser, the write route's zod schema
 * and the editor's counters all read too.
 */

import {
  PRODUCT_QA_LIMITS,
  type ProductQaPair,
} from "@/lib/seo/product-qa";
import { seoText, truncateSeoText } from "@/lib/seo/store-identity";

/** How much of the product's own copy the prompt may carry. US-024's bound. */
export const QA_DRAFT_SOURCE_MAX_CHARS = 1200;

/** How many pairs we ASK for — under the cap, so a compliant model never trips it. */
export const QA_DRAFT_TARGET_PAIRS = 5;

/** The product this Q&A is about. The tenant's own row, never another's. */
export interface QaDraftSource {
  /** The product's own name. */
  readonly name: string;
  /** The product's own description. Excerpted here, not by the caller. */
  readonly body?: string;
  /** The tenant's own store name, for voice. Never another tenant's. */
  readonly storeName?: string;
}

/**
 * The single `message` string sent to the provider.
 *
 * THE INSTRUCTIONS THAT ARE NOT DECORATION. "Use only the facts below" and the
 * ban on inventing medical, potency or availability claims are the same clause
 * US-024 sends, and they matter more here: a Q&A block is read as the store
 * ANSWERING, and an invented "yes, this treats insomnia" would be a medical
 * claim published in the owner's name and, worse, one an answer engine would
 * quote back as theirs. A model that has nothing to answer a question with is
 * told to leave the question out rather than fill it in.
 *
 * The limits are stated as well as enforced: the prompt makes compliance likely,
 * {@link parseQaDraft} makes it certain.
 */
export function buildQaDraftPrompt(source: QaDraftSource): string {
  const name = seoText(source.name);
  const body = truncateSeoText(source.body, QA_DRAFT_SOURCE_MAX_CHARS);
  const storeName = seoText(source.storeName);

  const facts = [
    `cannabis product name: ${name}`,
    body ? `product description: ${body}` : "",
    storeName ? `store name: ${storeName}` : "",
  ].filter(Boolean);

  return [
    `Write up to ${QA_DRAFT_TARGET_PAIRS} questions a shopper would ask about this cannabis product, each with a short factual answer.`,
    "",
    "Use ONLY the facts below. Do not invent claims about medical benefits, potency, price, delivery or availability. If a question cannot be answered from these facts, leave that question out.",
    "",
    ...facts,
    "",
    'Reply with JSON and nothing else: an array in exactly this form: [{"question": "...", "answer": "..."}]',
    `Every question must be ${PRODUCT_QA_LIMITS.maxQuestionLength} characters or fewer and every answer ${PRODUCT_QA_LIMITS.maxAnswerLength} or fewer. Plain text only — no markdown, no numbering, no explanation outside the JSON.`,
  ].join("\n");
}

/** Why a Q&A draft was refused. Each maps to a distinct message in the editor. */
export type QaDraftRefusal =
  | "not_json"
  | "not_array"
  | "not_pairs"
  | "empty"
  | "too_many"
  | "question_too_long"
  | "answer_too_long";

export type QaDraftParse =
  | { readonly ok: true; readonly pairs: readonly ProductQaPair[] }
  | { readonly ok: false; readonly reason: QaDraftRefusal };

/**
 * Models wrap JSON in a markdown fence roughly as often as they do not.
 * Unwrapping it is transport, not repair — the JSON inside is judged unchanged.
 * Duplicated from `./ai-assist-contract` rather than exported across: it is four
 * lines of string handling, and the alternative is a contract module importing
 * another contract module for a detail neither owns.
 */
function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) return trimmed;

  const withoutOpen = trimmed.replace(/^```[a-zA-Z]*\s*/, "");
  const close = withoutOpen.lastIndexOf("```");
  return (close >= 0 ? withoutOpen.slice(0, close) : withoutOpen).trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** One line of text, normalised the way the stored value will be. */
function normalise(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/**
 * The pairs a completion actually contains, or the reason it is not a draft.
 *
 * Order matters, and it is the parent contract's order: shape first (JSON, an
 * array, entries that are two strings), then content (is there anything in
 * them), then the LIMITS last and against the normalised strings — so a model
 * that answered inside the budget but padded a line with a newline is not
 * refused for a character nobody would have seen.
 *
 * The offending text never travels back with the refusal, for the reason the
 * `too_long` case documents in US-024: anything returned to the editor is one
 * click away from being saved.
 */
export function parseQaDraft(raw: string): QaDraftParse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    return { ok: false, reason: "not_json" };
  }

  if (!Array.isArray(parsed)) return { ok: false, reason: "not_array" };

  const entries: readonly unknown[] = parsed;
  if (entries.length === 0) return { ok: false, reason: "empty" };
  if (entries.length > PRODUCT_QA_LIMITS.maxPairs) {
    return { ok: false, reason: "too_many" };
  }

  const pairs: ProductQaPair[] = [];
  for (const entry of entries) {
    if (!isRecord(entry)) return { ok: false, reason: "not_pairs" };

    const question = normalise(entry.question);
    const answer = normalise(entry.answer);
    if (!question || !answer) return { ok: false, reason: "not_pairs" };

    if (question.length > PRODUCT_QA_LIMITS.maxQuestionLength) {
      return { ok: false, reason: "question_too_long" };
    }
    if (answer.length > PRODUCT_QA_LIMITS.maxAnswerLength) {
      return { ok: false, reason: "answer_too_long" };
    }

    pairs.push({ question, answer });
  }

  return { ok: true, pairs };
}
