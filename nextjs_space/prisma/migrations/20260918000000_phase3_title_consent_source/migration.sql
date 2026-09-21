-- Dr Green Phase 3 alignment (BS-302 / BS-303) — salutation and consent
-- attribution on users. See tasks/prd-drgreen-phase-alignment-2026-09.md.
--
-- entrypoint.sh runs `prisma migrate deploy` on boot, which only APPLIES
-- migration files. Hand-written and IDEMPOTENT (IF NOT EXISTS) so it is safe
-- to (re)apply on any environment — PRD-213/220/301 pattern. Additive,
-- nullable, no index, no table rewrite.
--
-- `marketingConsentAt` (Email Phase 2, US-023) REMAINS the consent test
-- everywhere. A separate boolean was deliberately not added: the campaign
-- audience, saved segments, the newsletter unsubscribe and the tenant-admin
-- toggle all read the timestamp, and a second column for the same fact is how
-- a withdrawn customer ends up mailed. `marketingConsentSource` records which
-- registration path or settings action last changed it (attribution only).
-- `title` is the salutation the customer chose from the fixed list; it is
-- never derived from an identity document.
--
-- Canonical form verified against:
--   prisma migrate diff --from-schema-datamodel <pre-story schema> \
--     --to-schema-datamodel prisma/schema.prisma --script
-- => ALTER TABLE "users" ADD COLUMN "title" TEXT, ADD COLUMN "marketingConsentSource" TEXT;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "marketingConsentSource" TEXT;
