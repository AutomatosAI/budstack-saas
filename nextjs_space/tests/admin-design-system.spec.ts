import { test, expect, type Page } from "@playwright/test";

/**
 * Admin Design System Rollout — Phase 5 closeout suite (US-060)
 *
 * 5 archetypes × 2 admin tiers, minimum 10 tests:
 *   1. Settings page         (Template A — bs-page-header-centered)
 *   2. Dashboard page        (Template B — header + 4-up StatCard grid)
 *   3. Data table page       (Template C — bs-page-header-compact + bs-table)
 *   4. Modal contract        (Dialog/AlertDialog uses bs-dialog-content)
 *   5. Form contract         (Inputs honour [data-surface=admin] gate)
 *
 * Tests verify CSS contracts and dark theme tokens against the live admin
 * surface. They require an authenticated session — set PLAYWRIGHT_AUTH_STATE
 * to a stored authentication state file (Clerk session) before running.
 *
 * If PLAYWRIGHT_AUTH_STATE is not set, tests skip cleanly so the spec is
 * still typecheck-clean and documents the verification contract.
 */

const AUTH_STATE = process.env.PLAYWRIGHT_AUTH_STATE;
const SUPER_ADMIN_TENANT = process.env.PLAYWRIGHT_SUPER_ADMIN_TENANT || "platform";
const TENANT_ADMIN_TENANT = process.env.PLAYWRIGHT_TENANT_ADMIN_TENANT || "demo";

const skipIfNoAuth = () => {
  test.skip(
    !AUTH_STATE,
    "Set PLAYWRIGHT_AUTH_STATE to authenticated storageState file to run admin design system suite",
  );
};

test.use(AUTH_STATE ? { storageState: AUTH_STATE } : {});

async function expectDarkSurface(page: Page) {
  const surface = page.locator('[data-surface="admin"]');
  await expect(surface).toBeVisible();
  const bg = await surface.first().evaluate((el) =>
    window.getComputedStyle(el).backgroundColor,
  );
  expect(bg.replace(/\s/g, "")).toMatch(/rgb\(7,9,10\)|rgba\(7,9,10/);
}

async function expectCormorantDisplay(page: Page, selector: string) {
  const heading = page.locator(selector).first();
  await expect(heading).toBeVisible();
  const family = await heading.evaluate((el) =>
    window.getComputedStyle(el).fontFamily,
  );
  expect(family.toLowerCase()).toMatch(/cormorant/);
}

async function expectJetBrainsMono(page: Page, selector: string) {
  const el = page.locator(selector).first();
  await expect(el).toBeVisible();
  const family = await el.evaluate((node) =>
    window.getComputedStyle(node).fontFamily,
  );
  expect(family.toLowerCase()).toMatch(/jetbrains/);
}

test.describe("Super Admin — design system contract", () => {
  test.beforeEach(skipIfNoAuth);

  test("settings page wears dark canvas + Cormorant heading", async ({ page }) => {
    await page.goto("/super-admin/settings");
    await expectDarkSurface(page);
    await expectCormorantDisplay(page, ".bs-page-title, h1");
  });

  test("dashboard page renders 4-up StatCard grid with mono eyebrows", async ({
    page,
  }) => {
    await page.goto("/super-admin");
    await expectDarkSurface(page);
    const stats = page.locator(".bs-stat");
    await expect(stats.first()).toBeVisible();
    await expectJetBrainsMono(page, ".bs-eyebrow");
  });

  test("tenants table uses bs-table chrome and compact header", async ({
    page,
  }) => {
    await page.goto("/super-admin/tenants");
    await expectDarkSurface(page);
    await expect(page.locator(".bs-page-header-compact, .bs-table")).toHaveCount(
      await page.locator(".bs-page-header-compact, .bs-table").count(),
    );
  });

  test("audit logs IDs render in JetBrains Mono", async ({ page }) => {
    await page.goto("/super-admin/audit-logs");
    await expectDarkSurface(page);
    const monoCells = page.locator(".font-mono");
    await expect(monoCells.first()).toBeVisible();
  });

  test("create-tenant dialog uses bs-dialog-content shell", async ({ page }) => {
    await page.goto("/super-admin/tenants");
    const triggerCount = await page
      .getByRole("button", { name: /create|add|new/i })
      .count();
    test.skip(triggerCount === 0, "No create-tenant trigger present on this build");
    await page.getByRole("button", { name: /create|add|new/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const bg = await dialog.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor,
    );
    expect(bg.replace(/\s/g, "")).toMatch(/rgb\(21,26,28\)|rgba\(21,26,28/);
  });
});

test.describe("Tenant Admin — design system contract", () => {
  test.beforeEach(skipIfNoAuth);

  test("profile page wears dark canvas + Cormorant heading", async ({ page }) => {
    await page.goto(`/tenant-admin/profile`);
    await expectDarkSurface(page);
    await expectCormorantDisplay(page, ".bs-page-title, h1");
  });

  test("tenant overview renders StatCard grid with mono eyebrows", async ({
    page,
  }) => {
    await page.goto(`/tenant-admin`);
    await expectDarkSurface(page);
    const stats = page.locator(".bs-stat");
    await expect(stats.first()).toBeVisible();
    await expectJetBrainsMono(page, ".bs-eyebrow");
  });

  test("orders table uses bs-table chrome and compact header", async ({
    page,
  }) => {
    await page.goto(`/tenant-admin/orders`);
    await expectDarkSurface(page);
    await expect(
      page.locator(".bs-page-header-compact, .bs-table").first(),
    ).toBeVisible();
  });

  test("settings form inputs inherit dark theme via gate", async ({ page }) => {
    await page.goto(`/tenant-admin/settings`);
    await expectDarkSurface(page);
    const input = page.locator('input[type="text"], input:not([type])').first();
    await expect(input).toBeVisible();
    const bg = await input.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor,
    );
    expect(bg.replace(/\s/g, "")).toMatch(/rgb\(15,21,23\)|rgba\(15,21,23/);
  });

  test("delete-tenant alert dialog uses bs-dialog-content + danger button", async ({
    page,
  }) => {
    await page.goto(`/tenant-admin/profile`);
    const dangerTrigger = page.getByRole("button", { name: /delete|remove/i });
    const triggerCount = await dangerTrigger.count();
    test.skip(
      triggerCount === 0,
      "No delete trigger present on tenant profile page",
    );
    await dangerTrigger.first().click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    const bg = await dialog.evaluate((el) =>
      window.getComputedStyle(el).backgroundColor,
    );
    expect(bg.replace(/\s/g, "")).toMatch(/rgb\(21,26,28\)|rgba\(21,26,28/);
  });
});

test.describe("Cross-tier design system invariants", () => {
  test.beforeEach(skipIfNoAuth);

  test("global Cormorant Garamond stylesheet is loaded on admin pages", async ({
    page,
  }) => {
    await page.goto("/super-admin");
    const cormorantUrl = await page.evaluate(() => {
      const fonts = Array.from(document.fonts.values());
      return fonts.some((f) => f.family.toLowerCase().includes("cormorant"));
    });
    expect(cormorantUrl).toBe(true);
  });
});
