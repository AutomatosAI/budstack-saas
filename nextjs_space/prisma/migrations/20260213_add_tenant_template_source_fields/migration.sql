-- AlterTable
ALTER TABLE "tenant_templates" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'cloned';
ALTER TABLE "tenant_templates" ADD COLUMN "githubUrl" TEXT;
