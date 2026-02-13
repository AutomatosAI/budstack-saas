-- CreateTable
CREATE TABLE "marketplace_submissions" (
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
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "marketplace_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketplace_submissions_tenantId_idx" ON "marketplace_submissions"("tenantId");

-- CreateIndex
CREATE INDEX "marketplace_submissions_status_idx" ON "marketplace_submissions"("status");

-- AddForeignKey
ALTER TABLE "marketplace_submissions" ADD CONSTRAINT "marketplace_submissions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_submissions" ADD CONSTRAINT "marketplace_submissions_tenantTemplateId_fkey" FOREIGN KEY ("tenantTemplateId") REFERENCES "tenant_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_submissions" ADD CONSTRAINT "marketplace_submissions_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_submissions" ADD CONSTRAINT "marketplace_submissions_approvedTemplateId_fkey" FOREIGN KEY ("approvedTemplateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
