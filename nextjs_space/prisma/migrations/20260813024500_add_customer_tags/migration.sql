-- CRM-lite customer tags (Email Phase 2, US-024).
--
-- One row per (tenant, customer, tag). Tags are stored normalised (trimmed,
-- lowercased) by the API layer; the compound unique key is what makes
-- re-adding a tag idempotent at the database rather than only in the route.
--
-- Both foreign keys CASCADE deliberately: a tag is targeting metadata with no
-- life of its own — unlike campaign_recipients (US-016), which must outlive
-- the user as delivery evidence, a tag should vanish with its user or tenant.
-- GDPR erasure anonymises the users row in place (no delete), so erased
-- customers keep their rows but are filtered from every admin surface.
--
-- "customer_tags_tenantId_tag_idx" serves the customers-list tag filter and
-- US-025's "has tag" segment axis.
--
-- See tasks/prd-email-authoring-campaigns.md (US-024).

CREATE TABLE "customer_tags" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_tags_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_tags_tenantId_tag_idx" ON "customer_tags"("tenantId", "tag");

CREATE UNIQUE INDEX "customer_tags_tenantId_userId_tag_key" ON "customer_tags"("tenantId", "userId", "tag");

ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
