-- Open/click tracking, per tenant opt-in (Email Phase 2, US-027).
--
-- When this recipient FIRST opened the message and FIRST followed a link in it,
-- or null. Nullable with no default: every existing row predates tracking, and
-- so does every row belonging to a store that has not turned it on — NULL says
-- "not recorded", never "did not open".
--
-- Timestamps, not counters. The results page asks whether a person engaged and
-- when; counting every fetch would turn a mail client that re-requests images
-- on each scroll into a behavioural log, which is more data than the feature
-- needs and more than the privacy notice discloses.
--
-- No index. Both columns are counted inside ONE campaign
-- (`WHERE "campaignId" = ? AND "openedAt" IS NOT NULL`), which the existing
-- ("campaignId", status) index already narrows to at most
-- CAMPAIGN_MAX_RECIPIENTS rows, and the routes that WRITE them look the row up
-- by primary key. Nothing searches either column across campaigns.
--
-- Metadata-only change on a live table.
--
-- See tasks/prd-email-authoring-campaigns.md (US-027).

ALTER TABLE "campaign_recipients" ADD COLUMN "openedAt" TIMESTAMP(3);
ALTER TABLE "campaign_recipients" ADD COLUMN "clickedAt" TIMESTAMP(3);
