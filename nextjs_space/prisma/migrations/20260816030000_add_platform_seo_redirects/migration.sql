-- budstacks.io's own 301s, so renaming a published blog post stops discarding
-- every inbound link to its old URL.
--
-- This is a TIMESTAMPED DIRECTORY, not a loose .sql at the top of
-- prisma/migrations/. entrypoint.sh runs `prisma migrate deploy` on boot, which
-- only ever reads directories — the seven loose files up there
-- (add_platform_leads.sql and friends) have never been applied by a deploy and
-- had to be run by hand.
--
-- WHY NOT `seo_redirects`. That table's "tenantId" is NOT NULL with an FK to
-- "tenants", and the model is in `tenantScopedModels` (lib/db.ts). A platform
-- row would need a null tenant, which:
--   - the $extends scope rewrite would filter out of every read, and
--   - `seo_redirects_tenantId_fromPath_key` would not deduplicate, because
--     Postgres treats NULLs in a unique index as distinct — two rows could then
--     claim the same path and the winner would be whatever the planner chose.
-- Everything ELSE is shared: path normalisation (lib/seo/redirects.ts), the
-- rename plan (planSlugRenameRedirect) and the middleware matcher are the same
-- code for both tables. Only the storage is separate.
--
-- Kept OUT of `tenantScopedModels`, exactly like platform_posts,
-- platform_seo_settings, platform_leads and learning_resources: that Set is an
-- opt-in allowlist, and a platform table inside it gets a tenantId filter
-- welded onto every apex query, which returns nothing rather than erroring.
--
-- "fromPath" is stored normalised and LOWER-CASED, which is what makes the
-- UNIQUE a real duplicate guard: without the case fold, /Sale and /sale are two
-- rows that both claim the same request. "toPath" keeps its case — it is a
-- destination the browser is shown, not a key. Same discipline as
-- seo_redirects; see lib/seo/redirects.ts for the full rule.
--
-- TWO INDEXES, both earning their place: the UNIQUE on "fromPath" is the
-- duplicate guard AND the only lookup a match makes, and "createdAt" is the
-- feed's ORDER BY (app/api/public/seo/redirects), which reads the whole table
-- in insertion order for middleware to cache.
--
-- NO SEED. A redirect is written by a rename; inventing one here would claim a
-- URL nobody moved.
--
-- New table — no lock on anything live.
--
-- See tasks/prd-platform-content-and-seo.md (US-019).

-- CreateTable
CREATE TABLE "platform_seo_redirects" (
    "id" TEXT NOT NULL,
    "fromPath" TEXT NOT NULL,
    "toPath" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_seo_redirects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_seo_redirects_fromPath_key" ON "platform_seo_redirects"("fromPath");

-- CreateIndex
CREATE INDEX "platform_seo_redirects_createdAt_idx" ON "platform_seo_redirects"("createdAt");
