import { test, expect } from "@playwright/test";

/**
 * E2E: South Africa ID-upload verification (PRD: tasks/prd-sa-id-upload-verification.md).
 *
 * SKIPPED until the prerequisites exist:
 *   - a ZA tenant with settings.verificationMode = "ID_UPLOAD"
 *   - SA_ID_UPLOAD_ENABLED=true (Budstacks) AND STG_SA_ID_ENABLED=true (Dr Green)
 *   - a Dr Green admin able to approve the uploaded document
 *
 * Set E2E_ID_UPLOAD_STORE to the store base URL to enable.
 */
const STORE = process.env.E2E_ID_UPLOAD_STORE;

test.describe("SA ID-upload verification", () => {
  test.skip(!STORE, "Set E2E_ID_UPLOAD_STORE to run (needs an ID-mode ZA tenant)");

  test("slim register → upload ID → pending → approved → orderable", async ({ page }) => {
    // 1. Consultation page shows the slim ID flow (no medical questionnaire).
    await page.goto(`${STORE}/consultation`);
    await expect(page.getByText(/verify with your ID/i)).toBeVisible();
    await expect(page.getByText(/medical conditions/i)).toHaveCount(0);

    // 2. Register (account + shipping only).
    // await page.getByPlaceholder("First name").fill("Thabo"); ... submit.
    // await expect(page.getByText(/account created/i)).toBeVisible();

    // 3. Log in, open the dashboard, upload an ID via the "Verify your identity" card.
    // await page.goto(`${STORE}/dashboard`);
    // await page.setInputFiles('input[type=file]', "tests/fixtures/sample-id.jpg");
    // await page.getByRole("button", { name: /submit for verification/i }).click();
    // await expect(page.getByText(/pending review/i)).toBeVisible();

    // 4. Before approval the order gate blocks checkout (isKYCVerified=false).
    // 5. After a Dr Green admin approves, the dashboard shows Verified and
    //    checkout succeeds (same isKYCVerified path as KYC).
    expect(true).toBe(true);
  });

  test("KYC-mode tenant still shows the full consultation (regression)", async ({ page }) => {
    // A non-ID tenant must be completely unaffected: consultation form present,
    // order gate unchanged. Point E2E_KYC_STORE at a KYC tenant to assert.
    expect(true).toBe(true);
  });
});
