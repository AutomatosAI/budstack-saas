-- Storefront newsletter list (Email Phase 2, US-001).
--
-- Until now the storefront signup forms were dead stubs: they showed success
-- copy and dropped the address. This is the table those signups persist into.
--
-- Double opt-in is the point of the status column: a signup lands PENDING and
-- only marketing-mailable once the emailed token is followed (CONFIRMED).
-- `token` is the single credential behind both the confirm and the unsubscribe
-- link, so it is globally unique rather than tenant-unique.
--
-- See tasks/prd-email-authoring-campaigns.md (US-001..US-004).

CREATE TYPE "SubscriberStatus" AS ENUM ('PENDING', 'CONFIRMED', 'UNSUBSCRIBED', 'SUPPRESSED');

CREATE TABLE "newsletter_subscribers" (
    "id"             TEXT NOT NULL,
    "tenantId"       TEXT NOT NULL,
    "email"          TEXT NOT NULL,
    "status"         "SubscriberStatus" NOT NULL DEFAULT 'PENDING',
    "source"         TEXT,
    "consentAt"      TIMESTAMP(3),
    "confirmedAt"    TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "token"          TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "newsletter_subscribers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "newsletter_subscribers_token_key"
    ON "newsletter_subscribers"("token");
CREATE UNIQUE INDEX "newsletter_subscribers_tenantId_email_key"
    ON "newsletter_subscribers"("tenantId", "email");
CREATE INDEX "newsletter_subscribers_tenantId_status_idx"
    ON "newsletter_subscribers"("tenantId", "status");

ALTER TABLE "newsletter_subscribers"
    ADD CONSTRAINT "newsletter_subscribers_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
