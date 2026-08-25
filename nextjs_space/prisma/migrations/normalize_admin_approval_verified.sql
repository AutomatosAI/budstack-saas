-- Normalise the legacy adminApproval literal "APPROVED" (written by the
-- kyc-check mirror and the tenant-admin verifyKyc API before 2026-08) to
-- Dr Green's canonical enum value "VERIFIED".
--
-- OPTIONAL / safe-to-defer: all readers canonicalise APPROVED -> VERIFIED in
-- code (lib/drgreen/approval-status.ts), and the "Refresh from Dr Green"
-- sweep rewrites rows to canonical values as it syncs. Running this simply
-- makes the stored data match the vocabulary immediately.
--
-- Apply manually (this repo's migrations are hand-run):
--   psql "$DATABASE_URL" -f prisma/migrations/normalize_admin_approval_verified.sql

UPDATE consultation_questionnaires
SET "adminApproval" = 'VERIFIED',
    "updatedAt" = NOW()
WHERE "adminApproval" = 'APPROVED';
