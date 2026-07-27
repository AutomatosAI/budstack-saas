-- Sub-processor register (GDPR Art. 28(2)/(4)).
--
-- The list was a hardcoded array in app/legal/subprocessors/page.tsx, so it
-- could only change with a deploy and nothing could start the 30-day notice
-- clock the DPA promises operators. Moving it into the database makes both
-- possible, and makes every change auditable.
--
-- Seeds the nine vendors currently published, all already in force. Dr Green is
-- seeded AS-IS: the agreed position is that it is an independent controller
-- rather than our sub-processor, but that is pending written confirmation, and
-- retiring an entry is exactly the operation this register exists to handle —
-- with a changelog entry and operator notice — rather than a silent migration.
--
-- See docs/PRDS/prd-data-protection-remediation.md (WS3, US-011).

CREATE TABLE "subprocessors" (
    "id"                TEXT NOT NULL,
    "name"              TEXT NOT NULL,
    "purpose"           TEXT NOT NULL,
    "region"            TEXT NOT NULL,
    "transferMechanism" TEXT NOT NULL,
    "dpaUrl"            TEXT,
    "status"            TEXT NOT NULL DEFAULT 'pending',
    "effectiveFrom"     TIMESTAMP(3) NOT NULL,
    "announcedAt"       TIMESTAMP(3),
    "retiredAt"         TIMESTAMP(3),
    "notes"             TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subprocessors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "subprocessors_status_effectiveFrom_idx"
    ON "subprocessors"("status", "effectiveFrom");

CREATE TABLE "subprocessor_objections" (
    "id"             TEXT NOT NULL,
    "subprocessorId" TEXT NOT NULL,
    "tenantId"       TEXT NOT NULL,
    "raisedByUserId" TEXT,
    "reason"         TEXT NOT NULL,
    "status"         TEXT NOT NULL DEFAULT 'open',
    "outOfWindow"    BOOLEAN NOT NULL DEFAULT false,
    "resolution"     TEXT,
    "resolvedAt"     TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subprocessor_objections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "subprocessor_objections_subprocessorId_status_idx"
    ON "subprocessor_objections"("subprocessorId", "status");
CREATE INDEX "subprocessor_objections_tenantId_idx"
    ON "subprocessor_objections"("tenantId");

ALTER TABLE "subprocessor_objections"
    ADD CONSTRAINT "subprocessor_objections_subprocessorId_fkey"
    FOREIGN KEY ("subprocessorId") REFERENCES "subprocessors"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "subprocessor_objections"
    ADD CONSTRAINT "subprocessor_objections_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: the vendors already published and in force. `announcedAt` is set to the
-- publication date of the existing page so the objection window is computed
-- from when operators could actually have seen the list, not from today.
INSERT INTO "subprocessors"
    ("id", "name", "purpose", "region", "transferMechanism", "dpaUrl",
     "status", "effectiveFrom", "announcedAt", "notes", "updatedAt")
VALUES
    ('clerk', 'Clerk',
     'Authentication, session management, user identity',
     'United States', 'EU SCCs + UK addendum', 'https://clerk.com/legal/dpa',
     'active', '2026-04-25', '2026-04-25', NULL, CURRENT_TIMESTAMP),

    ('railway', 'Railway',
     'Application hosting, build pipelines, deployment',
     'United States', 'EU SCCs + UK addendum', 'https://railway.com/legal/dpa',
     'active', '2026-04-25', '2026-04-25', NULL, CURRENT_TIMESTAMP),

    ('aws-s3', 'Amazon Web Services (AWS S3)',
     'Object storage for tenant assets and backups',
     'EU (eu-west-1) primary; US for cross-region replication',
     'EU SCCs + UK addendum', 'https://aws.amazon.com/service-terms/',
     'active', '2026-04-25', '2026-04-25', NULL, CURRENT_TIMESTAMP),

    ('postgres-railway', 'PostgreSQL (managed by Railway)',
     'Primary application database',
     'United States (Railway-managed)', 'EU SCCs + UK addendum', NULL,
     'active', '2026-04-25', '2026-04-25', NULL, CURRENT_TIMESTAMP),

    ('redis-railway', 'Redis (managed by Railway)',
     'Cache, session store, background-job queues',
     'United States (Railway-managed)', 'EU SCCs + UK addendum', NULL,
     'active', '2026-04-25', '2026-04-25', NULL, CURRENT_TIMESTAMP),

    ('stripe', 'Stripe',
     'Payment processing for platform subscription fees',
     'United States / Ireland',
     'EU SCCs + UK addendum; adequacy where applicable',
     'https://stripe.com/legal/dpa',
     'active', '2026-04-25', '2026-04-25', NULL, CURRENT_TIMESTAMP),

    ('resend', 'Resend',
     'Transactional email delivery (system notifications)',
     'United States', 'EU SCCs + UK addendum', 'https://resend.com/legal/dpa',
     'active', '2026-04-25', '2026-04-25', NULL, CURRENT_TIMESTAMP),

    ('dr-green-api', 'Dr. Green API',
     'Product catalogue and order routing for partner storefronts',
     'Portugal / European Union', 'Within EEA — no SCCs required', NULL,
     'active', '2026-04-25', '2026-04-25',
     'Classification under review: the agreed position is that Dr Green is an independent controller rather than a BudStacks sub-processor, pending written confirmation. Retire this entry through the register once confirmed, so operators receive notice of the change.',
     CURRENT_TIMESTAMP),

    ('sentry', 'Sentry',
     'Error monitoring and performance telemetry',
     'United States / EU', 'EU SCCs + UK addendum', 'https://sentry.io/legal/dpa/',
     'active', '2026-04-25', '2026-04-25', NULL, CURRENT_TIMESTAMP);
