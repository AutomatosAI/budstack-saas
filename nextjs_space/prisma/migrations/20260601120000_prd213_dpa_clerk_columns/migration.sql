-- PRD-213 (GDPR lifecycle) columns that shipped in PR #119 WITHOUT a migration.
-- entrypoint.sh runs `prisma migrate deploy` on boot, which only applies migration
-- files — it never diffs schema.prisma against the DB — so without this file the
-- columns are never created and every PRD-213 code path throws "column does not exist".
-- Idempotent (IF NOT EXISTS) so it is safe to (re)apply on any environment.

-- tenants: GDPR Art.28 DPA click-through acceptance
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "dpaAcceptedVersion" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "dpaAcceptedAt" TIMESTAMP(3);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "dpaAcceptedByUserId" TEXT;

-- users: reliable Clerk -> local mapping for user.deleted erasure
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "clerkUserId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_clerkUserId_key" ON "users"("clerkUserId");
