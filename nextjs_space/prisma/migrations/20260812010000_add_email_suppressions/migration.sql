-- Per-tenant marketing suppression list (Email Phase 2, US-004).
--
-- Unsubscribe has to be honoured on EVERY future marketing send, not just by
-- flipping the subscriber row: a campaign can address a customer or a manually
-- imported address that has no newsletter_subscribers row at all. This table is
-- the single list the worker checks before a marketing send, keyed on the
-- address itself so it survives the subscriber row being deleted or re-created.
--
-- Transactional mail deliberately ignores it — an opt-out from marketing is not
-- a request to stop receiving your own order confirmation.
--
-- `reason` is provenance only; ANY row suppresses. Values are lower-case
-- because they are also the wire values used by the API and the audit trail.
--
-- See tasks/prd-email-authoring-campaigns.md (US-004, US-019, US-020).

CREATE TYPE "SuppressionReason" AS ENUM ('unsubscribed', 'bounced', 'manual');

CREATE TABLE "email_suppressions" (
    "id"        TEXT NOT NULL,
    "tenantId"  TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "reason"    "SuppressionReason" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_suppressions_pkey" PRIMARY KEY ("id")
);

-- One row per address per tenant: re-suppressing is a no-op that keeps the
-- original reason, and the worker's lookup is a single index hit.
CREATE UNIQUE INDEX "email_suppressions_tenantId_email_key"
    ON "email_suppressions"("tenantId", "email");
CREATE INDEX "email_suppressions_tenantId_createdAt_idx"
    ON "email_suppressions"("tenantId", "createdAt");

ALTER TABLE "email_suppressions"
    ADD CONSTRAINT "email_suppressions_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
