/**
 * LLM Visibility US-005 — the browser half of the citation monitor: fetch the
 * checks, and refuse to render anything we cannot read.
 *
 * SPLIT OUT OF THE COMPONENT so the parsing and the error mapping are unit
 * testable — this repo has no React-rendering test setup, so a fetch buried in
 * a `useEffect` is a fetch nothing ever asserts on. Same device as
 * `audit-client.ts`.
 *
 * FAILS CLOSED ON THE BODY. The response is our own JSON, but a proxy error
 * page, a stale deploy or a 500 rendered as HTML all arrive here as "not what
 * the type says", and a component that trusts the shape crashes with no
 * `error.tsx` above it. A row missing its engine, its prompt or its timestamp is
 * DROPPED rather than defaulted: a check attributed to an empty model id, or
 * dated to the epoch, is worse than one fewer row in a tally.
 *
 * Dependency-free on purpose (no zod, no next): it is imported by a client
 * component, like every other pure module the SEO Manager reaches for.
 */

import { UPGRADE_REQUIRED_CODE } from "@/lib/entitlements/plan";
import type { CitationCheckRow } from "@/lib/seo/citation-monitor";

export const SEO_CITATIONS_API_PATH = "/api/tenant-admin/seo/citations";

const UNREADABLE =
  "The citation checks came back in a form this page could not read. Try again in a moment.";
const NETWORK_ERROR =
  "Could not reach the server. Check your connection and retry.";
const FALLBACK = "Could not load your AI citation checks.";

export type CitationsFetchOutcome =
  | {
      readonly ok: true;
      /** False renders the connect card instead of an empty table. */
      readonly connected: boolean;
      readonly checks: readonly CitationCheckRow[];
    }
  | {
      readonly ok: false;
      readonly error: string;
      /** True for the plan gate's 403 — the panel offers an upgrade, not a retry. */
      readonly upgradeRequired: boolean;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** A nullable evidence string: present and non-empty, or absent. */
function optional(value: unknown): string | null {
  const text = str(value).trim();
  return text ? text : null;
}

/**
 * One row, or nothing.
 *
 * `cited` is compared to `true` rather than coerced, so a body carrying the
 * string "false" — the classic JSON-through-a-proxy mangling — reads as NOT
 * cited. Over-reporting a citation is the one error this feature must not make.
 */
export function parseCitationCheck(value: unknown): CitationCheckRow | null {
  if (!isRecord(value)) return null;

  const id = str(value.id);
  const engine = str(value.engine).trim();
  const prompt = str(value.prompt).trim();
  const checkedAt = str(value.checkedAt).trim();
  if (!id || !engine || !prompt || !checkedAt) return null;

  const cited = value.cited === true;
  return {
    id,
    engine,
    prompt,
    checkedAt,
    cited,
    // Evidence only exists for a citation. A row claiming a URL while saying it
    // was not cited is self-contradictory; the flag wins and the URL is dropped.
    citedUrl: cited ? optional(value.citedUrl) : null,
    mentionText: cited ? optional(value.mentionText) : null,
  };
}

export interface ParsedCitations {
  readonly connected: boolean;
  readonly checks: readonly CitationCheckRow[];
}

/** The payload, or null when the body is not one. */
export function parseCitationsBody(body: unknown): ParsedCitations | null {
  if (!isRecord(body) || !Array.isArray(body.checks)) return null;

  return {
    // Absent means "we could not tell" — and the honest degrade is to treat the
    // store as connected, so it sees an empty table rather than being told to
    // connect an account it may already have (`isAiAssistConnected`'s rule).
    connected: body.connected !== false,
    checks: body.checks.flatMap((entry) => {
      const row = parseCitationCheck(entry);
      return row ? [row] : [];
    }),
  };
}

/**
 * The server's own sentence, and whether the refusal was about the PLAN.
 *
 * The body is read once, because it can only be read once. `upgrade_required`
 * is what `requireFeature` returns and a permission 403 does not carry it — the
 * difference between "buy the plan" and "ask your admin".
 */
async function refusal(
  response: Response,
): Promise<{ error: string; upgradeRequired: boolean }> {
  try {
    const body: unknown = await response.json();
    const record = isRecord(body) ? body : {};
    return {
      error: str(record.error) || FALLBACK,
      upgradeRequired: record.code === UPGRADE_REQUIRED_CODE,
    };
  } catch {
    return { error: FALLBACK, upgradeRequired: false };
  }
}

/** Load this store's checks. Read-only: nothing here spends an AI credit. */
export async function fetchCitationChecks(): Promise<CitationsFetchOutcome> {
  let response: Response;
  try {
    response = await fetch(SEO_CITATIONS_API_PATH, {
      headers: { accept: "application/json" },
    });
  } catch {
    return { ok: false, error: NETWORK_ERROR, upgradeRequired: false };
  }

  if (!response.ok) {
    const { error, upgradeRequired } = await refusal(response);
    return { ok: false, error, upgradeRequired };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, error: UNREADABLE, upgradeRequired: false };
  }

  const parsed = parseCitationsBody(body);
  return parsed
    ? { ok: true, connected: parsed.connected, checks: parsed.checks }
    : { ok: false, error: UNREADABLE, upgradeRequired: false };
}
