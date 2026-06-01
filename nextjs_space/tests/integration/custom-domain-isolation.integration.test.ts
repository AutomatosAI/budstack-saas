import { describe, it, expect } from "vitest";

/**
 * PRD-212 §12 — THE PROOF TEST (integration): two custom domains in one
 * `revalidate` window must each render their OWN tenant, never the other's
 * cached HTML.
 *
 * BLOCKED ON HARNESS (PRD-207): this needs a running Next.js server (so the real
 * Next.js full-route/ISR cache is exercised) plus a seeded Postgres with two
 * tenants on two custom domains. That Docker/Playwright harness is NOT available
 * in this worktree, so the suite is `describe.skip`.
 *
 * It is written as a REAL HTTP test against the running app — deliberately NOT
 * faked with mocked Prisma / an in-memory store (PRD §12 forbids a mocked
 * integration proof; the local proof is tests/unit/custom-domain-cache-key.test.ts).
 * Un-skip by setting CUSTOM_DOMAIN_E2E_BASE_URL to the harness base URL and
 * seeding TENANT_A_HOST / TENANT_B_HOST with visibly different content.
 *
 * To enable once PRD-207 lands:
 *   1. Seed tenant A (TENANT_A_HOST) and tenant B (TENANT_B_HOST) with distinct
 *      businessName / branding.
 *   2. Point CUSTOM_DOMAIN_E2E_BASE_URL at the running app (the edge/middleware
 *      must resolve the Host header to the custom-domain hint).
 *   3. Replace describe.skip with describe.
 */

const BASE_URL = process.env.CUSTOM_DOMAIN_E2E_BASE_URL;
const HOST_A = process.env.TENANT_A_HOST || "tenant-a.example.com";
const HOST_B = process.env.TENANT_B_HOST || "tenant-b.example.com";
const MARKER_A = process.env.TENANT_A_MARKER || "Tenant A";
const MARKER_B = process.env.TENANT_B_MARKER || "Tenant B";

const harnessReady = Boolean(BASE_URL);

async function fetchStorefront(host: string): Promise<string> {
  // Hit the app with the custom-domain Host header so middleware applies the
  // PRD-212 host-scoped rewrite (/store/cd-<hash(host)>). A bare fetch with a
  // Host header is what a real custom-domain request looks like at the edge.
  const res = await fetch(`${BASE_URL}/`, { headers: { host }, redirect: "manual" });
  expect(res.ok).toBe(true);
  return res.text();
}

describe.skipIf(!harnessReady)(
  "PRD-212 AC-1 — concurrent custom-domain isolation (BLOCKED on PRD-207 harness)",
  () => {
    it("serves A's content to A and B's content to B within the same revalidate window", async () => {
      // 1) Populate A's ISR entry.
      const aFirst = await fetchStorefront(HOST_A);
      expect(aFirst).toContain(MARKER_A);
      expect(aFirst).not.toContain(MARKER_B);

      // 2) Immediately request B (inside the 60s window). Pre-fix this returned
      //    A's cached page (shared /store/_cd key). Post-fix B has its own key.
      const bFirst = await fetchStorefront(HOST_B);
      expect(bFirst).toContain(MARKER_B);
      expect(bFirst).not.toContain(MARKER_A);

      // 3) A again — still A's content, served from A's own key.
      const aSecond = await fetchStorefront(HOST_A);
      expect(aSecond).toContain(MARKER_A);
      expect(aSecond).not.toContain(MARKER_B);
    });

    it("never cross-bleeds under interleaved concurrent load", async () => {
      const requests = Array.from({ length: 20 }, (_, i) =>
        i % 2 === 0
          ? fetchStorefront(HOST_A).then((html) => ({ host: HOST_A, html }))
          : fetchStorefront(HOST_B).then((html) => ({ host: HOST_B, html })),
      );
      const results = await Promise.all(requests);
      for (const { host, html } of results) {
        const own = host === HOST_A ? MARKER_A : MARKER_B;
        const other = host === HOST_A ? MARKER_B : MARKER_A;
        expect(html).toContain(own);
        expect(html).not.toContain(other);
      }
    });
  },
);

describe("PRD-212 §12 — integration harness availability", () => {
  it("documents the blocked-on-harness status (always runs)", () => {
    // A non-skipped breadcrumb so the suite shows up in the report and the skip
    // is intentional/visible rather than silent. The real assertions above run
    // only when CUSTOM_DOMAIN_E2E_BASE_URL is set (PRD-207 harness).
    expect(harnessReady || !harnessReady).toBe(true);
  });
});
