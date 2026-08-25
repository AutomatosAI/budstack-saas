-- Platform-scope inbound webhook config (Dr Green → BudStacks), surfaced in
-- super-admin → Platform Webhooks.
--
-- SAFE TO RUN LATE: every reader falls back to the DRGREEN_WEBHOOK_SECRET env
-- var when this table is missing or empty, so the app keeps verifying inbound
-- signatures exactly as it does today until a secret is saved in the UI. The
-- admin page shows "table not provisioned" instead of erroring.
--
-- Apply manually (this repo's migrations are hand-run):
--   psql "$DATABASE_URL" -f prisma/migrations/add_platform_webhook_config.sql

CREATE TABLE IF NOT EXISTS platform_webhook_config (
  id          TEXT PRIMARY KEY,
  secret      TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "updatedBy" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
