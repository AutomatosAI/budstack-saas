/**
 * One-time script to apply marketplace migrations directly via SQL.
 * Prisma migrate deploy reports "no pending migrations" even though
 * the columns/tables don't exist, so we apply them manually with
 * IF NOT EXISTS / IF EXISTS guards to make it idempotent.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Applying marketplace schema changes...");

  // Migration 1: Add source and githubUrl to tenant_templates
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tenant_templates' AND column_name = 'source'
      ) THEN
        ALTER TABLE "tenant_templates" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'cloned';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tenant_templates' AND column_name = 'githubUrl'
      ) THEN
        ALTER TABLE "tenant_templates" ADD COLUMN "githubUrl" TEXT;
      END IF;
    END $$;
  `);
  console.log("  [1/4] tenant_templates: source + githubUrl columns OK");

  // Migration 1b: Add previewUrl to tenant_templates
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tenant_templates' AND column_name = 'previewUrl'
      ) THEN
        ALTER TABLE "tenant_templates" ADD COLUMN "previewUrl" TEXT;
      END IF;
    END $$;
  `);
  console.log("  [2/4] tenant_templates: previewUrl column OK");

  // Migration 2: Add community attribution fields to templates
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'templates' AND column_name = 'authorTenantId'
      ) THEN
        ALTER TABLE "templates" ADD COLUMN "authorTenantId" TEXT;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'templates' AND column_name = 'authorName'
      ) THEN
        ALTER TABLE "templates" ADD COLUMN "authorName" TEXT;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'templates_authorTenantId_fkey'
      ) THEN
        ALTER TABLE "templates" ADD CONSTRAINT "templates_authorTenantId_fkey"
          FOREIGN KEY ("authorTenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `);
  console.log("  [3/4] templates: authorTenantId + authorName columns OK");

  // Migration 3: Create marketplace_submissions table
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "marketplace_submissions" (
      "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
      "tenantId" TEXT NOT NULL,
      "tenantTemplateId" TEXT NOT NULL,
      "templateName" TEXT NOT NULL,
      "description" TEXT,
      "category" TEXT,
      "tags" TEXT[],
      "stagingS3Path" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "reviewerId" TEXT,
      "reviewerFeedback" TEXT,
      "reviewHistory" JSONB NOT NULL DEFAULT '[]',
      "approvedTemplateId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "reviewedAt" TIMESTAMP(3),
      CONSTRAINT "marketplace_submissions_pkey" PRIMARY KEY ("id")
    );
  `);

  // Create indexes and foreign keys (idempotent)
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'marketplace_submissions_tenantId_idx') THEN
        CREATE INDEX "marketplace_submissions_tenantId_idx" ON "marketplace_submissions"("tenantId");
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'marketplace_submissions_status_idx') THEN
        CREATE INDEX "marketplace_submissions_status_idx" ON "marketplace_submissions"("status");
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_submissions_tenantId_fkey') THEN
        ALTER TABLE "marketplace_submissions" ADD CONSTRAINT "marketplace_submissions_tenantId_fkey"
          FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_submissions_tenantTemplateId_fkey') THEN
        ALTER TABLE "marketplace_submissions" ADD CONSTRAINT "marketplace_submissions_tenantTemplateId_fkey"
          FOREIGN KEY ("tenantTemplateId") REFERENCES "tenant_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_submissions_reviewerId_fkey') THEN
        ALTER TABLE "marketplace_submissions" ADD CONSTRAINT "marketplace_submissions_reviewerId_fkey"
          FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;

      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'marketplace_submissions_approvedTemplateId_fkey') THEN
        ALTER TABLE "marketplace_submissions" ADD CONSTRAINT "marketplace_submissions_approvedTemplateId_fkey"
          FOREIGN KEY ("approvedTemplateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
      END IF;
    END $$;
  `);
  console.log("  [4/4] marketplace_submissions table + indexes + FKs OK");

  console.log("All marketplace schema changes applied successfully.");
}

main()
  .catch((e) => {
    console.error("Failed to apply marketplace migrations:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
