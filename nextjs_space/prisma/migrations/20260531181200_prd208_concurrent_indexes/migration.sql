-- PRD-208 — Online (CONCURRENTLY) index creation. AC-1a + AC-4 + AC-4a.
--
-- ┌──────────────────────────────────────────────────────────────────────────┐
-- │ ⚠️  DO NOT APPLY VIA `prisma migrate deploy`.                              │
-- │                                                                            │
-- │ Prisma 6.x wraps every migration file in a single transaction, and        │
-- │ `CREATE INDEX CONCURRENTLY` CANNOT run inside a transaction (Postgres      │
-- │ rejects it). This is PRD-208 OQ-3. The sanctioned runbook is:              │
-- │                                                                            │
-- │   1. Apply this file MANUALLY, statement-by-statement, on staging then     │
-- │      prod with psql (each CONCURRENTLY build runs in its own implicit txn):│
-- │        psql "$DATABASE_URL" -f \                                           │
-- │          prisma/migrations/20260531181200_prd208_concurrent_indexes/migration.sql
-- │      (psql sends each statement separately, so CONCURRENTLY is honoured.)  │
-- │                                                                            │
-- │   2. Record it in Prisma's history WITHOUT re-running it:                  │
-- │        npx prisma migrate resolve --applied \                             │
-- │          20260531181200_prd208_concurrent_indexes                          │
-- │                                                                            │
-- │ Gerard runs prod migrations. Staging dry-run REQUIRED first (NFR §6).      │
-- │ Verify with `EXPLAIN` that the orders/users queries use Index Scan, not    │
-- │ Seq Scan (success metric §7), and confirm no Seq-Scan-only window during   │
-- │ the build (CONCURRENTLY keeps the table writable throughout).              │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- IF NOT EXISTS makes each statement idempotent so a partially-applied run (a
-- CONCURRENTLY build that fails leaves an INVALID index) can be retried after a
-- `DROP INDEX` of the invalid one.

-- AC-4: users.tenantId — every tenant-scoped user lookup ($use auto-scopes by
-- tenantId) was unindexed.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "users_tenantId_idx" ON "users" ("tenantId");

-- AC-4: orders (tenantId, createdAt) — admin orders list + analytics hot path.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "orders_tenantId_createdAt_idx" ON "orders" ("tenantId", "createdAt");

-- AC-1a: soft-delete "not-deleted" filters stay fast.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "tenants_deletedAt_idx" ON "tenants" ("deletedAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "templates_deletedAt_idx" ON "templates" ("deletedAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "tenant_templates_tenantId_deletedAt_idx" ON "tenant_templates" ("tenantId", "deletedAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "products_tenantId_deletedAt_idx" ON "products" ("tenantId", "deletedAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "marketplace_submissions_tenantId_deletedAt_idx" ON "marketplace_submissions" ("tenantId", "deletedAt");
