/**
 * US-026 — what happened to a campaign, said in language an author can act on.
 *
 * The counts come from `campaign_recipients` (the delivery record) and the
 * reasons come from the `email_logs` rows those recipients are linked to by
 * `emailLogId` (US-008). Nothing here reads `campaigns.stats`: that column is a
 * snapshot taken the moment a fan-out finished, and a BullMQ retry can still
 * turn a FAILED row into a SENT one afterwards.
 *
 * NO I/O — folding and classification only, so every rule below is testable
 * without a database. The queries live in the results route.
 *
 * SERVER-SIDE, though, despite being pure: `MISSING_FOOTER_REASON` lives in a
 * module that imports Handlebars. The results panel therefore takes a TYPE-ONLY
 * import from here (erased at compile time, so nothing follows it into the
 * browser bundle) and renders the labels this module already resolved. The
 * alternative — restating the four reason tokens as literals — is a drift risk
 * on strings whose whole purpose is to be matched exactly.
 */

import type { CampaignStatus } from "@prisma/client";

import type { CampaignStats } from "@/lib/email/campaign-send";
import {
  CAMPAIGN_CANCELLED_REASON,
  CAMPAIGN_MISSING_LOG_MESSAGE,
} from "@/lib/email/campaign-send";
import { MISSING_FOOTER_REASON } from "@/lib/email/marketing-headers";
import { SUPPRESSED_LOG_REASON } from "@/lib/email/suppression";

/**
 * Derived, not restated. `CAMPAIGN_MISSING_LOG_MESSAGE` is the only place that
 * token exists, and taking it from the message means the two cannot drift.
 */
const CAMPAIGN_MISSING_REASON = CAMPAIGN_MISSING_LOG_MESSAGE.split(":")[0];

/**
 * The one failure the worker builds inline instead of from a constant
 * (`scripts/email-worker.ts`, the PRD-220 expiry guard): its message begins
 * `Expired unsent (PRD-220): ...`, so the match is on this prefix rather than
 * on a token before a colon. Compared lowercased.
 */
const EXPIRED_REASON_PREFIX = "expired unsent";

/** Distinct reasons a campaign message did not reach somebody. */
export const CAMPAIGN_FAILURE_CODES = [
  "suppressed",
  "cancelled",
  "campaign-missing",
  "missing-footer",
  "expired",
  "smtp",
  "unknown",
] as const;

export type CampaignFailureCode = (typeof CAMPAIGN_FAILURE_CODES)[number];

/**
 * What each reason means to the person who wrote the campaign, not to the
 * engineer who wrote the worker. "smtp" is the only one that describes somebody
 * else's decision, which is exactly why it reads differently from the rest.
 */
export const CAMPAIGN_FAILURE_LABELS: Readonly<
  Record<CampaignFailureCode, string>
> = {
  suppressed: "Not sent — this person had already opted out",
  cancelled: "Not sent — the campaign was stopped before this message went out",
  "campaign-missing": "Not sent — the campaign was deleted mid-send",
  "missing-footer":
    "Not sent — the email rendered without a working unsubscribe link",
  expired: "Not sent — the message sat in the queue too long to still be timely",
  smtp: "Rejected by the mail server",
  unknown: "Failed, with no reason recorded",
};

/** Longest example message kept per group — enough to read, not a log dump. */
const EXAMPLE_MAX_LENGTH = 200;

/**
 * Distinct failure groups shown at once. Real sends produce a handful; a cap
 * only matters if a mail server starts answering every address differently,
 * and an unbounded list would then be the page's whole content.
 */
export const CAMPAIGN_FAILURE_GROUP_MAX = 12;

/**
 * How many failed recipients the reasons are computed from.
 *
 * A campaign is capped at CAMPAIGN_MAX_RECIPIENTS (5,000) addresses, so this is
 * only reached by a send that failed almost entirely — at which point the shape
 * of the first 1,000 failures is the same as the shape of all of them. The
 * route returns the sampled count alongside the total so the page can say so
 * rather than imply it counted everything.
 */
export const CAMPAIGN_FAILURE_SAMPLE_MAX = 1000;

/** The `email_logs` columns a reason is read from. */
export interface CampaignFailureSource {
  readonly errorMessage: string | null;
  readonly smtpResponse?: string | null;
}

