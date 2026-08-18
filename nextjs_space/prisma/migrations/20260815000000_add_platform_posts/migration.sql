-- budstacks.io's own blog posts, so publishing stops being a code deploy.
--
-- This is a TIMESTAMPED DIRECTORY, not a loose .sql at the top of
-- prisma/migrations/. entrypoint.sh runs `prisma migrate deploy` on boot, which
-- only ever looks at directories — the seven loose files up there (add_platform_leads.sql
-- and friends) have never been applied by a deploy and had to be run by hand.
--
-- Deliberately NOT the tenant `posts` table with a null tenantId: `posts` is
-- tenant-scoped in lib/db.ts and carries an authorId FK into the equally scoped
-- `users`. This table is kept OUT of `tenantScopedModels` for the same reason
-- platform_leads and learning_resources are — that Set is an opt-in allowlist,
-- and a platform table inside it gets a tenantId filter welded onto every apex
-- query.
--
-- The author is two DENORMALISED STRINGS with no FK. Beyond the scoping problem,
-- getCurrentUser().id returns a CLERK id rather than a users.id, and writing that
-- into a uuid FK throws P2003 — the exact failure that broke the lekkerweed blog
-- in PR #226.
--
-- "publishedAt" is nullable and set once, when the post first goes live, so the
-- public date does not jump every time a typo is fixed. A draft is
-- (published = false, publishedAt NULL).
--
-- One index: (published, publishedAt) serves the public index's only query —
-- published posts, newest first. Slug lookups (/blog/[slug], and the uniqueness
-- check the editor makes) are served by the UNIQUE constraint's own index,
-- platform_posts_slug_key; a second plain index on "slug" would be redundant
-- storage and write cost for the same lookup. platform_leads does the same:
-- unique on "email", no extra index beside it.
--
-- New table — no lock on anything live.
--
-- See tasks/prd-platform-content-and-seo.md (US-002).

-- CreateTable
CREATE TABLE "platform_posts" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "coverImage" TEXT,
    "coverImageAlt" TEXT,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "seo" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_posts_slug_key" ON "platform_posts"("slug");

-- CreateIndex
CREATE INDEX "platform_posts_published_publishedAt_idx" ON "platform_posts"("published", "publishedAt");
