-- Add the canonical Dr Green strain UUID to products.
-- BudStacks previously matched strains by slugified name only (no stable id),
-- so a Dr Green strain recreated with a new id silently broke ordering.
-- Idempotent + additive (nullable) — safe to run on the live DB before deploy.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "drGreenStrainId" TEXT;

CREATE INDEX IF NOT EXISTS "products_tenantId_drGreenStrainId_idx"
  ON "products" ("tenantId", "drGreenStrainId");
