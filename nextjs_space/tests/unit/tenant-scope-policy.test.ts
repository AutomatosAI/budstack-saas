import { describe, it, expect, vi, afterEach } from "vitest";

// PRD-202 US-005 — fail-loud middleware policy. Pure helpers, so no DB/Docker:
// the decision matrix, the env-flag reader, the error shape, the audit emitter,
// and the explicit-null bypass are all exercised directly. The real-DB proof
// that the middleware actually throws is the Docker-gated US-011.
import {
  TenantContextMissingError,
  bypassTenantScope,
  contextFreeAllowList,
  decideMissingContext,
  emitTenantContextMissing,
  isStrictTenantContext,
} from "@/lib/tenant-scope-policy";
import { getTenantContext, hasTenantContext } from "@/lib/tenant-context";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("decideMissingContext — the allow/warn/throw matrix", () => {
  it("a bound context is always allowed (explicit null system query), regardless of strict", () => {
    expect(decideMissingContext({ model: "orders", bound: true, strict: false })).toBe("allow");
    expect(decideMissingContext({ model: "orders", bound: true, strict: true })).toBe("allow");
  });

  it("an allow-listed model is allowed even when unbound", () => {
    const allowList = new Set<string>(["orders"]);
    expect(
      decideMissingContext({ model: "orders", bound: false, strict: true, allowList }),
    ).toBe("allow");
  });

  it("an unbound, non-allow-listed model THROWS under strict mode (the leak vector)", () => {
    expect(decideMissingContext({ model: "orders", bound: false, strict: true })).toBe("throw");
  });

  it("an unbound, non-allow-listed model WARNS (not throws) outside strict mode — the migration window", () => {
    expect(decideMissingContext({ model: "orders", bound: false, strict: false })).toBe("warn");
  });

  it("defaults to the (empty) contextFreeAllowList when none is injected", () => {
    expect(contextFreeAllowList.size).toBe(0);
    expect(decideMissingContext({ model: "orders", bound: false, strict: true })).toBe("throw");
  });
});

describe("isStrictTenantContext — env flag reader", () => {
  it("is true only for the exact string 'true'", () => {
    expect(isStrictTenantContext({ TENANT_CONTEXT_STRICT: "true" })).toBe(true);
  });

  it("is false for unset, empty, or any other value", () => {
    expect(isStrictTenantContext({})).toBe(false);
    expect(isStrictTenantContext({ TENANT_CONTEXT_STRICT: "false" })).toBe(false);
    expect(isStrictTenantContext({ TENANT_CONTEXT_STRICT: "1" })).toBe(false);
    expect(isStrictTenantContext({ TENANT_CONTEXT_STRICT: "TRUE" })).toBe(false);
  });
});

describe("TenantContextMissingError — carries the offending model/action", () => {
  it("is an Error subclass with a stable name and the model/action attached", () => {
    const err = new TenantContextMissingError("orders", "findMany");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(TenantContextMissingError);
    expect(err.name).toBe("TenantContextMissingError");
    expect(err.model).toBe("orders");
    expect(err.action).toBe("findMany");
    expect(err.message).toContain("orders");
    expect(err.message).toContain("findMany");
  });
});

describe("emitTenantContextMissing — structured audit signal", () => {
  it("writes a security.tenant_context_missing event via console.warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    emitTenantContextMissing("orders", "update");

    expect(warn).toHaveBeenCalledTimes(1);
    const [tag, payload] = warn.mock.calls[0];
    expect(tag).toBe("security.tenant_context_missing");
    expect(JSON.parse(payload as string)).toEqual({
      event: "security.tenant_context_missing",
      model: "orders",
      action: "update",
    });
  });
});

describe("bypassTenantScope — binds an explicit null for deliberate system queries", () => {
  it("runs fn with a bound (hasTenantContext true) null context, then tears down", () => {
    expect(hasTenantContext()).toBe(false);

    const inside = bypassTenantScope(() => ({
      id: getTenantContext(),
      bound: hasTenantContext(),
    }));

    // Explicit null: a context WAS bound (so the middleware allows it) but the id is null.
    expect(inside).toEqual({ id: null, bound: true });
    // Torn down — no leak into the caller.
    expect(hasTenantContext()).toBe(false);
    expect(getTenantContext()).toBeNull();
  });

  it("propagates the explicit-null context across awaits for an async fn", async () => {
    const observations: Array<{ id: string | null; bound: boolean }> = [];

    const result = await bypassTenantScope(async () => {
      observations.push({ id: getTenantContext(), bound: hasTenantContext() });
      await tick();
      observations.push({ id: getTenantContext(), bound: hasTenantContext() });
      return "done";
    });

    expect(result).toBe("done");
    expect(observations).toEqual([
      { id: null, bound: true },
      { id: null, bound: true },
    ]);
    expect(hasTenantContext()).toBe(false);
  });
});
