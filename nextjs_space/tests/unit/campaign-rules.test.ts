import { describe, expect, it } from "vitest";

// Email Phase 2 US-017 — the pure halves of the campaign surface: the edit
// guard the routes enforce, the unsubscribe check the save runs, and the fold
// the list is built from. Kept apart from the route test because none of them
// need a request, a session or a database to be wrong.

import { ApiError } from "@/lib/api-error";
import {
  assertCampaignUnsubscribe,
  MISSING_UNSUBSCRIBE_MESSAGE,
} from "@/lib/email/campaign-content";
import {
  CAMPAIGN_SUBJECT_MAX,
  foldCampaignRecipientCounts,
  summariseCampaigns,
  type CampaignRecipientCountRow,
  type CampaignSummaryRow,
} from "@/lib/email/campaign-fields";
import {
  CAMPAIGN_EMAIL_CATEGORY,
  isCampaignEditable,
} from "@/lib/email/campaign-rules";
import { UNSUBSCRIBE_URL_SLOT } from "@/lib/email/email-shell";
import { shouldCheckSuppression } from "@/lib/email/suppression";
import { EMAIL_SUBJECT_MAX_LENGTH } from "@/lib/security/email-sanitize";

describe("campaign rules", () => {
  it("classifies campaigns as marketing, which is what arms the suppression check", () => {
    expect(CAMPAIGN_EMAIL_CATEGORY).toBe("marketing");
    // Not a restatement: this is the predicate US-004's send path uses to
    // decide whether the tenant's opt-out list is consulted at all.
    expect(shouldCheckSuppression(CAMPAIGN_EMAIL_CATEGORY)).toBe(true);
  });

  it("keeps the client-safe subject cap in step with the sanitizer's", () => {
    // CAMPAIGN_SUBJECT_MAX is a restatement, because the authority lives in a
    // module that pulls in sanitize-html and cannot ship to a browser. This is
    // what stops the two from drifting: raise one and this fails.
    expect(CAMPAIGN_SUBJECT_MAX).toBe(EMAIL_SUBJECT_MAX_LENGTH);
  });

  it("allows edits only while a campaign has not left", () => {
    expect(isCampaignEditable("DRAFT")).toBe(true);
    expect(isCampaignEditable("SCHEDULED")).toBe(true);
    // Mid fan-out: an edit would mean half the list got a different email.
    expect(isCampaignEditable("SENDING")).toBe(false);
    expect(isCampaignEditable("SENT")).toBe(false);
    expect(isCampaignEditable("CANCELLED")).toBe(false);
  });
});

describe("assertCampaignUnsubscribe", () => {
  it("accepts rendered HTML carrying the slot the worker fills per recipient", () => {
    expect(() =>
      assertCampaignUnsubscribe(
        `<p>Hi</p><a href="${UNSUBSCRIBE_URL_SLOT}">Unsubscribe</a>`,
      ),
    ).not.toThrow();
  });

  it("rejects rendered HTML with no unsubscribe link at all", () => {
    // The failure this exists for: a shell that stopped emitting the footer, a
    // mis-passed category, or a document POSTed straight at the endpoint.
    let thrown: unknown;
    try {
      assertCampaignUnsubscribe("<p>Buy things</p>");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as ApiError).status).toBe(400);
    expect((thrown as ApiError).message).toBe(MISSING_UNSUBSCRIBE_MESSAGE);
  });

  it("is not satisfied by a resolved-looking link that is not the slot", () => {
    expect(() =>
      assertCampaignUnsubscribe('<a href="/unsubscribe">Unsubscribe</a>'),
    ).toThrow(ApiError);
  });

  it("is not satisfied by an author typing the slot as body text", () => {
    // The failure mode a bare `includes(slot)` would let through: the words
    // are in the email, but there is nothing to click, so the tripwire would
    // pass for the one document it exists to catch.
    expect(() =>
      assertCampaignUnsubscribe(
        `<p>To stop these, visit ${UNSUBSCRIBE_URL_SLOT}</p>`,
      ),
    ).toThrow(ApiError);
  });
});

describe("campaign recipient counts", () => {
  const bucket = (
    campaignId: string,
    status: CampaignRecipientCountRow["status"],
    count: number,
  ): CampaignRecipientCountRow => ({
    campaignId,
    status,
    _count: { _all: count },
  });

  it("totals every status, and keeps the three outcomes apart", () => {
    const totals = foldCampaignRecipientCounts([
      bucket("a", "SENT", 40),
      bucket("a", "FAILED", 3),
      bucket("a", "SUPPRESSED", 2),
      bucket("a", "PENDING", 5),
    ]);

    // US-019: suppressed is counted apart from failed — honouring an opt-out
    // is the compliance rules working, not a delivery problem to investigate.
    expect(totals.get("a")).toEqual({
      recipientCount: 50,
      sentCount: 40,
      failedCount: 3,
      suppressedCount: 2,
    });
  });

  it("keeps campaigns apart", () => {
    const totals = foldCampaignRecipientCounts([
      bucket("a", "SENT", 1),
      bucket("b", "QUEUED", 7),
    ]);

    expect(totals.get("a")).toEqual({
      recipientCount: 1,
      sentCount: 1,
      failedCount: 0,
      suppressedCount: 0,
    });
    expect(totals.get("b")).toEqual({
      recipientCount: 7,
      sentCount: 0,
      failedCount: 0,
      suppressedCount: 0,
    });
  });

  it("reads a draft with no recipient rows as zero, not unknown", () => {
    const draft: CampaignSummaryRow = {
      id: "draft-1",
      name: "October newsletter",
      subject: "What's new",
      status: "DRAFT",
      scheduledAt: null,
      sentAt: null,
      updatedAt: "2026-08-13T00:00:00.000Z",
    };

    expect(summariseCampaigns([draft], [])).toEqual([
      {
        ...draft,
        recipientCount: 0,
        sentCount: 0,
        failedCount: 0,
        suppressedCount: 0,
      },
    ]);
  });

  it("preserves the query's order when joining counts", () => {
    const row = (id: string): CampaignSummaryRow => ({
      id,
      name: id,
      subject: id,
      status: "SENT",
      scheduledAt: null,
      sentAt: null,
      updatedAt: "2026-08-13T00:00:00.000Z",
    });

    const summarised = summariseCampaigns(
      [row("newest"), row("older")],
      [bucket("older", "SENT", 2)],
    );

    expect(summarised.map((campaign) => campaign.id)).toEqual([
      "newest",
      "older",
    ]);
    expect(summarised[0].sentCount).toBe(0);
    expect(summarised[1].sentCount).toBe(2);
  });
});
