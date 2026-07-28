import { describe, expect, it } from "vitest";
import { AUTH_PUBLIC_ROUTES, n as isAuthPublicRoute } from "@/lib/auth-public-routes";

/**
 * WS3 US-013 — the scheduled tick is deliberately outside the api-auth
 * wrappers, because an external scheduler has no user session. That makes its
 * own auth the only thing standing between the internet and the register, so
 * the exemption is pinned here with the reason it exists.
 */

describe("the cron tick is an intentional, documented exemption", () => {
  it("is on the reviewed allow-list", () => {
    expect(isAuthPublicRoute("/api/cron/subprocessors")).toBe(true);
  });

  it("carries a justification naming its own auth", () => {
    const entry = AUTH_PUBLIC_ROUTES.find(
      (route) => route.pattern === "/api/cron/subprocessors",
    );
    expect(entry).toBeDefined();
    expect(entry!.reason).toMatch(/CRON_SECRET/);
    // The fail-closed property is the whole reason this is safe to exempt.
    expect(entry!.reason).toMatch(/fails CLOSED/i);
  });

  it("does not accidentally exempt the whole /api/cron namespace", () => {
    expect(isAuthPublicRoute("/api/cron/anything-else")).toBe(false);
  });
});
