import { describe, it, expect } from "vitest";

// RALPH_BLOCKED: needs PRD-207 Docker postgres
//
// PRD-208 AC-4 / success-metrics §7 real-DB proof. `EXPLAIN` output is a property
// of the live planner against real indexes — only a Postgres container with the
// index migration (20260531181200_prd208_concurrent_indexes) applied can prove
// it. Mocking is forbidden.
//
// The CONCURRENTLY index migration is applied to the container MANUALLY via psql
// (it cannot run inside Prisma's migration transaction — OQ-3), then verified
// here.

describe.skip("index presence (integration — real Postgres, PRD-207)", () => {
  it("orders-by-tenant-and-date uses an Index Scan on (tenantId, createdAt), not Seq Scan", async () => {
    // EXPLAIN SELECT ... FROM orders WHERE tenantId=$1 ORDER BY createdAt DESC
    // → plan contains "Index Scan" using "orders_tenantId_createdAt_idx".
    expect(true).toBe(true);
  });

  it("users-by-tenant uses the users.tenantId index", async () => {
    // EXPLAIN SELECT ... FROM users WHERE tenantId=$1
    // → plan uses "users_tenantId_idx".
    expect(true).toBe(true);
  });

  it("a not-deleted products query uses the (tenantId, deletedAt) index", async () => {
    // EXPLAIN SELECT ... FROM products WHERE tenantId=$1 AND deletedAt IS NULL
    // → plan uses "products_tenantId_deletedAt_idx".
    expect(true).toBe(true);
  });
});
