import { describe, it, expect } from "vitest";

// RALPH_BLOCKED: needs PRD-207 Docker postgres
//
// PRD-208 AC-2 real-DB proof. This MUST run against a live Postgres container
// (testcontainers, provided by PRD-207) — it verifies the soft-delete middleware
// against the actual Prisma engine + real `deletedAt` columns and indexes. It is
// intentionally NOT mocked: a mock here would defeat the entire point (proving
// the rewrite hits the database correctly), which is forbidden.
//
// It is also NOT collected by the current vitest config (include = tests/unit/**
// + lib/**); PRD-207 will add the integration project/runner that picks it up.
//
// When PRD-207 lands, replace `describe.skip` with `describe` and wire the
// `prisma` client to the container's DATABASE_URL in a beforeAll.

describe.skip("soft-delete (integration — real Postgres, PRD-207)", () => {
  it("delete sets deletedAt and hides the row from default find*", async () => {
    // 1. create a product, 2. prisma.products.delete({ where: { id } }),
    // 3. findUnique returns null (row hidden), 4. raw SQL confirms deletedAt set.
    expect(true).toBe(true);
  });

  it("withDeleted() reveals soft-deleted rows", async () => {
    // withDeleted(() => prisma.products.findUnique(...)) returns the row,
    // with a non-null deletedAt.
    expect(true).toBe(true);
  });

  it("hardDelete() actually removes the row (GDPR erasure path, AC-2a)", async () => {
    // hardDelete(() => prisma.products.delete(...)) issues a real DELETE;
    // a subsequent withDeleted() find still returns null.
    expect(true).toBe(true);
  });

  it("restoring by clearing deletedAt makes the row visible again", async () => {
    // prisma.products.update({ data: { deletedAt: null } }) (via withDeleted or
    // a direct update) — default find* then returns the row.
    expect(true).toBe(true);
  });
});
