-- Campaign results (Email Phase 2, US-026).
--
-- When a recipient redeemed the per-recipient unsubscribe token that was minted
-- into THIS campaign's footer. Nullable with no default: every existing
-- recipient row predates the stamp, and NULL says exactly that — "not recorded
-- as having unsubscribed from this campaign", never "did not unsubscribe".
-- Metadata-only change on a live table.
--
-- No index. The results page counts it inside one campaign
-- (`WHERE "campaignId" = ? AND "unsubscribedAt" IS NOT NULL`), which the
-- existing ("campaignId", status) index already narrows to at most
-- CAMPAIGN_MAX_RECIPIENTS rows; nothing searches this column across campaigns.
--
-- See tasks/prd-email-authoring-campaigns.md (US-026).

ALTER TABLE "campaign_recipients" ADD COLUMN "unsubscribedAt" TIMESTAMP(3);
