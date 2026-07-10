-- PRD-220 Part B — persist the inline ID-document upload OUTCOME (status flag
-- only; deliberately NO document data — no image, number, or preview URL —
-- matching the pass-through privacy contract in verify/id-document).
--
-- entrypoint.sh runs `prisma migrate deploy` on boot, which only APPLIES
-- migration files. Hand-written and IDEMPOTENT (IF NOT EXISTS) so it is safe
-- to (re)apply on any environment — PRD-213/301/302 migration pattern.
-- No CREATE INDEX CONCURRENTLY (P3018 inside migrate deploy's transaction).

ALTER TABLE "consultation_questionnaires"
  ADD COLUMN IF NOT EXISTS "idDocumentStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "idDocumentError" TEXT,
  ADD COLUMN IF NOT EXISTS "idDocumentUpdatedAt" TIMESTAMP(3);
