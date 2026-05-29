import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// PRD-202 US-004 — withTenantContext request wrapper.
//
// Module-boundary mock (allowed): the tenant RESOLVER is stubbed so no DB / S3 /
// next/headers is needed. The context primitive (runWithTenantContextAsync /
// getTenantContext) runs REAL — these tests prove the wrapper actually binds the
// resolved tenant around the whole handler, and that two concurrent wrapped
// handlers never observe each other's tenant.
vi.mock("@/lib/tenant", () => ({
  getTenantFromRequest: vi.fn(),
}));

import { getTenantFromRequest } from "@/lib/tenant";
import { getTenantContext, hasTenantContext } from "@/lib/tenant-context";
import { withTenantContext } from "@/lib/with-tenant-context";

const mockedResolve = vi.mocked(getTenantFromRequest);
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

// Resolve the tenant from a `?t=` query param so each fake request maps to a
// known tenant (or null when absent).
function resolveFromQuery(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("t");
  return Promise.resolve(id ? ({ id } as { id: string }) : null);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedResolve.mockImplementation(resolveFromQuery as typeof getTenantFromRequest);
});

describe("withTenantContext — binds the resolved tenant around the handler", () => {
  it("runs the handler inside the resolved tenant's bound scope", async () => {
    let seen: string | null = "unset";
    const wrapped = withTenantContext(async () => {
      seen = getTenantContext();
      return new Response("ok");
    });

    const res = await wrapped(new NextRequest("http://store.test/api?t=tenant-A"));

    expect(await res.text()).toBe("ok");
    expect(seen).toBe("tenant-A");
    // Torn down after the handler settles — no leak into the caller.
    expect(getTenantContext()).toBeNull();
    expect(hasTenantContext()).toBe(false);
  });

  it("binds an explicit null when the request resolves to no tenant", async () => {
    let seenId: string | null = "unset";
    let bound = false;
    const wrapped = withTenantContext(async () => {
      seenId = getTenantContext();
      bound = hasTenantContext();
      return new Response("ok");
    });

    await wrapped(new NextRequest("http://store.test/api")); // no ?t=

    // Explicit null: id is null but a context WAS bound (hasTenantContext true) —
    // the middleware treats this as deliberate, not the implicit-unbound failure.
    expect(seenId).toBeNull();
    expect(bound).toBe(true);
  });

  it("keeps the bound tenant across awaits inside the handler", async () => {
    const observations: Array<string | null> = [];
    const wrapped = withTenantContext(async () => {
      observations.push(getTenantContext());
      await tick();
      observations.push(getTenantContext());
      await tick();
      observations.push(getTenantContext());
      return new Response("ok");
    });

    await wrapped(new NextRequest("http://store.test/api?t=tenant-A"));

    expect(observations).toEqual(["tenant-A", "tenant-A", "tenant-A"]);
  });

  it("passes through additional route args (e.g. { params }) to the handler", async () => {
    let receivedParams: unknown = null;
    const wrapped = withTenantContext(
      async (_req: NextRequest, ctx: { params: { slug: string } }) => {
        receivedParams = ctx.params;
        return new Response("ok");
      },
    );

    await wrapped(new NextRequest("http://store.test/api?t=tenant-A"), {
      params: { slug: "lekkerweed" },
    });

    expect(receivedParams).toEqual({ slug: "lekkerweed" });
  });
});

describe("withTenantContext — concurrent isolation (the bleed test)", () => {
  it("two concurrent wrapped handlers for different tenants never observe each other", async () => {
    const mismatches: Array<{ expected: string; seen: string | null }> = [];

    const handlerFor = (expected: string) =>
      withTenantContext(async () => {
        for (let step = 0; step < 5; step++) {
          await tick();
          const seen = getTenantContext();
          if (seen !== expected) mismatches.push({ expected, seen });
        }
        return new Response(getTenantContext() ?? "");
      });

    // Fire many interleaved A/B requests through the wrapper concurrently.
    const calls = Array.from({ length: 50 }, (_, i) => {
      const t = i % 2 === 0 ? "tenant-A" : "tenant-B";
      return handlerFor(t)(new NextRequest(`http://store.test/api?t=${t}`));
    });

    const responses = await Promise.all(calls);
    const bodies = await Promise.all(responses.map((r) => r.text()));

    expect(mismatches).toEqual([]);
    bodies.forEach((body, i) => {
      expect(body).toBe(i % 2 === 0 ? "tenant-A" : "tenant-B");
    });
    expect(getTenantContext()).toBeNull();
  });
});
