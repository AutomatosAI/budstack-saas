-- PRD-208 — index creation. AC-1a + AC-4 + AC-4a.
--
-- HISTORY: this migration originally used `CREATE INDEX CONCURRENTLY`, intended
-- for a manual statement-by-statement psql apply followed by
-- `prisma migrate resolve --applied`. But the file shipped into
-- prisma/migrations/ and entrypoint.sh runs `prisma migrate deploy` on boot.
-- Prisma 6.x wraps every migration file in a single transaction, and
-- `CREATE INDEX CONCURRENTLY` cannot run inside a transaction (Postgres error
-- 25001 → P3018), which left a failed migration record and crash-looped prod
-- (P3009 on every subsequent boot).
--
-- FIX: dropped CONCURRENTLY so these are plain, transaction-safe index builds
-- that `migrate deploy` can apply normally. A plain CREATE INDEX takes a brief
-- exclusive lock on each table while it builds; the indexed tables are small
-- enough that this is acceptable, and it supersedes the manual CONCURRENTLY
-- runbook. IF NOT EXISTS keeps every statement idempotent, so any environment
-- where the index was already built concurrently by hand is a safe no-op.

-- AC-4: users.tenantId — every tenant-scoped user lookup ($use auto-scopes by
-- tenantId) was unindexed.
CREATE INDEX IF NOT EXISTS "users_tenantId_idx" ON "users" ("tenantId");

-- AC-4: orders (tenantId, createdAt) — admin orders list + analytics hot path.
CREATE INDEX IF NOT EXISTS "orders_tenantId_createdAt_idx" ON "orders" ("tenantId", "createdAt");

-- AC-1a: soft-delete "not-deleted" filters stay fast.
CREATE INDEX IF NOT EXISTS "tenants_deletedAt_idx" ON "tenants" ("deletedAt");
CREATE INDEX IF NOT EXISTS "templates_deletedAt_idx" ON "templates" ("deletedAt");
CREATE INDEX IF NOT EXISTS "tenant_templates_tenantId_deletedAt_idx" ON "tenant_templates" ("tenantId", "deletedAt");
CREATE INDEX IF NOT EXISTS "products_tenantId_deletedAt_idx" ON "products" ("tenantId", "deletedAt");
CREATE INDEX IF NOT EXISTS "marketplace_submissions_tenantId_deletedAt_idx" ON "marketplace_submissions" ("tenantId", "deletedAt");
