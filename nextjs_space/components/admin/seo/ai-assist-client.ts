"use client";

/**
 * SEO Supercharge US-025 — the browser half of "Generate with Automatos AI":
 * ask for a draft, and turn everything that can come back into one of three
 * things the editor knows how to render.
 *
 * SPLIT OUT OF THE COMPONENT so the mapping is unit-testable — this repo has no
 * React-rendering test setup, so a fetch buried in a click handler is a fetch
 * nothing ever asserts on. Same device as `./audit-client` and the email run's
 * `email-settings-client.ts`.
 *
 * FAILS CLOSED ON THE BODY. A proxy error page, a stale deploy or a 500 rendered
 * as HTML all arrive here as "not what the type says", and a handler that trusts
 * the shape would push `undefined` into a form field. Anything unreadable becomes
 * an error state carrying a sentence, never a draft.
 *
 * THE SENTENCES LIVE HERE, THE REASONS COME FROM THE SERVER. The route returns
 * machine-readable `status`/`reason` fields; the wording is the UI's job, which
 * is what lets one refusal say how far over the limit the draft was while a
 * rejected API key points at the settings page instead.
 *
 * Dependency-free apart from two pure modules — it is imported by a client
 * component, so no zod and nothing that reaches prisma.
 */

import { UPGRADE_REQUIRED_CODE } from "@/lib/entitlements/plan";
import type {
  AiAssistEntityKind,
  AiAssistKind,
} from "@/lib/seo/ai-assist-contract";

export const SEO_AI_ASSIST_API_PATH = "/api/tenant-admin/seo/ai-assist";

const UNREADABLE =
  "The draft came back in a form this page could not read. Try again in a moment.";
const NETWORK_ERROR =
  "Could not reach the server. Check your connection and retry.";
const GENERIC_FAILURE =
  "The assistant could not draft that. Try again in a moment.";

/** What the editor asks for: a field, on one entity it is already editing. */
export interface SeoDraftRequest {
  readonly kind: AiAssistKind;
  readonly entityType: AiAssistEntityKind;
  readonly entityId: string;
}

export type SeoDraftOutcome =
  | { readonly ok: true; readonly text: string }
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

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** "in 40 seconds" / "in a moment" — never "in NaN seconds". */
function retryIn(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "in a moment";
  return seconds < 60
    ? `in ${seconds} seconds`
    : `in ${Math.ceil(seconds / 60)} minutes`;
}

function refusalMessage(body: Record<string, unknown>): string {
  const maxLength = num(body.maxLength);
  const length = num(body.length);

  // The over-length draft itself is not sent (US-024: a clipped sentence that
  // reached the field would be saved by the next click), so the message says how
  // far over it went and offers another go.
  if (body.reason === "too_long" && maxLength !== null && length !== null) {
    return `The draft came back at ${length} characters, over the ${maxLength}-character limit, so it was not used. Try again.`;
  }
  return "The assistant did not answer with usable text. Try again.";
}

function errorMessage(body: Record<string, unknown>): string {
  switch (body.reason) {
    case "auth":
      // Names the field to fix, never the value. The key is a stored credential
      // and appears in no message, log or response anywhere in this feature.
      return "Automatos AI rejected the API key saved in your settings. Check it and try again.";
    case "timeout":
      return "The assistant took too long to answer. Try again.";
    case "upstream":
      return "Automatos AI could not be reached. Try again in a moment.";
    default:
      // lookup_failed / rate_limiter_unavailable — our side, not theirs.
      return "Drafting is temporarily unavailable. Try again in a moment.";
  }
}

/**
 * The sentence for a response that is not a draft, and whether the refusal was
 * about the PLAN.
 *
 * `upgrade_required` is what `requireFeature` returns and a permission 403 does
 * not carry it — the difference between "buy the plan" and "ask your admin", and
 * offering the wrong one sends somebody to the wrong place.
 */
export function draftFailureMessage(
  status: number,
  body: unknown,
): { readonly error: string; readonly upgradeRequired: boolean } {
  const record = isRecord(body) ? body : {};
  const upgradeRequired = record.code === UPGRADE_REQUIRED_CODE;
  const serverSentence = str(record.error);

  if (upgradeRequired) {
    return { error: serverSentence || GENERIC_FAILURE, upgradeRequired: true };
  }

  if (status === 429) {
    return {
      error: `You have generated several drafts just now. Try again ${retryIn(num(record.retryAfterSeconds))}.`,
      upgradeRequired: false,
    };
  }

  if (record.status === "refused") {
    return { error: refusalMessage(record), upgradeRequired: false };
  }

  if (record.status === "error") {
    return { error: errorMessage(record), upgradeRequired: false };
  }

  // A permission 403, a 404, a 400 — the server's own sentence is the best one.
  return { error: serverSentence || GENERIC_FAILURE, upgradeRequired: false };
}

/**
 * Ask for one draft.
 *
 * Never throws: every failure is a rendered state, because this is called from a
 * click handler with no error boundary above it.
 */
export async function requestSeoDraft(
  request: SeoDraftRequest,
): Promise<SeoDraftOutcome> {
  let response: Response;
  try {
    response = await fetch(SEO_AI_ASSIST_API_PATH, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    return { ok: false, unavailable: false, error: NETWORK_ERROR, upgradeRequired: false };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return response.ok
      ? { ok: false, unavailable: false, error: UNREADABLE, upgradeRequired: false }
      : { ok: false, unavailable: false, error: GENERIC_FAILURE, upgradeRequired: false };
  }

  if (!response.ok) {
    return { ok: false, unavailable: false, ...draftFailureMessage(response.status, body) };
  }

  const record = isRecord(body) ? body : {};

  // A 200 that is not a draft: the tenant has no Automatos account connected.
  // A state, not an error — the editor answers it with the connect card.
  if (record.status === "unavailable") return { ok: false, unavailable: true };

  const text = str(record.text).trim();
  return record.status === "ok" && text
    ? { ok: true, text }
    : { ok: false, unavailable: false, error: UNREADABLE, upgradeRequired: false };
}
