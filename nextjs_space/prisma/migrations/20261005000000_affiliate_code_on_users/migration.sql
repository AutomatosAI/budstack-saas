-- Dr Green affiliate codes (BS-A03) — the referral code a customer signed up
-- with, kept on users for the tenant admin's reference. See
-- tasks/prd-drgreen-affiliate-codes.md.
--
-- entrypoint.sh runs `prisma migrate deploy` on boot, which only APPLIES
-- migration files. Hand-written and IDEMPOTENT (IF NOT EXISTS) so it is safe
-- to (re)apply by hand on any environment before the deploy — PRD-213/220/301
-- and BS-302 pattern. Additive, nullable, no default, no index, no backfill:
-- a metadata-only ALTER on Postgres 11+ (no table rewrite, brief lock only).
--
-- `affiliateCode` is the upper-cased code forwarded to Dr Green with the
-- client (Dr Green US-A02 format, max 20). `affiliateCodeSource` is
-- 'link' (from the bs_ref landing cookie) or 'typed'. Reference only: Dr
-- Green decides what the code links to, and a code never changes a price.
--
-- Canonical form (what `prisma migrate diff --from-schema-datamodel
-- <pre-story schema> --to-schema-datamodel prisma/schema.prisma --script`
-- emits for the two `String?` fields):
-- => ALTER TABLE "users" ADD COLUMN "affiliateCode" TEXT, ADD COLUMN "affiliateCodeSource" TEXT;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "affiliateCode" TEXT,
  ADD COLUMN IF NOT EXISTS "affiliateCodeSource" TEXT;
