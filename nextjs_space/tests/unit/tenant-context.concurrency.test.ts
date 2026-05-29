import { describe, it, expect } from "vitest";
import { AsyncLocalStorage } from "node:async_hooks";

// PRD-202 US-003 — node-only concurrency proof (AC-7 at the ALS level, no DB).
//
// This is the red/green evidence the fix matters, without Docker/Postgres:
//   * runWithTenantContextAsync keeps every interleaved "request" pinned to its
//     OWN tenant across many microtask yields — zero cross-tenant observation.
//   * the raw enterWith() pattern (what lib/tenant-context.ts does today, US-009
//     removes it) provides NO isolation between concurrently-started requests.
// The full-stack Postgres version of this proof is the Docker-gated US-010.
import {
  getTenantContext,
  runWithTenantContext,
  runWithTenantContextAsync,
} from "@/lib/tenant-context";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("PRD-202 AC-7 (node-level) — runWithTenantContext isolates under interleave", () => {
  it("fires 300 interleaved requests across 3 tenants with zero cross-tenant observation", async () => {
    const tenants = ["tenant-A", "tenant-B", "tenant-C"];
    const mismatches: Array<{ expected: string; seen: string | null; step: number }> = [];

    // Each "request" is bound to its own tenant, then yields the microtask queue
    // five times and re-asserts its context after every yield — forcing the kind
    // of interleave that bleeds under enterWith on a shared Node process.
    const requests = Array.from({ length: 300 }, (_, i) => {
      const expected = tenants[i % tenants.length];
      return runWithTenantContextAsync(expected, async () => {
        for (let step = 0; step < 5; step++) {
          await tick();
          const seen = getTenantContext();
          if (seen !== expected) mismatches.push({ expected, seen, step });
        }
        return getTenantContext();
      });
    });

    const finalSeen = await Promise.all(requests);

    // The whole isolation property in one assertion: nobody ever saw another
    // tenant, across 300 requests * 5 yields = 1500 interleaved observations.
    expect(mismatches).toEqual([]);
    finalSeen.forEach((seen, i) => {
      expect(seen).toBe(tenants[i % tenants.length]);
    });

    // Context is fully torn down once all requests settle.
    expect(getTenantContext()).toBeNull();
  });
});

// Root-cause contrast, deterministic (not timing-dependent). The interleave
// bleed is genuinely hard to reproduce reliably node-only because each `await`
// snapshots the context frame — which is exactly why the authoritative red→green
// proof is the Postgres integration test (US-010). What we CAN prove crisply and
// without flakiness is the underlying mechanism: enterWith has no scope boundary
// (a resolver's side-effect escapes into the enclosing/root context and is never
// popped), whereas run() confines the binding and restores on exit. That
// escape-with-no-cleanup is precisely what lets one request's tenant persist on
// Railway's shared, persistent Node process and surface in another request.
describe("baseline contrast — enterWith() escapes its caller; run() confines", () => {
  it("enterWith() with no enclosing scope persists into the shared context (the leak vector)", async () => {
    const unsafe = new AsyncLocalStorage<{ id: string }>();

    // The unsafe pattern PRD-202 removed: a resolver binding context via raw
    // enterWith at the top of the async context, with no .run() wrapper.
    const request1 = async () => {
      unsafe.enterWith({ id: "req1" });
      await tick();
    };
    await request1();

    // request1 finished, but its binding was never torn down — a subsequent read
    // on the same persistent context still sees req1. On a shared Node process
    // this is how req1's tenant bleeds into req2.
    expect(unsafe.getStore()?.id).toBe("req1");
  });

  it("enterWith() overrides even an active run() scope in place (no boundary)", () => {
    const unsafe = new AsyncLocalStorage<{ id: string }>();

    unsafe.run({ id: "outer" }, () => {
      expect(unsafe.getStore()?.id).toBe("outer");
      // A 'resolver' that sets context as a side-effect, then returns.
      unsafe.enterWith({ id: "intruder" });
      // The enclosing scope is now corrupted — enterWith honoured no boundary.
      expect(unsafe.getStore()?.id).toBe("intruder");
    });
  });

  it("runWithTenantContext() confines the binding — the caller is never polluted", () => {
    expect(getTenantContext()).toBeNull();

    runWithTenantContext("scoped", () => {
      expect(getTenantContext()).toBe("scoped");
    });

    // Popped cleanly. This confinement is the fix: one request's binding can
    // never escape into another request's continuation.
    expect(getTenantContext()).toBeNull();
  });
});
