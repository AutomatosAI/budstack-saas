import { describe, expect, it } from "vitest";

// RALPH_BLOCKED: needs PRD-207 testcontainers Postgres + Playwright/Clerk harness.
// This suite asserts the THREE erasure entry points (self-service, admin-assisted,
// Clerk user.deleted) converge on the SAME anonymised end-state against a REAL
// Postgres, and that each writes exactly one audit_logs row. It MUST run against a
// real database — do NOT mock Prisma here to fake it (forbidden by the PRD-213
// ralph contract). Unskip + wire the container in PRD-207.
//
// vitest.config.ts currently only collects tests/unit/** + lib/** (PRD-207 will add
// tests/integration/** once the Docker harness exists), so this file is dormant.
describe.skip("account erasure — convergent end-state (integration)", () => {
  it("self-service DELETE anonymises PII + severs drGreenClientId + audits", async () => {
    // 1. seed a users row with PII + drGreenClientId + a clerkUserId
    // 2. call DELETE /api/account/delete with confirm: "DELETE"
    // 3. assert email -> deleted-<id>@deleted.local, drGreenClientId === null,
    //    isActive === false, and ONE audit_logs row (account.deleted_gdpr_self)
    expect(true).toBe(true);
  });

  it("Clerk user.deleted webhook anonymises the matching local user", async () => {
    // 1. seed a users row with clerkUserId = 'clerk_x'
    // 2. POST a signed user.deleted svix event for clerk_x
    // 3. assert the row is anonymised + audit action account.erasure_clerk_user_deleted
    expect(true).toBe(true);
  });

  it("unmatched Clerk id writes account.erasure_noop_user_not_found", async () => {
    // POST a signed user.deleted for an id with NO local mapping ->
    // assert an account.erasure_noop_user_not_found audit_logs row exists.
    expect(true).toBe(true);
  });

  it("admin-assisted erasure converges on the same anonymised end-state", async () => {
    // DELETE /api/tenant-admin/customers/[id] -> same anonymised fields +
    // audit action account.erasure_admin_assisted.
    expect(true).toBe(true);
  });

  it("idempotency: self-delete then Clerk webhook leaves a single anonymised row", async () => {
    // erase via self-service, then replay the Clerk user.deleted event;
    // assert no second anonymisation write and a still-consistent end-state.
    expect(true).toBe(true);
  });
});
