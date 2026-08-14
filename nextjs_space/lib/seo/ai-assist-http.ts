/**
 * SEO Supercharge US-025 / LLM Visibility US-002 — the HTTP shape of an AI
 * drafting outcome that is NOT a draft.
 *
 * WHY IT IS ITS OWN MODULE. Two routes now answer the same five outcomes — the
 * field assistant (`/seo/ai-assist`) and the product Q&A assistant
 * (`/seo/ai-assist/qa`) — and a Next route file may only export handlers, so the
 * mapping cannot simply be imported from the first route by the second. Two
 * copies would drift, and the thing that would drift is a status code a client
 * branches on.
 *
 * Each route keeps its own OK response, because that is the half that genuinely
 * differs: one returns a string, the other a list of pairs.
 */

import { NextResponse } from "next/server";

import type { AiAssistResult, QaDraftResult } from "@/lib/seo/ai-assist";

/** Every outcome of a drafting call except the draft itself. */
export type AiAssistFailure =
  | Exclude<AiAssistResult, { status: "ok" }>
  | Exclude<QaDraftResult, { status: "ok" }>;

/**
 * The response for one non-draft outcome.
 *
 * `unavailable` is a 200: "you have not connected an account" is a STATE of the
 * feature, not a failure of the request, and the editor renders a connect card
 * for it rather than an error. Everything the client needs to choose its wording
 * travels as machine-readable fields — `status`, `reason` — with `error`
 * carrying a sentence for the cases where there is nothing better to say.
 */
export function aiAssistFailureResponse(
  result: AiAssistFailure,
): NextResponse {
  switch (result.status) {
    case "unavailable":
      return NextResponse.json(result);

    case "rate_limited": {
      const response = NextResponse.json(
        { ...result, error: "Too many drafts in a short time. Try again shortly." },
        { status: 429 },
      );
      if (result.retryAfterSeconds !== undefined) {
        response.headers.set("retry-after", String(result.retryAfterSeconds));
      }
      return response;
    }

    // 422: the request was valid and the model answered — the ANSWER was not
    // something we are willing to publish. Never a trimmed draft.
    case "refused":
      return NextResponse.json(
        { ...result, error: "The assistant's answer could not be used." },
        { status: 422 },
      );

    default:
      // 503 where our own side is temporarily unable; 502 where the tenant's AI
      // provider is. The client tells them apart by `reason`, not by status.
      return NextResponse.json(
        {
          ...result,
          error: "The assistant could not be reached. Try again in a moment.",
        },
        {
          status:
            result.reason === "lookup_failed" ||
            result.reason === "rate_limiter_unavailable"
              ? 503
              : 502,
        },
      );
  }
}
