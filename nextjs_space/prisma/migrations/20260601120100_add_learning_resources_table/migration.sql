-- The `learning_resources` model is in schema.prisma but shipped WITHOUT a migration,
-- so `prisma migrate deploy` (run on every boot by entrypoint.sh) never creates the table.
-- Live code reads it — including the PUBLIC /learn page (app/learn/page.tsx) and the
-- super-admin learning CRUD (app/api/super-admin/learning/route.ts) — so every one of
-- those paths throws "relation \"learning_resources\" does not exist" until this lands.
-- Column types/defaults are copied verbatim from `prisma migrate diff`.
-- Idempotent (IF NOT EXISTS) so it is safe to (re)apply on any environment.

CREATE TABLE IF NOT EXISTS "learning_resources" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'article',
    "videoUrl" TEXT,
    "docUrl" TEXT,
    "coverImage" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_resources_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "learning_resources_slug_key" ON "learning_resources"("slug");
CREATE INDEX IF NOT EXISTS "learning_resources_category_isPublished_idx" ON "learning_resources"("category", "isPublished");
CREATE INDEX IF NOT EXISTS "learning_resources_sortOrder_idx" ON "learning_resources"("sortOrder");
