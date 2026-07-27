-- Per-tenant controller identity for domain-specific privacy policies.
--
-- Each operator is the controller of its own storefront's patient data and must
-- publish a privacy notice naming itself. Until now every tenant domain served
-- the BudStacks corporate policy, which named BudStacks as controller.
--
-- The policy body is a BudStacks-managed versioned template; only the merge
-- values live here. See docs/PRDS/prd-data-protection-remediation.md (WS2).

CREATE TABLE "tenant_legal_profiles" (
    "id"                    TEXT NOT NULL,
    "tenantId"              TEXT NOT NULL,
    "controllerLegalName"   TEXT NOT NULL,
    "registeredAddress"     TEXT NOT NULL,
    "privacyContactEmail"   TEXT NOT NULL,
    "icoRegistrationNumber" TEXT,
    "dpoName"               TEXT,
    "dpoContact"            TEXT,
    "ukRepresentative"      TEXT,
    "templateVersion"       TEXT,
    "publishedAt"           TIMESTAMP(3),
    "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_legal_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_legal_profiles_tenantId_key"
    ON "tenant_legal_profiles"("tenantId");

ALTER TABLE "tenant_legal_profiles"
    ADD CONSTRAINT "tenant_legal_profiles_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
