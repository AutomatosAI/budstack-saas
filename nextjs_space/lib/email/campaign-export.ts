/**
 * US-026 — the recipient CSV's contract, stated away from the route that
 * streams it so every column can be asserted without a database.
 *
 * This file is the export's whole vocabulary: which columns it has, what one
 * recipient becomes, how the file is named, and how often one admin may ask for
 * it. The route contributes the two queries and the permission gate.
 */

import type { CampaignRecipientStatus } from "@prisma/client";

import {
  CAMPAIGN_FAILURE_LABELS,
  classifyCampaignFailure,
} from "@/lib/email/campaign-results";
import { CAMPAIGN_MAX_RECIPIENTS } from "@/lib/email/campaign-send";

/**
 * Recipients read per round trip.
 *
 * Small enough that the process holds one page rather than a mailing list,
 * large enough that a full 5,000-address campaign is ten round trips and not a
 * thousand. Each page costs a second query for its linked log rows, so the size
 * is also the `IN (...)` width.
 */
export const CAMPAIGN_EXPORT_PAGE_SIZE = 500;

/**
 * Runaway guard, an order of magnitude above what one campaign can hold
 * (`CAMPAIGN_MAX_RECIPIENTS`). Reaching it means the cursor stopped advancing,
 * not that a store has a list this big — no real export is truncated by it.
 */
export const CAMPAIGN_EXPORT_MAX_ROWS = CAMPAIGN_MAX_RECIPIENTS * 10;

/**
 * 5 exports a minute per admin. This is a bulk read of customer addresses, so
 * it is metered like the send is — but it FAILS OPEN, unlike the send: a Redis
 * outage that stopped a compliance export would deny a legitimate operator
 * their own data to protect against a read they are already permitted to make.
 */
export const CAMPAIGN_EXPORT_RATE_LIMIT = {
  maxRequests: 5,
  windowMs: 60_000,
} as const;

/** Namespaced so an export never shares a counter with another endpoint. */
export function campaignExportRateLimitKey(scope: string): string {
  return `campaign-export:${scope}`;
}

/**
 * snake_case headers, because this file is opened in a spreadsheet and then
 * pasted into other tools — not read by this app.
 */
export const CAMPAIGN_RECIPIENT_CSV_HEADER = [
  "email",
  "status",
  "added_at",
  "delivered_at",
  "unsubscribed_at",
  "failure_reason",
  "failure_detail",
] as const;

/** One recipient plus the `email_logs` row it is linked to, when there is one. */
export interface CampaignRecipientExportRow {
  readonly email: string;
  readonly status: CampaignRecipientStatus;
  readonly createdAt: Date | null;
  readonly unsubscribedAt: Date | null;
  /** The worker's copy of the failure, used when the log row is gone. */
  readonly error: string | null;
  /** US-008 linkage — the outcome as the log recorded it. */
  readonly deliveredAt: Date | null;
  readonly logError: string | null;
  readonly logResponse: string | null;
}

/** Statuses that owe the export a reason. Everything else leaves it blank. */
const UNDELIVERED_STATUSES: readonly CampaignRecipientStatus[] = [
  "FAILED",
  "SUPPRESSED",
];

function isoOrEmpty(value: Date | null): string {
  return value ? value.toISOString() : "";
}

/**
 * One CSV row, in `CAMPAIGN_RECIPIENT_CSV_HEADER` order.
 *
 * The reason is BOTH classified and quoted raw: the label is what a
 * non-technical author can act on, and the detail is the SMTP server's own
 * sentence, which is the only thing that identifies a particular bounce. Rows
 * that were delivered carry neither rather than an empty-looking classification
 * — "" reads as "nothing went wrong", which for a SENT row is true.
 *
 * `logError` outranks `error`: they are written from the same message, but the
 * log row is the record US-008 made this export's join point.
 */
export function campaignRecipientCsvRow(
  row: CampaignRecipientExportRow,
): readonly unknown[] {
  const failed = UNDELIVERED_STATUSES.includes(row.status);
  const detail = row.logError || row.error || "";
  const code = failed
    ? classifyCampaignFailure({
        errorMessage: detail || null,
        smtpResponse: row.logResponse ?? null,
      })
    : null;

  return [
    row.email,
    row.status,
    isoOrEmpty(row.createdAt),
    isoOrEmpty(row.deliveredAt),
    isoOrEmpty(row.unsubscribedAt),
    code ? CAMPAIGN_FAILURE_LABELS[code] : "",
    failed ? detail : "",
  ];
}

/**
 * `campaign-<id>-recipients-<date>.csv`.
 *
 * Built only from a UUID and an ISO date, so nothing tenant-authored — a
 * campaign NAME here would put arbitrary text into a `Content-Disposition`
 * header, which is a header-injection surface for the sake of a nicer filename.
 */
export function campaignRecipientCsvFilename(
  campaignId: string,
  now: Date,
): string {
  return `campaign-${campaignId}-recipients-${now.toISOString().slice(0, 10)}.csv`;
}
