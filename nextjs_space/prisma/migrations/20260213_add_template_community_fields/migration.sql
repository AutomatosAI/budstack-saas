-- AlterTable
ALTER TABLE "templates" ADD COLUMN "authorTenantId" TEXT;
ALTER TABLE "templates" ADD COLUMN "authorName" TEXT;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_authorTenantId_fkey" FOREIGN KEY ("authorTenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
