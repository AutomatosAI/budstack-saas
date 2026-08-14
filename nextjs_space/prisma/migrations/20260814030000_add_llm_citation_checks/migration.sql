-- AI citation monitor (LLM Visibility, US-005).
--
-- One row per (model, question) the weekly sweep asked on the TENANT'S OWN
-- Automatos account. APPEND-ONLY: a row records what one model answered at one
-- instant, so there is nothing to update and no "updatedAt" column — the shape
-- audit_logs and email_logs already use for evidence tables.
--
-- "engine" is the model id the workspace itself returned, or the literal
-- 'workspace-default' when the workspace exposes no model list and the run asked
-- the agent's own default. It is deliberately NOT an enum and deliberately never
-- a vendor name: the set of models a tenant enables is theirs, changes without
-- us, and a platform-invented label would claim knowledge of who answered that
-- we do not have.
--
-- "cited" false is the COMMON and CORRECT result, not a failure — it is the
-- baseline the dashboard's tally is measured against, which is why the sweep
-- writes it rather than only writing hits. Nothing is written at all for a check
-- that never produced an answer (rejected key, exhausted meter): "the key was
-- rejected" and "the model did not mention you" are opposite facts and one row
-- type cannot carry both.
--
-- "citedUrl" / "mentionText" are nullable and only populated when "cited" is
-- true. Both are bounded before they arrive (lib/seo/citation-match.ts: 500 and
-- 300 characters) rather than by a column type, matching how every other bounded
-- string in this schema is handled.
--
-- The (tenantId, checkedAt) index serves the only reader there is: the dashboard
-- tab, which asks for one store's recent checks newest-first. No index on
-- "engine" — the grouping happens over at most CITATION_HISTORY_LIMIT rows
-- already in memory.
--
-- CASCADE on the tenant FK matches seo_redirects (20260814020000): these rows
-- are diagnostics about a store, with no life of their own once the store is
-- gone, and unlike campaign_recipients they are not delivery evidence.
--
-- New table — no lock on anything live.
--
-- See tasks/prd-seo-llm-visibility.md (US-005).

CREATE TABLE "llm_citation_checks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "cited" BOOLEAN NOT NULL DEFAULT false,
    "citedUrl" TEXT,
    "mentionText" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_citation_checks_pkey" PRIMARY KEY ("id")
);

-- One store's history, newest first — the dashboard's only query.
CREATE INDEX "llm_citation_checks_tenantId_checkedAt_idx" ON "llm_citation_checks"("tenantId", "checkedAt");

ALTER TABLE "llm_citation_checks" ADD CONSTRAINT "llm_citation_checks_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
