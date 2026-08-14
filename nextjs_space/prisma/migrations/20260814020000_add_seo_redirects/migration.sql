-- Owner-authored 301s (SEO Supercharge, US-020).
--
-- One row per moved URL. "fromPath" is stored NORMALISED and LOWER-CASED by
-- lib/seo/redirects.ts before it ever reaches this table: leading slash, no
-- query, no fragment, no trailing slash, no repeated slashes. That is what makes
-- "seo_redirects_tenantId_fromPath_key" a real duplicate guard — without the
-- case fold, "/Sale" and "/sale" are two rows that both claim the same request
-- and the winner is whichever the planner returns first. "toPath" keeps its
-- case; it is a destination, not a key.
--
-- Both columns hold STORE-RELATIVE paths. An absolute URL is refused at the API
-- boundary, because an unvalidated external destination is an open redirect
-- authored through a text box.
--
-- "statusCode" is 301 or 308, enforced in Zod at the boundary rather than by a
-- CHECK constraint, matching how every other bounded value in this schema is
-- handled (campaigns.status, tenants.plan). Middleware refuses to act on any
-- other value it reads back (lib/seo/redirect-lookup.ts parseFeedBody), so a row
-- written around the API cannot make the storefront emit an arbitrary status.
--
-- No "updatedAt": the story's shape is create / retarget / delete, and the
-- retarget path rewrites toPath in place. Add one when something needs to sort
-- by recency of change.
--
-- CASCADE on the tenant FK matches segments (20260813140000) and customer_tags
-- (20260813024500): a redirect is store configuration with no life of its own,
-- and unlike campaign_recipients it is not delivery evidence.
--
-- See tasks/prd-seo-supercharge.md (US-020).

CREATE TABLE "seo_redirects" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromPath" TEXT NOT NULL,
    "toPath" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seo_redirects_pkey" PRIMARY KEY ("id")
);

-- Serves both readers: the public feed that hands middleware a tenant's whole
-- table, and the manager tab that lists it newest first.
CREATE INDEX "seo_redirects_tenantId_createdAt_idx" ON "seo_redirects"("tenantId", "createdAt");

-- One rule per path per store. The write route relies on this: a duplicate
-- create is caught here (P2002) rather than by a read-then-write that two
-- concurrent saves would both pass.
CREATE UNIQUE INDEX "seo_redirects_tenantId_fromPath_key" ON "seo_redirects"("tenantId", "fromPath");

ALTER TABLE "seo_redirects" ADD CONSTRAINT "seo_redirects_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
