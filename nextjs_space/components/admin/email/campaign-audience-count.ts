/**
 * US-018 — asking the server how many people an audience reaches, and saying
 * the answer in a sentence.
 *
 * Split out of the picker for the same reason `campaign-save.ts` is split out
 * of the editor: the request shape and the wording are the parts worth pinning
 * with tests, and neither needs a DOM to exercise.
 */

import type { CampaignAudienceType } from "@/lib/email/campaign-audience";

const CAMPAIGNS_URL = "/api/tenant-admin/campaigns";

export const AUDIENCE_COUNT_FAILED_MESSAGE =
  "Couldn't work out how many people this reaches.";

export interface AudienceCount {
  /** People this campaign would be delivered to right now. */
  readonly count: number;
  /** Of the matching addresses, how many the suppression list removed. */
  readonly suppressed: number;
}

/** A count, and the audience it is an answer to. */
export interface CountedAudience extends AudienceCount {
  readonly type: CampaignAudienceType;
}

/**
 * A count only means anything for the audience it was asked about.
 *
 * The picker re-renders the moment a radio is ticked, but the effect that
 * fetches the new figure does not run until after that paint — so without this
 * the previous audience's number would sit beside the newly-ticked option for a
 * frame, reading as an answer to a question nobody asked yet. Tagging the
 * result and comparing is deterministic where clearing state in the effect
 * would still leave that one frame on screen.
 */
export function settledCount(
  result: CountedAudience | null,
  selected: CampaignAudienceType | null,
): AudienceCount | null {
  return result && selected && result.type === selected ? result : null;
}

/** An aborted fetch is the caller's own doing, so it is re-thrown untouched. */
export function isAbortError(error: unknown): boolean {
  return (error as { name?: unknown } | null)?.name === "AbortError";
}

export async function fetchAudienceCount(
  campaignId: string,
  type: CampaignAudienceType,
  signal?: AbortSignal,
): Promise<AudienceCount> {
  const url = `${CAMPAIGNS_URL}/${encodeURIComponent(campaignId)}/audience-count?type=${encodeURIComponent(type)}`;

  const res = await fetch(url, { signal }).catch((error: unknown) => {
    if (isAbortError(error)) throw error;
    // A dropped connection rejects with the browser's own wording ("Failed to
    // fetch"); the author gets ours instead.
    throw new Error(AUDIENCE_COUNT_FAILED_MESSAGE);
  });

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    // `message` first: the rate limiter answers with a `message` carrying the
    // "try again in N seconds" that a bare `error` ("Too many requests") throws
    // away. `apiError` never emits a `message` key at all, so nothing else is
    // shadowed by reading it first.
    throw new Error(
      payload?.message || payload?.error || AUDIENCE_COUNT_FAILED_MESSAGE,
    );
  }
  if (typeof payload?.count !== "number") {
    throw new Error(AUDIENCE_COUNT_FAILED_MESSAGE);
  }

  return {
    count: payload.count,
    suppressed: typeof payload.suppressed === "number" ? payload.suppressed : 0,
  };
}

/**
 * The count as a sentence.
 *
 * Zero is called out rather than printed as "0 recipients": an audience that
 * reaches nobody is the one result an author must not skim past on the way to
 * pressing send.
 */
export function formatAudienceCount(result: AudienceCount): string {
  // All three suppression reasons named, not just the common one: the list
  // also holds bounces and addresses an admin blocked by hand (a spam
  // complaint, a legal request), and telling an author those people
  // "unsubscribed" is specific and untrue.
  const excluded =
    result.suppressed > 0
      ? ` · ${result.suppressed} excluded (unsubscribed, bounced or blocked)`
      : "";

  if (result.count === 0) {
    return `Nobody — this audience reaches no one right now${excluded}`;
  }
  const people = result.count === 1 ? "1 recipient" : `${result.count} recipients`;
  return `${people}${excluded}`;
}

export const UNCHOSEN_AUDIENCE_MESSAGE = "Choose who this campaign goes to.";
export const UNSAVED_AUDIENCE_MESSAGE =
  "Save this draft to see how many people it reaches.";
export const COUNTING_AUDIENCE_MESSAGE = "Counting…";

export interface AudienceSummaryInput {
  readonly hasSelection: boolean;
  /** False on the new-campaign screen — no row yet, so nothing to count. */
  readonly hasCampaign: boolean;
  readonly isCounting: boolean;
  readonly error: string | null;
  readonly result: AudienceCount | null;
}

export interface AudienceSummaryLine {
  readonly text: string;
  readonly tone: "muted" | "error" | "count";
}

/**
 * The one line under the picker, in precedence order.
 *
 * A pending count reads as "Counting…" whether or not the request has started,
 * and even while a previous answer is still in state: the render between an
 * author ticking a new option and the effect firing would otherwise show the
 * PREVIOUS audience's figure beside the newly-ticked radio — the one reading
 * worse than no reading at all.
 *
 * Pure, and separate from the component, because this precedence is the only
 * real logic on the screen and there is no React renderer in this suite to
 * assert it through.
 */
export function audienceSummaryLine(
  input: AudienceSummaryInput,
): AudienceSummaryLine {
  if (!input.hasSelection) {
    return { text: UNCHOSEN_AUDIENCE_MESSAGE, tone: "muted" };
  }
  if (!input.hasCampaign) {
    return { text: UNSAVED_AUDIENCE_MESSAGE, tone: "muted" };
  }
  if (input.isCounting) {
    return { text: COUNTING_AUDIENCE_MESSAGE, tone: "muted" };
  }
  if (input.error) {
    return { text: input.error, tone: "error" };
  }
  // Selected, saved, not counting and no answer yet: the frame between the tick
  // and the effect.
  if (!input.result) {
    return { text: COUNTING_AUDIENCE_MESSAGE, tone: "muted" };
  }
  return { text: formatAudienceCount(input.result), tone: "count" };
}
