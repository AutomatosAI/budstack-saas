-- PRD-208 — Soft-delete columns (additive, online-safe).
--
-- Adds a nullable `deletedAt` to the soft-deletable models (AC-1). Adding a
-- NULLABLE column with no default is a metadata-only change in Postgres: it does
-- NOT rewrite the table and takes only a brief ACCESS EXCLUSIVE lock to update
-- the catalog, so it is safe on a populated Railway table. Existing rows are
-- implicitly "not deleted" (NULL). No backfill required (NFR §6).
--
-- The supporting indexes for these columns are created SEPARATELY and
-- CONCURRENTLY in `20260531181200_prd208_concurrent_indexes` (AC-1a / AC-4a) so
-- that no long lock is taken on the live tables.
--
-- Leaf/log tables (`email_logs`, `drgreen_webhook_logs`, `webhook_deliveries`,
-- `audit_logs`, `order_items`, `kyc_journey_logs`, …) are intentionally EXCLUDED
-- — they hard-delete (PRD-208 §13).

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenant_templates" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "products" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "templates" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "marketplace_submissions" ADD COLUMN "deletedAt" TIMESTAMP(3);
