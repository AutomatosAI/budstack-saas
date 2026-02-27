-- CreateTable
CREATE TABLE "kyc_journey_logs" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "email" TEXT,
    "eventType" TEXT NOT NULL,
    "eventSource" TEXT NOT NULL DEFAULT 'drgreen-webhook',
    "eventData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kyc_journey_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kyc_journey_logs_tenantId_clientId_idx" ON "kyc_journey_logs"("tenantId", "clientId");

-- CreateIndex
CREATE INDEX "kyc_journey_logs_eventType_idx" ON "kyc_journey_logs"("eventType");

-- AddForeignKey
ALTER TABLE "kyc_journey_logs" ADD CONSTRAINT "kyc_journey_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Add drGreenClientId to drgreen_webhook_logs
ALTER TABLE "drgreen_webhook_logs" ADD COLUMN "drGreenClientId" TEXT;

-- CreateIndex
CREATE INDEX "drgreen_webhook_logs_drGreenClientId_idx" ON "drgreen_webhook_logs"("drGreenClientId");
