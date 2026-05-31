import { describe, it, expect } from "vitest";

// PRD-202 US-002 — additive tenant-context API. The real AsyncLocalStorage runs;
// no mocks. These prove the SAFE binding semantics (run/teardown, nesting,
// async propagation) and the implicit-vs-explicit-null distinction the Prisma
// middleware relies on (US-005).
import {
  getTenantContext,
  hasTenantContext,
  runWithTenantContext,
  runWithTenantContextAsync,
} from "@/lib/tenant-context";

describe("runWithTenantContext (sync) — bind + teardown", () => {
  it("binds the id inside the scope and tears down after", () => {
    expect(getTenantContext()).toBeNull();

    const observed = runWithTenantContext("A", () => getTenantContext());

    expect(observed).toBe("A");
    // Restored once the callback settles — no leak past the scope.
    expect(getTenantContext()).toBeNull();
  });

  it("returns the callback's value", () => {
    const result = runWithTenantContext("A", () => 42);
    expect(result).toBe(42);
  });

  it("nested scope restores the outer value on exit", () => {
    runWithTenantContext("A", () => {
      expect(getTenantContext()).toBe("A");

      const inner = runWithTenantContext("B", () => getTenantContext());
      expect(inner).toBe("B");

      // Inner scope popped — outer value is back.
      expect(getTenantContext()).toBe("A");
    });

    expect(getTenantContext()).toBeNull();
  });
});

describe("getTenantContext / hasTenantContext — implicit vs explicit null", () => {
  it("returns null and reports no context outside any scope", () => {
    expect(getTenantContext()).toBeNull();
    expect(hasTenantContext()).toBe(false);
  });

  it("explicit null is a BOUND context (hasTenantContext true, id null)", () => {
    const seen = runWithTenantContext(null, () => ({
      id: getTenantContext(),
      bound: hasTenantContext(),
    }));

    expect(seen.id).toBeNull();
    expect(seen.bound).toBe(true);
    // Teardown.
    expect(hasTenantContext()).toBe(false);
  });

  it("a bound non-null id reports hasTenantContext true", () => {
    runWithTenantContext("A", () => {
      expect(hasTenantContext()).toBe(true);
      expect(getTenantContext()).toBe("A");
    });
  });
});

describe("runWithTenantContextAsync — context survives await boundaries", () => {
  it("keeps the bound id across an await inside the callback", async () => {
    const before = await runWithTenantContextAsync("A", async () => {
      const pre = getTenantContext();
      await new Promise((r) => setTimeout(r, 0));
      const post = getTenantContext();
      return { pre, post };
    });

    expect(before.pre).toBe("A");
    // The crux: context is NOT lost after the await — that is the whole point
    // of run() over enterWith() under concurrency.
    expect(before.post).toBe("A");
    // Restored for the caller once the promise settles.
    expect(getTenantContext()).toBeNull();
  });

  it("resolves to the async callback's value", async () => {
    const result = await runWithTenantContextAsync("A", async () => {
      await Promise.resolve();
      return "payload";
    });
    expect(result).toBe("payload");
  });
});
