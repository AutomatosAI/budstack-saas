-- Article 9 special-category health data purge
--
-- Removes the 15 health columns from consultation_questionnaires. BudStacks
-- forwards these answers to Dr Green from the in-memory request body and has no
-- lawful basis or functional need to retain them (GDPR Art. 5(1)(c)). Nothing in
-- the application read them back: the only consumer was an admin API field that
-- no client rendered, removed in the same change.
--
-- THIS MIGRATION IS DESTRUCTIVE AND IRREVERSIBLE.
-- Rows with "submittedToDrGreen" = false hold data that exists ONLY here; it is
-- lost. That is the accepted outcome (patients re-enter on failure) and the
-- count is recorded below so the loss is documented rather than silent.
--
-- See docs/PRDS/prd-data-protection-remediation.md (US-003).

-- 1. Durable remediation ledger. Created once; reused by later purges so the
--    evidence trail lives in the database rather than in a file that can be
--    edited after the fact.
CREATE TABLE IF NOT EXISTS "compliance_purge_records" (
    "id"          TEXT PRIMARY KEY,
    "purgeName"   TEXT        NOT NULL,
    "executedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
    "details"     JSONB       NOT NULL
);

-- 2. Capture counts BEFORE anything is destroyed.
INSERT INTO "compliance_purge_records" ("id", "purgeName", "details")
SELECT
    'article9-health-columns-2026-07-27',
    'Article 9 health columns dropped from consultation_questionnaires',
    jsonb_build_object(
        'rowsTotal', COUNT(*),
        'rowsSubmittedToDrGreen', COUNT(*) FILTER (WHERE "submittedToDrGreen"),
        'rowsNeverSubmittedToDrGreen', COUNT(*) FILTER (WHERE NOT "submittedToDrGreen"),
        'rowsCarryingHealthData', COUNT(*) FILTER (
            WHERE COALESCE(array_length("medicalConditions", 1), 0) > 0
               OR COALESCE("otherCondition", '') <> ''
               OR COALESCE(array_length("prescribedMedications", 1), 0) > 0
               OR COALESCE("prescribedSupplements", '') <> ''
               OR "hasHeartProblems"
               OR "hasCancerTreatment"
               OR "hasImmunosuppressants"
               OR "hasLiverDisease"
               OR "hasPsychiatricHistory"
               OR "hasAlcoholAbuse"
               OR "hasDrugServices"
        ),
        'columnsDropped', jsonb_build_array(
            'medicalConditions',
            'otherCondition',
            'prescribedMedications',
            'prescribedSupplements',
            'hasHeartProblems',
            'hasCancerTreatment',
            'hasImmunosuppressants',
            'hasLiverDisease',
            'hasPsychiatricHistory',
            'hasAlcoholAbuse',
            'hasDrugServices',
            'alcoholUnitsPerWeek',
            'cannabisReducesMeds',
            'cannabisFrequency',
            'cannabisAmountPerDay'
        ),
        'lawfulBasisConclusion',
            'No consumer and no retention justification. Dr Green is the controller for the clinical record; BudStacks retained a duplicate it never read.',
        'irreversible', true
    )
FROM "consultation_questionnaires"
ON CONFLICT ("id") DO NOTHING;

-- 3. Destroy the data.
ALTER TABLE "consultation_questionnaires"
    DROP COLUMN IF EXISTS "medicalConditions",
    DROP COLUMN IF EXISTS "otherCondition",
    DROP COLUMN IF EXISTS "prescribedMedications",
    DROP COLUMN IF EXISTS "prescribedSupplements",
    DROP COLUMN IF EXISTS "hasHeartProblems",
    DROP COLUMN IF EXISTS "hasCancerTreatment",
    DROP COLUMN IF EXISTS "hasImmunosuppressants",
    DROP COLUMN IF EXISTS "hasLiverDisease",
    DROP COLUMN IF EXISTS "hasPsychiatricHistory",
    DROP COLUMN IF EXISTS "hasAlcoholAbuse",
    DROP COLUMN IF EXISTS "hasDrugServices",
    DROP COLUMN IF EXISTS "alcoholUnitsPerWeek",
    DROP COLUMN IF EXISTS "cannabisReducesMeds",
    DROP COLUMN IF EXISTS "cannabisFrequency",
    DROP COLUMN IF EXISTS "cannabisAmountPerDay";
