import { test, expect } from "@playwright/test";

/**
 * PRD-212 §12 (E2E) — two browser contexts on two custom-domain hosts hammer the
 * storefront simultaneously; neither context ever sees the other tenant's brand.
 *
 * BLOCKED ON HARNESS (PRD-207): requires the app running with two seeded
 * custom-domain tenants and a host→tenant mapping (hosts-file / Host header in
 * CI). Skipped unless CUSTOM_DOMAIN_E2E_BASE_URL + the two host envs are set.
 *
 * Enable once the PRD-207 Docker/Playwright harness is up:
 *   CUSTOM_DOMAIN_E2E_BASE_URL=https://harness.local \
 *   TENANT_A_URL=https://tenant-a.example.com TENANT_B_URL=https://tenant-b.example.com \
 *   TENANT_A_MARKER="Tenant A" TENANT_B_MARKER="Tenant B" \
 *   yarn test:e2e tests/custom-domain-no-bleed.spec.ts
 */

const TENANT_A_URL = process.env.TENANT_A_URL;
const TENANT_B_URL = process.env.TENANT_B_URL;
const MARKER_A = process.env.TENANT_A_MARKER || "Tenant A";
const MARKER_B = process.env.TENANT_B_MARKER || "Tenant B";

const harnessReady = Boolean(TENANT_A_URL && TENANT_B_URL);

test.describe("PRD-212 AC-1 — custom-domain no content bleed (E2E)", () => {
  test.skip(!harnessReady, "BLOCKED on PRD-207 harness: set TENANT_A_URL / TENANT_B_URL to two seeded custom-domain tenants");

  test("two custom domains hammered concurrently never serve each other's content", async ({ browser }) => {
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    try {
      const pageA = await ctxA.newPage();
      const pageB = await ctxB.newPage();

      // Interleave loads so both hit the storefront inside the same revalidate window.
      for (let i = 0; i < 5; i++) {
        await Promise.all([
          pageA.goto(TENANT_A_URL!, { waitUntil: "domcontentloaded" }),
          pageB.goto(TENANT_B_URL!, { waitUntil: "domcontentloaded" }),
        ]);

        const bodyA = (await pageA.locator("body").innerText()) ?? "";
        const bodyB = (await pageB.locator("body").innerText()) ?? "";

        expect(bodyA, "A must show A's brand").toContain(MARKER_A);
        expect(bodyA, "A must NOT show B's brand").not.toContain(MARKER_B);
        expect(bodyB, "B must show B's brand").toContain(MARKER_B);
        expect(bodyB, "B must NOT show A's brand").not.toContain(MARKER_A);
      }
    } finally {
      await ctxA.close();
      await ctxB.close();
    }
  });
});
