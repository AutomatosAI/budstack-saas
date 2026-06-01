import { describe, it, expect } from "vitest";

// PRD-208 AC-2 — soft-delete query-rewrite logic. PURE (no DB/Docker): the
// find-injects-deletedAt-null, delete→update rewrite, escape-hatch flags, and
// immutability of params are all exercised directly. The real-DB proof that a
// delete hides the row and withDeleted()/hardDelete() behave is the
// Docker-gated soft-delete.integration.test.ts (RALPH_BLOCKED on PRD-207).
import {
  applySoftDelete,
  injectNotDeleted,
  isSoftDeletable,
  softDeletableModels,
  type MiddlewareParams,
} from "@/lib/soft-delete";

const FIXED_NOW = new Date("2026-05-31T12:00:00.000Z");
const clock = () => FIXED_NOW;
const NO_BYPASS = { withDeleted: false, hardDelete: false };

describe("softDeletableModels / isSoftDeletable", () => {
  it("includes exactly the AC-1 models", () => {
    expect([...softDeletableModels].sort()).toEqual(
      [
        "marketplace_submissions",
        "products",
        "templates",
        "tenant_templates",
        "tenants",
      ].sort(),
    );
  });

  it("excludes leaf/log tables (they hard-delete per §13)", () => {
    expect(isSoftDeletable("audit_logs")).toBe(false);
    expect(isSoftDeletable("email_logs")).toBe(false);
    expect(isSoftDeletable("webhook_deliveries")).toBe(false);
    expect(isSoftDeletable("drgreen_webhook_logs")).toBe(false);
    expect(isSoftDeletable(undefined)).toBe(false);
  });
});

describe("injectNotDeleted", () => {
  it("adds deletedAt: null to an empty / undefined where", () => {
    expect(injectNotDeleted(undefined)).toEqual({ deletedAt: null });
    expect(injectNotDeleted({})).toEqual({ deletedAt: null });
  });

  it("preserves existing where clauses and adds deletedAt: null", () => {
    expect(injectNotDeleted({ tenantId: "t1" })).toEqual({
      tenantId: "t1",
      deletedAt: null,
    });
  });

  it("does NOT override an explicit deletedAt constraint (caller wins)", () => {
    const where = { deletedAt: { not: null } };
    expect(injectNotDeleted(where)).toEqual({ deletedAt: { not: null } });
  });

  it("returns a NEW object (immutability)", () => {
    const where = { tenantId: "t1" };
    const out = injectNotDeleted(where);
    expect(out).not.toBe(where);
    expect(where).toEqual({ tenantId: "t1" }); // input untouched
  });
});

describe("applySoftDelete — non-soft-deletable models pass through untouched", () => {
  it("returns params structurally unchanged for a log table", () => {
    const params: MiddlewareParams = {
      model: "audit_logs",
      action: "findMany",
      args: { where: { tenantId: "t1" } },
    };
    expect(applySoftDelete(params, NO_BYPASS, clock)).toBe(params);
  });
});

describe("applySoftDelete — default reads hide soft-deleted rows", () => {
  for (const action of ["findFirst", "findMany", "findUnique", "count", "aggregate", "groupBy"]) {
    it(`injects deletedAt: null into ${action}`, () => {
      const params: MiddlewareParams = {
        model: "products",
        action,
        args: { where: { tenantId: "t1" } },
      };
      const out = applySoftDelete(params, NO_BYPASS, clock);
      expect(out.args?.where).toEqual({ tenantId: "t1", deletedAt: null });
      // immutability: a new params object, input untouched
      expect(out).not.toBe(params);
      expect(params.args?.where).toEqual({ tenantId: "t1" });
    });
  }

  it("handles a read with no args at all", () => {
    const params: MiddlewareParams = { model: "tenants", action: "findMany" };
    const out = applySoftDelete(params, NO_BYPASS, clock);
    expect(out.args?.where).toEqual({ deletedAt: null });
  });
});

describe("applySoftDelete — delete is rewritten to a soft-delete update", () => {
  it("rewrites delete → update set deletedAt = now()", () => {
    const params: MiddlewareParams = {
      model: "tenants",
      action: "delete",
      args: { where: { id: "x1" } },
    };
    const out = applySoftDelete(params, NO_BYPASS, clock);
    expect(out.action).toBe("update");
    expect(out.args?.where).toEqual({ id: "x1" });
    expect(out.args?.data).toEqual({ deletedAt: FIXED_NOW });
  });

  it("rewrites deleteMany → updateMany set deletedAt = now()", () => {
    const params: MiddlewareParams = {
      model: "products",
      action: "deleteMany",
      args: { where: { tenantId: "t1" } },
    };
    const out = applySoftDelete(params, NO_BYPASS, clock);
    expect(out.action).toBe("updateMany");
    expect(out.args?.where).toEqual({ tenantId: "t1" });
    expect(out.args?.data).toEqual({ deletedAt: FIXED_NOW });
  });

  it("preserves a tenant-scoped where applied by the upstream middleware", () => {
    // simulate tenant-scope having already added tenantId to a delete
    const params: MiddlewareParams = {
      model: "products",
      action: "delete",
      args: { where: { id: "p1", tenantId: "t1" } },
    };
    const out = applySoftDelete(params, NO_BYPASS, clock);
    expect(out.action).toBe("update");
    expect(out.args?.where).toEqual({ id: "p1", tenantId: "t1" });
  });

  it("does NOT mutate the input params on a delete rewrite", () => {
    const params: MiddlewareParams = {
      model: "tenants",
      action: "delete",
      args: { where: { id: "x1" } },
    };
    applySoftDelete(params, NO_BYPASS, clock);
    expect(params.action).toBe("delete");
    expect(params.args).toEqual({ where: { id: "x1" } });
  });
});

describe("applySoftDelete — withDeleted() escape hatch", () => {
  it("skips the deletedAt: null filter on reads when withDeleted is set", () => {
    const params: MiddlewareParams = {
      model: "products",
      action: "findMany",
      args: { where: { tenantId: "t1" } },
    };
    const out = applySoftDelete(params, { withDeleted: true, hardDelete: false }, clock);
    expect(out.args?.where).toEqual({ tenantId: "t1" }); // no deletedAt injected
  });
});

describe("applySoftDelete — hardDelete() escape hatch", () => {
  it("leaves delete as a real DELETE when hardDelete is set (GDPR erasure)", () => {
    const params: MiddlewareParams = {
      model: "tenants",
      action: "delete",
      args: { where: { id: "x1" } },
    };
    const out = applySoftDelete(params, { withDeleted: false, hardDelete: true }, clock);
    expect(out.action).toBe("delete"); // NOT rewritten
    expect(out).toBe(params);
  });

  it("leaves deleteMany as a real DELETE when hardDelete is set", () => {
    const params: MiddlewareParams = {
      model: "products",
      action: "deleteMany",
      args: { where: { tenantId: "t1" } },
    };
    const out = applySoftDelete(params, { withDeleted: false, hardDelete: true }, clock);
    expect(out.action).toBe("deleteMany");
  });
});
