-- US-010/US-012 (prd-automatos-core-integration): assisted-Wire columns.
-- Additive + backward compatible: apply to Postgres-BudStack BEFORE merging
-- the code PR (old build ignores all three).
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "wireMode" TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "automatosWireSecret" TEXT;
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'MANUAL';
