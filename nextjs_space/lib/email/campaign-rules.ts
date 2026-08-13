/**
 * US-017 — the two rules a campaign obeys, stated once for both sides of the
 * wire.
 *
 * PURE AND BROWSER-SAFE, deliberately. The compose screen needs the category to
 * ask the preview endpoint for the right chrome, and the list needs to know
 * which rows are still editable — but `campaign-content.ts`, where the save
 * enforces both, reaches react-email and juice through the US-011 pipeline and
 * has no business in a client bundle. Everything here is a literal or a
 * type-only import, so importing it from a `"use client"` component costs
 * nothing at runtime.
 */

import type { CampaignStatus } from "@prisma/client";

import type { EmailCategory } from "@/lib/email/suppression";

/**
 * A campaign is marketing mail, always — that is what a campaign IS.
 *
 * It is not a per-campaign setting because the two things the category decides
 * are not optional for this surface: the shell carries an unsubscribe line
 * (US-010) and the send path checks the tenant's suppression list before every
 * address (US-004). A campaign that opted out of either would be a compliance
 * bug wearing a checkbox.
 */
export const CAMPAIGN_EMAIL_CATEGORY: EmailCategory = "marketing";

/**
 * The states in which a campaign's content, name and audience are still the
 * author's to change.
 *
 * Everything after them is a record of something that has already left, or is
 * leaving: SENDING is mid fan-out (US-019), where an edit would mean half the
 * list received one email and half received another; SENT and CANCELLED are
 * history, and rewriting history would leave the results page (US-026)
 * describing a message nobody was sent.
 */
export const CAMPAIGN_EDITABLE_STATUSES = [
  "DRAFT",
  "SCHEDULED",
] as const satisfies readonly CampaignStatus[];

/** True while create/update/delete may still touch this campaign. */
export function isCampaignEditable(status: CampaignStatus): boolean {
  return (CAMPAIGN_EDITABLE_STATUSES as readonly CampaignStatus[]).includes(
    status,
  );
}

/**
 * The states a campaign can be called off from (US-019).
 *
 * SENDING is the interesting one: the fan-out is already in the queue, and
 * cancelling is how an author stops the rest of it — each job re-checks the
 * campaign's status before it sends, so the messages that have not gone yet
 * never go. DRAFT is absent because there is nothing to stop; SENT and
 * CANCELLED because there is nothing left to stop.
 */
export const CAMPAIGN_CANCELLABLE_STATUSES = [
  "SCHEDULED",
  "SENDING",
] as const satisfies readonly CampaignStatus[];

/** True while a cancel would still change anything. */
export function isCampaignCancellable(status: CampaignStatus): boolean {
  return (CAMPAIGN_CANCELLABLE_STATUSES as readonly CampaignStatus[]).includes(
    status,
  );
}

/** True while the fan-out is still producing outcomes worth polling for. */
export function isCampaignInFlight(status: CampaignStatus): boolean {
  return status === "SENDING";
}

/** 409 body for an edit aimed at a campaign that has left the author's hands. */
export const CAMPAIGN_LOCKED_MESSAGE =
  "This campaign has already been sent or is sending, so it can no longer be changed. Duplicate it to send a revised version.";
