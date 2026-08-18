import { describe, it, expect } from "vitest";

import { applyTenantScope, applyTenantWriteScope } from "@/lib/db";

// Regression for the lekkerweed report (2026-08-18): every tenant-admin email
// template save, delete and enable/disable toggle 500'd, because the
// tenant-scope extension wrapped update/delete `where`s of the null-access
// models (email_templates, email_event_mappings) in
// `{ AND: [where, { OR: [{tenantId}, {tenantId: null}] }] }`. Those operations
// take a WhereUniqueInput, which Prisma generates as `AtLeast<{...}, "id">` —
// the unique field must sit at the TOP LEVEL of the object — so the wrap was a
// PrismaClientValidationError on every single call. The route tests never saw
// it: they mock `@/lib/db` wholesale, so the extension never runs there.
//
// The invariants held here:
//   1. WRITE scoping never wraps — the caller's unique field stays top-level
//      and the tenant stamp is a sibling, a shape WhereUniqueInput accepts.
//   2. WRITE scoping never widens to tenantId-null rows — the OR-null read
//      widening exists so a tenant can SEE shared system rows, never write
//      them — and cannot be aimed at another tenant by the caller.
//   3. READ scoping still widens for null-access models, unchanged.
describe("applyTenantWriteScope", () => {
  it("keeps the unique field at the top level (WhereUniqueInput shape)", () => {
    const where = applyTenantWriteScope({ id: "template-1" }, "tenant-a");

    expect(where).toEqual({ id: "template-1", tenantId: "tenant-a" });
    expect(Object.keys(where)).not.toContain("AND");
    expect(Object.keys(where)).not.toContain("OR");
  });

  it("never widens a write to tenantId-null system rows", () => {
    const where = applyTenantWriteScope({ id: "template-1" }, "tenant-a");

    expect(JSON.stringify(where)).not.toContain("null");
  });

  it("stamps the bound tenant over a caller-supplied tenantId", () => {
    const where = applyTenantWriteScope(
      { id: "template-1", tenantId: "tenant-b" },
      "tenant-a",
    );

    expect(where.tenantId).toBe("tenant-a");
  });

  it("scopes a non-unique where (updateMany/deleteMany) the same strict way", () => {
    const where = applyTenantWriteScope({ templateId: "template-1" }, "tenant-a");

    expect(where).toEqual({ templateId: "template-1", tenantId: "tenant-a" });
  });
});

describe("applyTenantScope (reads)", () => {
  it("widens null-access reads so shared system rows stay visible", () => {
    expect(applyTenantScope({ id: "template-1" }, "tenant-a", true)).toEqual({
      AND: [
        { id: "template-1" },
        { OR: [{ tenantId: "tenant-a" }, { tenantId: null }] },
      ],
    });
  });

  it("stamps strict reads flat", () => {
    expect(applyTenantScope({ id: "order-1" }, "tenant-a", false)).toEqual({
      id: "order-1",
      tenantId: "tenant-a",
    });
  });
});
