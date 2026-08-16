-- budstacks.io's own per-route metadata, so the title, description and social
-- card a crawler reads stop being a code deploy.
--
-- This is a TIMESTAMPED DIRECTORY, not a loose .sql at the top of
-- prisma/migrations/. entrypoint.sh runs `prisma migrate deploy` on boot, which
-- only ever reads directories — the seven loose files up there
-- (add_platform_leads.sql and friends) have never been applied by a deploy and
-- had to be run by hand.
--
-- Kept OUT of `tenantScopedModels` in lib/db.ts, exactly like platform_posts,
-- platform_leads and learning_resources: that Set is an opt-in allowlist, and a
-- platform table inside it gets a tenantId filter welded onto every apex query,
-- which returns nothing rather than erroring.
--
-- EVERY AUTHORED COLUMN IS NULLABLE, because a row is an OVERRIDE and not a
-- replacement. The metadata each route already renders (app/layout.tsx's block
-- and each page's own `export const metadata`) stays the documented fallback,
-- and US-015 applies it per COLUMN rather than per row — so the seeded rows
-- below, which carry an image and nothing else, change no page's title today.
--
-- ONE INDEX, the UNIQUE on "routePath". It is both the duplicate guard (a route
-- with two rows has no defined title) and the only lookup any reader makes;
-- a second plain index on the same column would be storage and write cost for
-- the same seek. platform_posts treats "slug" the same way.
--
-- THE SEED gives every static marketing route the one platform default OG
-- image, so no route is left without a social card. Today the root layout
-- declares openGraph WITHOUT an images key (app/layout.tsx), which means every
-- budstacks.io page currently shares to a bare grey card.
--   - /budstack-hero-ecosystem.jpg is PLATFORM_DEFAULT_OG_IMAGE
--     (lib/seo/platform-post-metadata.ts), already the fallback for a post with
--     no cover. 2752x1536 (~1.79:1), the ratio og:image wants; the other brand
--     assets in public/ are a square cube and a 1500x287 wordmark, both of which
--     crop badly in a card.
--   - A ROOTED PATH, never an absolute URL: platformAbsoluteUrl() resolves it
--     against whichever origin the container is actually serving, so staging
--     does not advertise production's asset.
--   - The 15 paths are the STATIC public marketing routes, taken from
--     middleware.ts's isPublicRoute allowlist. The three dynamic families
--     (/blog/{slug}, /learn/{slug}, /documents/{slug}) are deliberately absent:
--     each of those entities carries its own metadata, and a settings table
--     cannot hold a row per row of another table.
--
-- IDEMPOTENT. `ON CONFLICT ("routePath") DO NOTHING` against
-- platform_seo_settings_routePath_key, so a re-run, a replayed history or a
-- restored database that already carries the rows cannot duplicate a route —
-- and cannot overwrite an image a super-admin has since chosen. Deliberately
-- not an upsert, for exactly that reason.
--
-- The ids are FIXED UUIDs rather than readable keys, so a restored database and
-- a fresh one agree, and so an admin route that runs parseUuid on a path param
-- can address every seeded row. Same call as the platform_posts seeds.
--
-- New table — no lock on anything live.
--
-- See tasks/prd-platform-content-and-seo.md (US-013/US-014).

-- CreateTable
CREATE TABLE "platform_seo_settings" (
    "id" TEXT NOT NULL,
    "routePath" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "ogImage" TEXT,
    "noindex" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_seo_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_seo_settings_routePath_key" ON "platform_seo_settings"("routePath");

-- Seed: the platform default OG image on every static marketing route.
INSERT INTO "platform_seo_settings" ("id", "routePath", "ogImage", "createdAt", "updatedAt")
VALUES
    ('f1030c5d-1ce5-48bb-b07e-b2ac3e7b6890', '/',                    '/budstack-hero-ecosystem.jpg', NOW(), NOW()),
    ('18d63f2e-2052-4a8f-bd8f-b5eea91c0c64', '/marketplace',         '/budstack-hero-ecosystem.jpg', NOW(), NOW()),
    ('2fc511e0-ee39-4040-b968-63a965f24835', '/learn',               '/budstack-hero-ecosystem.jpg', NOW(), NOW()),
    ('201a7006-3b5f-4396-82da-896e0af6ce08', '/blog',                '/budstack-hero-ecosystem.jpg', NOW(), NOW()),
    ('fdb5f1a5-9ebd-4ae8-9580-8acbb6931d9d', '/contact',             '/budstack-hero-ecosystem.jpg', NOW(), NOW()),
    ('b17936d2-9b8d-40b5-ac80-260c25afaf80', '/documents',           '/budstack-hero-ecosystem.jpg', NOW(), NOW()),
    ('03d87733-4ad5-448f-b981-83b56bb990ca', '/faq',                 '/budstack-hero-ecosystem.jpg', NOW(), NOW()),
    ('677a8103-7315-4ec2-baf3-086c3abe3c02', '/regulatory',          '/budstack-hero-ecosystem.jpg', NOW(), NOW()),
    ('11d2be7c-3819-4d78-8c6b-f604554bc07f', '/terms',               '/budstack-hero-ecosystem.jpg', NOW(), NOW()),
    ('85e75962-3647-4fc5-b074-d52d7bd21f6f', '/privacy',             '/budstack-hero-ecosystem.jpg', NOW(), NOW()),
    ('180cc759-4ed1-4dc8-a85e-5a057e9e57de', '/cookies',             '/budstack-hero-ecosystem.jpg', NOW(), NOW()),
    ('27640b1d-2995-4c53-a943-699520127e8b', '/dpa',                 '/budstack-hero-ecosystem.jpg', NOW(), NOW()),
    ('a70be63a-fa5a-41a3-a8b1-a06327c72f0a', '/aup',                 '/budstack-hero-ecosystem.jpg', NOW(), NOW()),
    ('0eb1cf55-4544-4f88-ad22-fa0e6962c449', '/legal/changelog',     '/budstack-hero-ecosystem.jpg', NOW(), NOW()),
    ('f6b6e104-7159-47f8-9d0e-b9f6ee6893c2', '/legal/subprocessors', '/budstack-hero-ecosystem.jpg', NOW(), NOW())
ON CONFLICT ("routePath") DO NOTHING;
