-- PRD-302 (Super-Admin Impersonation) — impersonation_sessions table.
--
-- entrypoint.sh runs `prisma migrate deploy` on boot, which only APPLIES migration
-- files (it never diffs schema.prisma against the DB). This migration is therefore
-- hand-written and fully IDEMPOTENT (IF NOT EXISTS everywhere) so it is safe to
-- (re)apply on any environment — matching the PRD-213 / PRD-301 migration pattern.
-- No CREATE INDEX CONCURRENTLY (runs inside migrate deploy's transaction — P3018).
--
-- audit_logs.impersonationSessionId + its index already exist (pre-wired by the
-- PRD-301 migration 20260709212633_team_management_phase1).

-- ── CreateTable: impersonation_sessions ──
CREATE TABLE IF NOT EXISTS "impersonation_sessions" (
    "id" TEXT NOT NULL,
    "superAdminClerkId" TEXT NOT NULL,
    "superAdminEmail" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tenantEmail" TEXT,
    "tokenHash" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "endedReason" TEXT,
    "superAdminIpAddress" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

-- Raw bearer tokens are never stored; lookup is by SHA-256 hash.
CREATE UNIQUE INDEX IF NOT EXISTS "impersonation_sessions_tokenHash_key"
    ON "impersonation_sessions"("tokenHash");

-- Active-session lookup (resolver + "end my session") and per-tenant history.
CREATE INDEX IF NOT EXISTS "impersonation_sessions_superAdminClerkId_endedAt_idx"
    ON "impersonation_sessions"("superAdminClerkId", "endedAt");
CREATE INDEX IF NOT EXISTS "impersonation_sessions_tenantId_startedAt_idx"
    ON "impersonation_sessions"("tenantId", "startedAt");

-- AC-7: at most ONE active session per super-admin (a browser holds one cookie).
-- Partial unique index — Prisma schema cannot express this, so it lives here only.
-- History rows (endedAt set) are exempt, unlike the PRD's blanket UNIQUE(superAdmin,
-- tenant), which would have blocked a second-ever session against the same tenant.
CREATE UNIQUE INDEX IF NOT EXISTS "impersonation_sessions_one_active_per_admin_key"
    ON "impersonation_sessions"("superAdminClerkId")
    WHERE "endedAt" IS NULL;

-- ── FK: sessions die with their tenant (GDPR cascading delete) ──
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'impersonation_sessions_tenantId_fkey'
    ) THEN
        ALTER TABLE "impersonation_sessions"
            ADD CONSTRAINT "impersonation_sessions_tenantId_fkey"
            FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
