-- SEO route hardening (SEO Supercharge, US-010).
--
-- Two granular permission flags for the SEO Manager surface, matching the
-- view/edit split emails already carry. Every other column on this table is
-- `BOOLEAN NOT NULL DEFAULT false` (prisma/migrations/20260709212633_
-- team_management_phase1/migration.sql:23-42) and these follow it.
--
-- FAIL-CLOSED ON PURPOSE. `DEFAULT false` means every already-seeded
-- role_permissions row — one per preset role per tenant — gets both flags off,
-- so an editor/manager/support member who could reach the SEO routes before
-- (they were withTenantAuth-only, i.e. any TENANT_ADMIN) cannot after. The
-- `admin` preset is unaffected: resolvePermissions() returns ALL_TRUE for
-- teamRole 'admin' and for legacy NULL teamRoles without reading this table at
-- all (lib/permissions/resolve.ts:46-53), so no owner can be locked out of
-- their own SEO Manager by this migration. A tenant re-grants the flags to any
-- other preset in Team → Roles, which renders straight off PERMISSION_KEYS.
--
-- Metadata-only change on a live table: two NOT NULL columns with a constant
-- default, which PostgreSQL 11+ applies without rewriting the heap.
--
-- See tasks/prd-seo-supercharge.md (US-010, FR-10).

ALTER TABLE "role_permissions" ADD COLUMN IF NOT EXISTS "canViewSeo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "role_permissions" ADD COLUMN IF NOT EXISTS "canEditSeo" BOOLEAN NOT NULL DEFAULT false;
