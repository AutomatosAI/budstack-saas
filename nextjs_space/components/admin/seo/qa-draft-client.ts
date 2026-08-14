"use client";

/**
 * LLM Visibility US-002 — the browser half of "Draft Q&A with Automatos AI":
 * ask for a list of pairs, and turn everything that can come back into one of
 * three things the editor knows how to render.
 *
 * SPLIT OUT OF THE COMPONENT so the mapping is unit-testable — this repo has no
 * React-rendering test setup, so a fetch buried in a click handler is a fetch
 * nothing ever asserts on. Same device as `./ai-assist-client`, whose failure
 * mapping this reuses wholesale: the two routes answer the same statuses and
 * reasons for everything that is not a draft, so there is one place that decides
 * what "auth" or a 429 says to an owner.
 *
 * FAILS CLOSED ON THE BODY. A proxy error page, a stale deploy or a 500 rendered
 * as HTML all arrive here as "not what the type says". Every pair is re-checked
 * against the storage limits before it reaches the editor — the server validated
 * them, and this is not where we start trusting that.
 */

import {
  PRODUCT_QA_LIMITS,
  readProductQa,
  type ProductQaPair,
} from "@/lib/seo/product-qa";
import { draftFailureMessage } from "./ai-assist-client";

export const SEO_QA_DRAFT_API_PATH = "/api/tenant-admin/seo/ai-assist/qa";

const UNREADABLE =
  "The draft came back in a form this page could not read. Try again in a moment.";
const NETWORK_ERROR =
  "Could not reach the server. Check your connection and retry.";

/** Why a Q&A draft was refused, in words. Keyed by the server's `reason`. */
const REFUSAL_MESSAGE: Readonly<Record<string, string>> = {
  too_many: `The assistant came back with more than ${PRODUCT_QA_LIMITS.maxPairs} questions, so none were used. Try again.`,
  question_too_long: `One of the questions was over ${PRODUCT_QA_LIMITS.maxQuestionLength} characters, so the draft was not used. Try again.`,
  answer_too_long: `One of the answers was over ${PRODUCT_QA_LIMITS.maxAnswerLength} characters, so the draft was not used. Try again.`,
  empty: "The assistant did not come back with any questions. Try again.",
};

const GENERIC_REFUSAL =
  "The assistant did not answer with usable questions. Try again.";

export type QaDraftOutcome =
  | { readonly ok: true; readonly pairs: readonly ProductQaPair[] }
  /** No Automatos account on this tenant — the editor shows the connect card. */
  | { readonly ok: false; readonly unavailable: true }
  | {
      readonly ok: false;
      readonly unavailable: false;
      readonly error: string;
      /** True only for the plan gate's 403 — offers an upgrade, not a retry. */
      readonly upgradeRequired: boolean;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failure(error: string, upgradeRequired = false): QaDraftOutcome {
  return { ok: false, unavailable: false, error, upgradeRequired };
}

/**
 * The sentence for a refused Q&A draft.
 *
 * Its own table rather than `draftFailureMessage`'s: the parent's refusal copy
 * is about ONE over-long string and quotes a character count, which says nothing
 * useful about a list. Every other failure — 429, the plan 403, `auth`,
 * `upstream`, our own outage — goes through the shared mapping unchanged.
 */
function qaFailure(status: number, body: unknown): QaDraftOutcome {
  const record = isRecord(body) ? body : {};

  if (record.status === "refused" && status === 422) {
    const reason = typeof record.reason === "string" ? record.reason : "";
    return failure(REFUSAL_MESSAGE[reason] ?? GENERIC_REFUSAL);
  }

  const { error, upgradeRequired } = draftFailureMessage(status, body);
  return failure(error, upgradeRequired);
}

/**
 * Ask for one product's Q&A.
 *
 * Never throws: every failure is a rendered state, because this is called from a
 * click handler with no error boundary above it.
 */
export async function requestQaDraft(
  productId: string,
): Promise<QaDraftOutcome> {
  let response: Response;
  try {
    response = await fetch(SEO_QA_DRAFT_API_PATH, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ productId }),
    });
  } catch {
    return failure(NETWORK_ERROR);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return failure(UNREADABLE);
  }

  if (!response.ok) return qaFailure(response.status, body);

  const record = isRecord(body) ? body : {};

  // A 200 that is not a draft: the tenant has no Automatos account connected.
  // A state, not an error — the editor answers it with the connect card.
  if (record.status === "unavailable") return { ok: false, unavailable: true };

  // Re-parsed with the storage reader, so a pair that could not be SAVED can
  // never be shown as a draft the owner is about to save.
  const pairs = readProductQa(record.pairs);
  return record.status === "ok" && pairs.length > 0
    ? { ok: true, pairs }
    : failure(UNREADABLE);
}
