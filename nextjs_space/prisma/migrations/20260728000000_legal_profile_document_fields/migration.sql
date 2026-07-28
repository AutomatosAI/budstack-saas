-- Fields the terms and regulatory documents need.
--
-- /store/[slug]/terms, /cookies and /regulatory each re-exported the BudStacks
-- platform page, so an operator's own domain served the platform's documents
-- under the operator's brand. Terms is the sharper case: it named BudStacks as
-- the party to the customer's contract rather than the operator.
--
-- All nullable. A document whose required fields are absent serves the fallback
-- notice rather than rendering half a legal page.
--
-- See docs/PRDS/prd-data-protection-remediation.md.

ALTER TABLE "tenant_legal_profiles"
    ADD COLUMN "tradingName"         TEXT,
    ADD COLUMN "supportContactEmail" TEXT,
    ADD COLUMN "governingLaw"        TEXT,
    ADD COLUMN "deliveryTerms"       TEXT,
    ADD COLUMN "returnsPolicy"       TEXT,
    ADD COLUMN "licenceNumber"       TEXT,
    ADD COLUMN "regulatorName"       TEXT;
