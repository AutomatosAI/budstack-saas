-- Policy management: per-document choice between the maintained default and
-- the operator's own text, plus editable defaults.
--
-- The operator is the controller and these are their documents. Previously the
-- platform only allowed them to supply identifying details, which blocked any
-- operator with their own counsel-approved wording, and served a UK/EU-shaped
-- template to operators in Portugal and South Africa.
--
-- The choice is per DOCUMENT: an operator will commonly accept the cookie
-- notice and write their own terms.
--
-- See docs/PRDS/prd-data-protection-remediation.md.

CREATE TABLE "tenant_legal_documents" (
    "id"                             TEXT NOT NULL,
    "tenantId"                       TEXT NOT NULL,
    "slug"                           TEXT NOT NULL,
    "mode"                           TEXT NOT NULL DEFAULT 'default',
    "body"                           TEXT,
    "publishedAt"                    TIMESTAMP(3),
    "templateVersion"                TEXT,
    "responsibilityAcceptedAt"       TIMESTAMP(3),
    "responsibilityAcceptedByUserId" TEXT,
    "createdAt"                      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"                      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_legal_documents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_legal_documents_tenantId_slug_key"
    ON "tenant_legal_documents"("tenantId", "slug");
CREATE INDEX "tenant_legal_documents_tenantId_idx"
    ON "tenant_legal_documents"("tenantId");

ALTER TABLE "tenant_legal_documents"
    ADD CONSTRAINT "tenant_legal_documents_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "platform_legal_templates" (
    "slug"            TEXT NOT NULL,
    "title"           TEXT NOT NULL,
    "body"            TEXT NOT NULL,
    "version"         TEXT NOT NULL,
    "updatedByUserId" TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_legal_templates_pkey" PRIMARY KEY ("slug")
);

-- Backfill: any tenant who had already published keeps publishing, on the
-- default, with the same date. Without this, live storefronts would drop to the
-- "not published" notice the moment this deploys.
INSERT INTO "tenant_legal_documents"
    ("id", "tenantId", "slug", "mode", "publishedAt", "templateVersion", "updatedAt")
SELECT
    md5(p."tenantId" || ':' || d.slug),
    p."tenantId",
    d.slug,
    'default',
    p."publishedAt",
    p."templateVersion",
    CURRENT_TIMESTAMP
FROM "tenant_legal_profiles" p
CROSS JOIN (VALUES ('privacy'), ('terms'), ('cookies'), ('regulatory')) AS d(slug)
WHERE p."publishedAt" IS NOT NULL
ON CONFLICT ("tenantId", "slug") DO NOTHING;
