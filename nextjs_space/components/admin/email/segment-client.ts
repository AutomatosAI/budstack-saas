/**
 * US-025 — the segment builder's request shapes, its immutable list edits, and
 * its one line of wording.
 *
 * Split out of the component for the same reason `campaign-audience-count.ts`
 * is split out of the picker: these are the parts worth pinning with tests, and
 * none of them needs a DOM to exercise.
 *
 * VALIDITY IS THE PARSER'S ANSWER, not a second opinion. The builder holds a
 * criteria list that is allowed to be half-written — an empty tag box, a
 * cleared number — and {@link readySegmentFilter} asks `parseSegmentFilter`
 * whether what it holds is a rule yet. One definition of "valid", used by the
 * save button, the count effect and the server.
 */

import {
  SEGMENT_CRITERION_OPTIONS,
  parseSegmentFilter,
  segmentCriterionOption,
  toSegmentSummary,
  type SegmentCriterion,
  type SegmentCriterionKind,
  type SegmentFilter,
  type SegmentSummary,
} from "@/lib/email/segment-filter";

import { isAbortError } from "./campaign-audience-count";

export const SEGMENTS_URL = "/api/tenant-admin/segments";

export const SEGMENT_COUNT_FAILED_MESSAGE =
  "Couldn't work out how many people this rule reaches.";

export const SEGMENT_SAVE_FAILED_MESSAGE = "Failed to save segment";

export interface SegmentCount {
  /** Customers the rule describes, before consent and suppression. */
  readonly matched: number;
  /** Of those, how many a campaign would actually be delivered to. */
  readonly count: number;
  /** Of the consented ones, how many the suppression list removed. */
  readonly suppressed: number;
}

/**
 * The criteria as a rule, or `null` while they are still half-written.
 *
 * The SAME function the API runs on the stored column, so a filter the builder
 * calls ready is one the server can read back.
 */
export function readySegmentFilter(
  criteria: readonly SegmentCriterion[],
): SegmentFilter | null {
  return parseSegmentFilter({ criteria });
}

/** The criterion an axis starts as when the author ticks it on. */
export function defaultCriterion(kind: SegmentCriterionKind): SegmentCriterion {
  const option = segmentCriterionOption(kind);
  switch (kind) {
    case "last-order-age":
      return { kind, days: option?.value?.default ?? 60 };
    case "order-count-min":
      return { kind, count: option?.value?.default ?? 2 };
    case "has-tag":
      // Deliberately unreadable until typed into: an empty tag is not a rule,
      // and `readySegmentFilter` is what says so.
      return { kind, tag: "" };
    default:
      return { kind };
  }
}

export function findCriterion(
  criteria: readonly SegmentCriterion[],
  kind: SegmentCriterionKind,
): SegmentCriterion | undefined {
  return criteria.find((criterion) => criterion.kind === kind);
}

/**
 * Add or replace one axis, keeping the declared axis order.
 *
 * Order matters only to the eye — the criteria are ANDed — but a rule whose
 * rows reshuffle as they are edited is a rule nobody can re-read.
 */
export function withCriterion(
  criteria: readonly SegmentCriterion[],
  criterion: SegmentCriterion,
): SegmentCriterion[] {
  const replaced = criteria.some((entry) => entry.kind === criterion.kind)
    ? criteria.map((entry) => (entry.kind === criterion.kind ? criterion : entry))
    : [...criteria, criterion];

  return sortByDeclaredOrder(replaced);
}

export function withoutCriterion(
  criteria: readonly SegmentCriterion[],
  kind: SegmentCriterionKind,
): SegmentCriterion[] {
  return criteria.filter((criterion) => criterion.kind !== kind);
}

function sortByDeclaredOrder(
  criteria: readonly SegmentCriterion[],
): SegmentCriterion[] {
  const order = SEGMENT_CRITERION_OPTIONS.map((option) => option.kind);
  return [...criteria].sort(
    (left, right) => order.indexOf(left.kind) - order.indexOf(right.kind),
  );
}

type JsonObject = Record<string, unknown>;

async function readJson(res: Response): Promise<JsonObject | null> {
  const payload: unknown = await res.json().catch(() => null);
  return typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? (payload as JsonObject)
    : null;
}

/** The error an API answer carries, in the wording the author should see. */
function apiMessage(payload: JsonObject | null, fallback: string): string {
  // `message` first: the rate limiter answers with a `message` carrying the
  // "try again in N seconds" that a bare `error` throws away. `apiError` never
  // emits a `message` key at all, so nothing else is shadowed by reading it.
  const message = payload?.message;
  if (typeof message === "string" && message) return message;
  const error = payload?.error;
  if (typeof error === "string" && error) return error;
  return fallback;
}