export interface CampaignFailureReason {
  readonly code: CampaignFailureCode;
  readonly label: string;
  readonly count: number;
  /** One real message from this group, so an operator can act on it. */
  readonly example: string | null;
}

/** The token before the first colon, lowercased — how the worker marks refusals. */
function reasonToken(message: string): string {
  const colon = message.indexOf(":");
  return (colon === -1 ? message : message.slice(0, colon)).trim().toLowerCase();
}

/**
 * Which kind of failure this log row records.
 *
 * The four refusals the worker writes carry a machine-matchable prefix
 * precisely so this can tell "we declined to send it" apart from "the mail
 * server said no" — the first is the system working and the second is something
 * an operator has to go and fix. Anything else with a message is an SMTP
 * rejection; a failure with no message at all is `unknown` rather than being
 * folded into SMTP, because inventing a cause is worse than admitting there
 * isn't one.
 */
export function classifyCampaignFailure(
  source: CampaignFailureSource,
): CampaignFailureCode {
  const message = (source.errorMessage || source.smtpResponse || "").trim();
  if (!message) return "unknown";

  if (message.toLowerCase().startsWith(EXPIRED_REASON_PREFIX)) return "expired";

  switch (reasonToken(message)) {
    case SUPPRESSED_LOG_REASON:
      return "suppressed";
    case CAMPAIGN_CANCELLED_REASON:
      return "cancelled";
    case CAMPAIGN_MISSING_REASON:
      return "campaign-missing";
    case MISSING_FOOTER_REASON:
      return "missing-footer";
    default:
      return "smtp";
  }
}

function firstExample(source: CampaignFailureSource): string | null {
  const message = (source.errorMessage || source.smtpResponse || "").trim();
  if (!message) return null;
  return message.length > EXAMPLE_MAX_LENGTH
    ? `${message.slice(0, EXAMPLE_MAX_LENGTH)}…`
    : message;
}

/**
 * Fold linked log rows into one line per reason, commonest first.
 *
 * Ties break on the code so the same input always renders in the same order —
 * a list that reshuffles between two polls of the same finished campaign reads
 * as new information when there is none.
 */
export function summariseCampaignFailures(
  sources: readonly CampaignFailureSource[],
): CampaignFailureReason[] {
  const groups = new Map<CampaignFailureCode, CampaignFailureReason>();

  for (const source of sources) {
    const code = classifyCampaignFailure(source);
    const existing = groups.get(code);
    groups.set(code, {
      code,
      label: CAMPAIGN_FAILURE_LABELS[code],
      count: (existing?.count ?? 0) + 1,
      // The first message wins: later ones say the same thing, and re-reading
      // the group's example on every row would make it the LAST failure rather
      // than a representative one.
      example: existing?.example ?? firstExample(source),
    });
  }

  return [...groups.values()]
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code))
    .slice(0, CAMPAIGN_FAILURE_GROUP_MAX);
}

/** The campaign columns the results page names. Content is not among them. */
export interface CampaignResultsHeader {
  readonly id: string;
  readonly name: string;
  readonly subject: string;
  readonly status: CampaignStatus;
  /** ISO, or null while the fan-out is still running. */
  readonly sentAt: string | null;
}

/** What `GET /api/tenant-admin/campaigns/[id]/results` answers with. */
export interface CampaignResults {
  readonly campaign: CampaignResultsHeader;
  readonly counts: CampaignStats;
  /**
   * Recipients who followed THIS campaign's opt-out link. Attributed by the
   * per-recipient token (US-019), which is the only thing that knows which
   * message an unsubscribe came from.
   */
  readonly unsubscribed: number;
  /**
   * US-027. `trackingEnabled` is the tenant's setting as it stands NOW, not as
   * it stood when the campaign went out, and the page needs it to tell "nobody
   * opened this" apart from "we did not look" — two zeros that mean opposite
   * things. `opened`/`clicked` count recipients, not events: each is stamped
   * once, the first time it happens.
   */
  readonly trackingEnabled: boolean;
  readonly opened: number;
  readonly clicked: number;
  readonly failures: readonly CampaignFailureReason[];
  /**
   * Failed recipients the reasons were read from, and how many there are in
   * total. Equal in every realistic send; when they differ the page says the
   * reasons are a sample rather than letting the numbers quietly disagree.
   */
  readonly failuresSampled: number;
  readonly failuresTotal: number;
}
