-- US-002 (prd-automatos-core-integration): chatbot enable flag.
-- Additive + backward compatible: apply to Postgres-BudStack BEFORE merging
-- the code PR. Backfill grandfathers every tenant that already has a key so
-- no live chatbot turns off at deploy.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "automatosChatbotEnabled" BOOLEAN NOT NULL DEFAULT false;
UPDATE "tenants" SET "automatosChatbotEnabled" = true WHERE "automatosApiKey" IS NOT NULL AND "automatosChatbotEnabled" = false;
