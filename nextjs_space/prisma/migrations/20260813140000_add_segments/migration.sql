-- Saved audience filters (Email Phase 2, US-025).
--
-- One row per reusable rule: "customers who have not ordered in 60 days" is
-- written once and pointed at by any number of campaigns. The row stores a
-- RULE and never a resolved address list — the same contract campaigns.audience
-- keeps (20260813000000_add_campaigns) — so a segment resolved in April reaches
-- whoever matches in April.
--
-- "filter" is JSONB but is not free-form: it holds the criterion union declared
-- in lib/email/segment-filter.ts, re-parsed on every read. Anything this
-- version cannot understand resolves to NOBODY, so a rule written by a later
-- version can never widen a send.
--
-- "segments_tenantId_name_key" is what stops "Reorder 60d" existing four times
-- in one store's audience picker. CASCADE on the tenant FK matches
-- customer_tags (20260813024500): a segment is targeting metadata with no life
-- of its own, and unlike campaign_recipients it is not delivery evidence.
--
-- See tasks/prd-email-authoring-campaigns.md (US-025).

CREATE TABLE "segments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filter" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "segments_pkey" PRIMARY KEY ("id")
);

-- Serves the audience picker and the segments tab, both of which read this
-- tenant's segments most-recently-touched first.
CREATE INDEX "segments_tenantId_updatedAt_idx" ON "segments"("tenantId", "updatedAt");

CREATE UNIQUE INDEX "segments_tenantId_name_key" ON "segments"("tenantId", "name");

ALTER TABLE "segments" ADD CONSTRAINT "segments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
