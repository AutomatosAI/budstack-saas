-- PRD-208 — audit_logs append-only enforcement (AC-5) + GDPR purge exception (AC-5a).
--
-- The audit log is the record of who-did-what and receives PRD-201's
-- destructive-action rows. Before this migration it was an ordinary, fully
-- mutable table: any DB connection or a stray Prisma update/delete could rewrite
-- or erase audit history. This makes it APPEND-ONLY at the database level.
--
-- Online-safety: CREATE FUNCTION / CREATE TRIGGER take a brief lock on
-- `audit_logs` to register the trigger but DO NOT rewrite existing rows and DO
-- NOT block concurrent INSERTs for any meaningful duration — safe on a populated
-- table. This file contains NO CONCURRENTLY statement, so it MAY be applied via
-- `prisma migrate deploy` (unlike the index migration). Staging dry-run first.
--
-- AC-6 (hash chain: prevHash/rowHash + chain-verify) is gated behind OQ-2 and
-- DEFERRED per the PRD — ship the cheap, high-value trigger now; add tamper-
-- evidence when PRD-201's destructive rows make the per-insert cost worth it.

-- ── AC-5: reject UPDATE and DELETE on audit_logs ─────────────────────────────
CREATE OR REPLACE FUNCTION audit_logs_reject_mutation()
  RETURNS TRIGGER
  LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION
    'audit_logs is append-only: % is not permitted (PRD-208 AC-5)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

DROP TRIGGER IF EXISTS audit_logs_append_only ON "audit_logs";

CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW
  EXECUTE FUNCTION audit_logs_reject_mutation();

-- ── AC-5a: role-gated GDPR erasure exception ─────────────────────────────────
-- Legal erasure (PRD-213) must remain possible WITHOUT leaving the table
-- casually mutable. This SECURITY DEFINER function is the ONLY sanctioned path
-- that can remove audit rows: it temporarily disables the trigger for its own
-- transaction, deletes the targeted rows, and re-enables it. It runs with the
-- DEFINER's privileges, so EXECUTE must be granted ONLY to the privileged
-- migration/DPO role (grant managed out-of-band by Gerard, not in this file, so
-- the file is environment-agnostic). Every call MUST be accompanied by an audit
-- INSERT recording the erasure (the insert is still allowed by the trigger).
CREATE OR REPLACE FUNCTION audit_logs_gdpr_purge(target_user_id TEXT)
  RETURNS INTEGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = pg_catalog, public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  IF target_user_id IS NULL OR length(trim(target_user_id)) = 0 THEN
    RAISE EXCEPTION 'audit_logs_gdpr_purge requires a non-empty target_user_id';
  END IF;

  ALTER TABLE "audit_logs" DISABLE TRIGGER audit_logs_append_only;
  DELETE FROM "audit_logs" WHERE "userId" = target_user_id;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  ALTER TABLE "audit_logs" ENABLE TRIGGER audit_logs_append_only;

  RETURN deleted_count;
END;
$$;

-- Lock down the purge function: revoke from PUBLIC so only roles Gerard
-- explicitly grants can erase. (The GRANT to the DPO/migration role is applied
-- per-environment out-of-band — intentionally NOT hardcoded here.)
REVOKE ALL ON FUNCTION audit_logs_gdpr_purge(TEXT) FROM PUBLIC;
