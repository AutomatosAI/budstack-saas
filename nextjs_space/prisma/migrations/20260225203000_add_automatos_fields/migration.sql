-- AlterTable
ALTER TABLE "platform_settings" ADD COLUMN     "automatosAgentId" INTEGER,
ADD COLUMN     "automatosApiKey" TEXT;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "automatosAgentId" INTEGER,
ADD COLUMN     "automatosApiKey" TEXT;
