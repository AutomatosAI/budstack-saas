-- Platform-level marketing leads (budstacks.io homepage CTA + Operator 101 PDF).
--
-- RUN THIS BEFORE DEPLOYING THE CODE THAT QUERIES IT. The capture endpoint and
-- the super-admin leads page both 500 against a missing table.
--
-- Idempotent: safe to re-run.

-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlatformLeadStatus') THEN
        CREATE TYPE "PlatformLeadStatus" AS ENUM (
            'NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'UNSUBSCRIBED', 'REJECTED'
        );
    END IF;
END$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "platform_leads" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "PlatformLeadStatus" NOT NULL DEFAULT 'NEW',
    "source" TEXT NOT NULL,
    "name" TEXT,
    "company" TEXT,
    "country" TEXT,
    "notes" TEXT,
    "consentAt" TIMESTAMP(3),
    "consentText" TEXT,
    "unsubscribedAt" TIMESTAMP(3),
    "lastContactAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_leads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "platform_leads_email_key" ON "platform_leads"("email");
CREATE INDEX IF NOT EXISTS "platform_leads_status_createdAt_idx" ON "platform_leads"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "platform_leads_source_idx" ON "platform_leads"("source");
