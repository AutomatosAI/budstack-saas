/**
 * US-017 — what the campaign API reads, what it returns, and what it accepts.
 *
 * The two Prisma selects live here rather than in the route files because the
 * list route, the detail route and the update route all answer with the same
 * two shapes, and a column added to one copy and not the others is a field the
 * compose screen silently loses. `contentHtml` is in NEITHER select on purpose:
 * it is a build artefact of the document (US-011) that no client needs, and
 * shipping a rendered marketing email down every list response is bytes nobody
 * reads.
 *
 * Pure and browser-safe — types and literals only — so the list component can
 * import `CampaignListRow` and get the shape the API actually returns.
 */

import type { CampaignRecipientStatus, CampaignStatus } from "@prisma/client";

export const CAMPAIGN_NAME_MAX = 200;

/**
 * RESTATED from `EMAIL_SUBJECT_MAX_LENGTH`, not imported, and pinned by a test.
 *
 * That constant lives in `lib/security/email-sanitize.ts`, which pulls in
 * `sanitize-html` — no business in a browser bundle. The compose screen needs
 * the number to put a `maxLength` on its input, so the author is stopped at the
 * cap instead of discovering it as a bare "Invalid request" after writing a
 * campaign. `campaign-rules.test.ts` fails if the two ever diverge.
 */
export const CAMPAIGN_SUBJECT_MAX = 500;

/**
 * The same 512KB lift the template save routes take: a max-size document
 * exceeds `parseJsonBody`'s 256KB default once JSON-escaped.
 */
export const CAMPAIGN_BODY_MAX_BYTES = 512 * 1024;

export const EMPTY_SUBJECT_MESSAGE =
  "Give this campaign a subject line — it is the first thing a recipient sees.";

/** Columns the campaigns list renders. */
export const CAMPAIGN_SUMMARY_SELECT = {
  id: true,
  name: true,
  subject: true,
  status: true,
  scheduledAt: true,
  sentAt: true,
  updatedAt: true,
} as const;

/** Summary columns plus the document the composer re-opens. */
export const CAMPAIGN_DETAIL_SELECT = {
  ...CAMPAIGN_SUMMARY_SELECT,
  contentJson: true,
  audience: true,
} as const;

/** The campaign columns the list needs. Content is deliberately not among them. */
export interface CampaignSummaryRow {
  readonly id: string;
  readonly name: string;
  readonly subject: string;
  readonly status: CampaignStatus;
  readonly scheduledAt: Date | string | null;
  readonly sentAt: Date | string | null;
  readonly updatedAt: Date | string;
}

/** One `groupBy(['campaignId', 'status'])` bucket from `campaign_recipients`. */
export interface CampaignRecipientCountRow {
  readonly campaignId: string;
  readonly status: CampaignRecipientStatus;
  readonly _count: { readonly _all: number };
}

export interface CampaignListRow extends CampaignSummaryRow {
  /** Addresses this campaign was fanned out to. 0 before it is sent. */
  readonly recipientCount: number;
  /** Of those, how many the worker actually delivered. */
  readonly sentCount: number;
  /** Attempted and rejected — SMTP refusal, a cancel, an expired job (US-019). */
  readonly failedCount: number;
  /** Never attempted: the address was on the suppression list at send time. */
  readonly suppressedCount: number;
}

export interface CampaignCounts {
  readonly recipientCount: number;
  readonly sentCount: number;
  readonly failedCount: number;
  readonly suppressedCount: number;
}

export const NO_RECIPIENTS: CampaignCounts = {
  recipientCount: 0,
  sentCount: 0,
  failedCount: 0,
  suppressedCount: 0,
};

/**
 * Fold the count buckets into one entry per campaign.
 *
 * The numbers come from `campaign_recipients`, not from `campaigns.stats`.
 * `stats` is a denormalised cache US-019 writes at the end of a fan-out (see
 * the model comment); the recipient rows ARE the delivery record, so counting
 * them is the reading that stays true mid-send and after a retry.
 *
 * A campaign with no recipient rows produces no buckets at all, so the caller
 * gets {@link NO_RECIPIENTS} rather than a missing key — a draft reads as zero
 * sent, never as unknown. That zero is honest: `audience` stores a RULE, never
 * a resolved address list, so a draft genuinely does not know its size yet.
 */
export function foldCampaignRecipientCounts(
  rows: readonly CampaignRecipientCountRow[],
): Map<string, CampaignCounts> {
  const totals = new Map<string, CampaignCounts>();
  for (const row of rows) {
    const current = totals.get(row.campaignId) ?? NO_RECIPIENTS;
    const count = row._count._all;
    totals.set(row.campaignId, {
      recipientCount: current.recipientCount + count,
      sentCount: current.sentCount + (row.status === "SENT" ? count : 0),
      failedCount: current.failedCount + (row.status === "FAILED" ? count : 0),
      // Counted apart from failures on purpose: a suppressed address is the
      // system honouring an opt-out, which is a success of the compliance rules
      // rather than a delivery problem anybody should go and investigate.
      suppressedCount:
        current.suppressedCount + (row.status === "SUPPRESSED" ? count : 0),
    });
  }
  return totals;
}

/** Join campaigns to their recipient counts, preserving the query's order. */
export function summariseCampaigns(
  campaigns: readonly CampaignSummaryRow[],
  counts: readonly CampaignRecipientCountRow[],
): CampaignListRow[] {
  const totals = foldCampaignRecipientCounts(counts);
  return campaigns.map((campaign) => ({
    ...campaign,
    ...(totals.get(campaign.id) ?? NO_RECIPIENTS),
  }));
}
