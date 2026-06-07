import { describe, expect, it } from "vitest";

// RALPH_BLOCKED: needs PRD-207 testcontainers Postgres + Clerk test harness.
// Asserts onboarding persists the DPA acceptance on the tenant and writes the
// tenant.dpa_accepted audit row against a REAL Postgres. Do NOT mock Prisma here
// to fake it (forbidden). Unskip + wire the container in PRD-207. Dormant until
// vitest.config.ts collects tests/integration/** (PRD-207).
describe.skip("onboarding DPA persistence (integration)", () => {
  it("rejects onboarding when the DPA acceptance is missing", async () => {
    // POST /api/onboarding without dpaVersion/dpaAcceptedAt -> 400, no tenant created.
    expect(true).toBe(true);
  });

  it("rejects onboarding when the DPA version is stale", async () => {
    // POST with a non-current dpaVersion -> 400, no tenant created.
    expect(true).toBe(true);
  });

  it("persists dpaAcceptedVersion + dpaAcceptedAt and writes tenant.dpa_accepted", async () => {
    // POST with the current dpaVersion + ISO timestamp ->
    // tenant row has dpaAcceptedVersion + dpaAcceptedAt + dpaAcceptedByUserId,
    // and ONE audit_logs row (tenant.dpa_accepted) with dpaVersion in metadata.
    expect(true).toBe(true);
  });
});
