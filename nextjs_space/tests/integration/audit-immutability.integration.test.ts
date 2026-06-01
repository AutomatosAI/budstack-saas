import { describe, it, expect } from "vitest";

// RALPH_BLOCKED: needs PRD-207 Docker postgres
//
// PRD-208 AC-5 real-DB proof. The append-only behaviour is enforced by a Postgres
// TRIGGER (migration 20260531181300_prd208_audit_logs_append_only) — it can ONLY
// be verified against a live Postgres with that migration applied. Mocking is
// forbidden: the whole point is that the DATABASE itself rejects the mutation.
//
// NOTE: this migration must be applied to the container in a beforeAll (it ships
// as a raw-SQL migration; `prisma migrate deploy` can apply it since it contains
// no CONCURRENTLY statement).

describe.skip("audit_logs immutability (integration — real Postgres, PRD-207)", () => {
  it("INSERT into audit_logs succeeds", async () => {
    // prisma.audit_logs.create(...) resolves.
    expect(true).toBe(true);
  });

  it("UPDATE on audit_logs raises the append-only trigger exception", async () => {
    // raw `UPDATE audit_logs SET action='x' WHERE id=...` rejects with the
    // 'append-only' RAISE EXCEPTION (restrict_violation).
    expect(true).toBe(true);
  });

  it("DELETE on audit_logs raises the append-only trigger exception", async () => {
    // raw `DELETE FROM audit_logs WHERE id=...` rejects.
    expect(true).toBe(true);
  });

  it("the SECURITY DEFINER GDPR purge (AC-5a) can erase rows for a user id", async () => {
    // SELECT audit_logs_gdpr_purge('<userId>') removes that user's rows and
    // returns the count, while the trigger remains active for everyone else.
    expect(true).toBe(true);
  });
});
