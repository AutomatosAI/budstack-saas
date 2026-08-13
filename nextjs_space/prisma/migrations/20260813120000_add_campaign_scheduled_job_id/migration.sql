-- Campaign scheduling (Email Phase 2, US-021).
--
-- The BullMQ trigger a scheduled campaign is waiting on. Nullable with no
-- default: every existing campaign is waiting on nothing, which is exactly what
-- NULL says, so this add is a metadata-only change on a live table.
--
-- No index. It is read only by id (`WHERE id = ? AND "tenantId" = ?`), never
-- searched — the queue is what knows about pending jobs, this column is what
-- says which of them a campaign has adopted.
--
-- See tasks/prd-email-authoring-campaigns.md (US-021).

ALTER TABLE "campaigns" ADD COLUMN "scheduledJobId" TEXT;