/** A number the API sent, or `fallback` when it sent something else. */
function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

export async function fetchSegmentCount(
  filter: SegmentFilter,
  signal?: AbortSignal,
): Promise<SegmentCount> {
  const res = await fetch(`${SEGMENTS_URL}/count`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(filter),
    signal,
  }).catch((error: unknown) => {
    if (isAbortError(error)) throw error;
    throw new Error(SEGMENT_COUNT_FAILED_MESSAGE);
  });

  const payload = await readJson(res);
  if (!res.ok) {
    throw new Error(apiMessage(payload, SEGMENT_COUNT_FAILED_MESSAGE));
  }

  const count = payload?.count;
  if (typeof count !== "number") {
    throw new Error(SEGMENT_COUNT_FAILED_MESSAGE);
  }

  return {
    // `matched` defaults to `count` rather than to 0: an older server that
    // answers without it would otherwise make the line claim every recipient
    // had been filtered out.
    matched: numberOr(payload?.matched, count),
    count,
    suppressed: numberOr(payload?.suppressed, 0),
  };
}

export interface SaveSegmentInput {
  /** Absent for a new segment; present turns the save into an edit. */
  readonly id?: string;
  readonly name: string;
  readonly filter: SegmentFilter;
}

export async function saveSegment(
  input: SaveSegmentInput,
): Promise<SegmentSummary> {
  const res = await fetch(
    input.id ? `${SEGMENTS_URL}/${encodeURIComponent(input.id)}` : SEGMENTS_URL,
    {
      method: input.id ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: input.name, filter: input.filter }),
    },
  );

  const payload = await readJson(res);
  if (!res.ok) throw new Error(apiMessage(payload, SEGMENT_SAVE_FAILED_MESSAGE));

  const { id, name, updatedAt } = payload ?? {};
  if (
    typeof id !== "string" ||
    typeof name !== "string" ||
    typeof updatedAt !== "string"
  ) {
    throw new Error(SEGMENT_SAVE_FAILED_MESSAGE);
  }

  // Re-narrowed through the SAME fold the server answered with, so the row
  // handed back to the list cannot be a shape this build does not understand.
  return toSegmentSummary({ id, name, filter: payload?.filter, updatedAt });
}

export async function deleteSegment(id: string): Promise<void> {
  const res = await fetch(`${SEGMENTS_URL}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(apiMessage(await readJson(res), "Failed to delete segment"));
  }
}

export const NO_CRITERIA_MESSAGE = "Add at least one rule to see who this reaches.";
export const COUNTING_MESSAGE = "Counting…";

export interface SegmentCountInput {
  /** False while the criteria are not yet a rule the server could read. */
  readonly hasRule: boolean;
  readonly isCounting: boolean;
  readonly error: string | null;
  readonly result: SegmentCount | null;
}

export interface SegmentCountLine {
  readonly text: string;
  readonly tone: "muted" | "error" | "count";
}

/**
 * The count as a sentence.
 *
 * Three numbers, because one would mislead. `matched` is what the rule
 * describes; the send applies marketing consent and the suppression list on top
 * of it whatever the rule says, so an author shown only the first figure would
 * be promised an audience no campaign can reach. Zero is called out in words
 * rather than printed as "0 recipients" — a rule that reaches nobody is the one
 * result nobody should skim past.
 */
export function formatSegmentCount(result: SegmentCount): string {
  const withoutConsent = Math.max(
    0,
    result.matched - result.count - result.suppressed,
  );

  const asides = [
    withoutConsent > 0 ? `${withoutConsent} without marketing consent` : "",
    result.suppressed > 0
      ? `${result.suppressed} excluded (unsubscribed, bounced or blocked)`
      : "",
  ].filter(Boolean);

  const head =
    result.count === 0
      ? "Nobody — this rule reaches no one right now"
      : result.count === 1
        ? "1 recipient"
        : `${result.count} recipients`;

  return [head, ...asides].join(" · ");
}

/** The one line under the builder, in precedence order. */
export function segmentCountLine(input: SegmentCountInput): SegmentCountLine {
  if (!input.hasRule) return { text: NO_CRITERIA_MESSAGE, tone: "muted" };
  if (input.isCounting) return { text: COUNTING_MESSAGE, tone: "muted" };
  if (input.error) return { text: input.error, tone: "error" };
  // Ready, not counting, no answer yet: the frame between an edit and the
  // effect that asks about it.
  if (!input.result) return { text: COUNTING_MESSAGE, tone: "muted" };
  return { text: formatSegmentCount(input.result), tone: "count" };
}
