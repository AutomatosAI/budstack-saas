/**
 * SEO Supercharge US-024 — what we ask an AI for, and what we are willing to
 * accept back.
 *
 * The provider is a general-purpose chat endpoint (see `./automatos-client`):
 * it will happily return a paragraph of prose, a markdown code fence, an
 * apology, or a 300-character "meta title". None of those may reach a
 * `<title>` tag, so the contract is enforced HERE, on the way back in, rather
 * than trusted to the prompt.
 *
 * The rule that shapes every decision below: a draft that violates the contract
 * is REFUSED, never repaired. Silently truncating a 74-character title to 60
 * hands the owner a sentence the model did not write and did not end — clipped
 * mid-word, in their name, in a search result. Refusing costs one more click and
 * is always honest. (Normalising whitespace is not repair: a meta tag cannot
 * carry a newline, and the length that matters is measured after it.)
 *
 * Pure module — no I/O, no next, no prisma. Imported by the service, the route
 * (US-025) and the tests; the same limits drive the editor's character counters.
 */

import { seoText, truncateSeoText, SEO_DESCRIPTION_MAX_LENGTH } from "@/lib/seo/store-identity";

/** The three fields the SEO editors can ask for a draft of. */
export const AI_ASSIST_KINDS = ["title", "description", "imageAlt"] as const;
export type AiAssistKind = (typeof AI_ASSIST_KINDS)[number];

/**
 * The hard ceiling per kind, in characters.
 *
 * `description` reuses the platform's existing 160 (`SEO_DESCRIPTION_MAX_LENGTH`)
 * rather than restating it, so the AI's limit and the truncation limit every
 * derived description already obeys cannot drift apart. 60 for a title is the
 * width Google has rendered around for years; 120 for alt text is where screen
 * readers stop being useful — long alt is read out in full, and a paragraph
 * announced before every image is worse than a short accurate one.
 */
export const AI_ASSIST_MAX_LENGTH: Readonly<Record<AiAssistKind, number>> = {
  title: 60,
  description: SEO_DESCRIPTION_MAX_LENGTH,
  imageAlt: 120,
};

/** What the entity IS, in words a model understands. */
export const AI_ASSIST_ENTITY_KINDS = [
  "product",
  "post",
  "condition",
  "page",
] as const;
export type AiAssistEntityKind = (typeof AI_ASSIST_ENTITY_KINDS)[number];

const ENTITY_NOUN: Readonly<Record<AiAssistEntityKind, string>> = {
  product: "cannabis product",
  post: "blog article",
  condition: "medical condition page",
  page: "store page",
};

const KIND_BRIEF: Readonly<Record<AiAssistKind, string>> = {
  title:
    "an HTML meta title — the clickable headline in a search result. Lead with what the page is about, not the store name.",
  description:
    "an HTML meta description — the sentence under the search result. Say what the reader gets from the page, in plain language.",
  imageAlt:
    "alt text for this entity's image — describe what is visible for someone who cannot see it. Do not begin with \"image of\".",
};

/**
 * How much of the entity's own body copy goes into the prompt.
 *
 * Enough for the model to have something to summarise, bounded because the
 * tenant pays their own Automatos account per call and because an unbounded
 * product description is a way to push the real instruction out of the model's
 * attention. Clipped with the platform's own truncator — this is INPUT, where
 * clipping is legitimate.
 */
export const AI_ASSIST_SOURCE_MAX_CHARS = 1200;

/**
 * Everything the prompt is allowed to contain.
 *
 * Deliberately a closed shape of the tenant's OWN entity content. There is no
 * tenant id, no customer data, no "here is how other stores word this" — the
 * caller physically cannot smuggle another tenant's rows into a prompt through
 * this type, and the assertion is testable because the builder reads nothing
 * that is not on it.
 */
export interface AiAssistSource {
  readonly entityKind: AiAssistEntityKind;
  /** The entity's own name or title. */
  readonly name: string;
  /** The entity's own description or body copy. Excerpted here, not by callers. */
  readonly body?: string;
  /** The tenant's own store name, for voice. Never another tenant's. */
  readonly storeName?: string;
}

/**
 * The single `message` string sent to the provider.
 *
 * JSON is demanded because a bare completion cannot be distinguished from a
 * refusal, a preamble or a markdown wrapper, and {@link parseAiDraft} must be
 * able to tell "the model answered" from "the model chatted". The limit is
 * stated in the prompt as well as enforced on the way back: the prompt makes
 * compliance likely, the parser makes it certain.
 */
export function buildAiAssistPrompt(
  kind: AiAssistKind,
  source: AiAssistSource,
): string {
  const maxLength = AI_ASSIST_MAX_LENGTH[kind];
  const noun = ENTITY_NOUN[source.entityKind];
  const name = seoText(source.name);
  const body = truncateSeoText(source.body, AI_ASSIST_SOURCE_MAX_CHARS);
  const storeName = seoText(source.storeName);

  const facts = [
    `${noun} name: ${name}`,
    body ? `${noun} content: ${body}` : "",
    storeName ? `store name: ${storeName}` : "",
  ].filter(Boolean);

  return [
    `Write ${KIND_BRIEF[kind]}`,
    "",
    "Use ONLY the facts below. Do not invent claims about medical benefits, potency, price or availability.",
    "",
    ...facts,
    "",
    `Reply with JSON and nothing else, in exactly this form: {"text": "..."}`,
    `The value of "text" must be plain text, one line, ${maxLength} characters or fewer. No markdown, no quotes around the whole answer, no explanation.`,
  ].join("\n");
}

/** Why a draft was refused. Each maps to a distinct message in the editor. */
export type AiDraftRefusal =
  | "not_json"
  | "no_text_field"
  | "empty"
  | "too_long";

export type AiDraftParse =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly reason: AiDraftRefusal; readonly length?: number };

/**
 * Models wrap JSON in a markdown fence roughly as often as they do not.
 * Unwrapping it is transport, not repair — the JSON inside is judged unchanged.
 */
function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```")) return trimmed;

  const withoutOpen = trimmed.replace(/^```[a-zA-Z]*\s*/, "");
  const close = withoutOpen.lastIndexOf("```");
  return (close >= 0 ? withoutOpen.slice(0, close) : withoutOpen).trim();
}

/**
 * The draft a completion actually contains, or the reason it is not one.
 *
 * Order matters: shape first (is this JSON with a `text` string at all), then
 * content (is there anything in it), then length LAST and against the normalised
 * string — so a model that answered with a compliant sentence padded by a
 * trailing newline is not refused for a character it did not mean to send.
 *
 * `length` accompanies `too_long` so the editor can tell the owner how far over
 * it went; the over-length text itself is deliberately NOT returned, because a
 * draft that reached the field would be saved by the next click.
 */
export function parseAiDraft(kind: AiAssistKind, raw: string): AiDraftParse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    return { ok: false, reason: "not_json" };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: "not_json" };
  }

  const value = (parsed as Record<string, unknown>).text;
  if (typeof value !== "string") return { ok: false, reason: "no_text_field" };

  // A meta tag holds one line. Collapsing is normalisation, and the length that
  // decides the contract is measured on what would actually be rendered.
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, reason: "empty" };

  const maxLength = AI_ASSIST_MAX_LENGTH[kind];
  if (text.length > maxLength) {
    return { ok: false, reason: "too_long", length: text.length };
  }

  return { ok: true, text };
}
