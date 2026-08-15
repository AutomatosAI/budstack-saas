// One-time login capture for the docs screenshot rig.
//
// Opens a real browser window; YOU log in to the tenant admin as normal
// (use a DEMO store account — screenshots will show whatever data this
// account can see). When the admin dashboard loads, the session is saved
// to state.json and the window closes.
//
//   node scripts/docs-shots/auth-setup.mjs [baseUrl]
//   (default baseUrl: https://budstacks.io)
//
// state.json IS A LIVE ADMIN SESSION — it is gitignored here and must
// never be committed or shared. Delete it when you're done (capture.mjs
// only needs it while running).
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const baseUrl = process.argv[2] || "https://budstacks.io";
const statePath = join(here, "state.json");

mkdirSync(here, { recursive: true });

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

console.log(`\nOpening ${baseUrl}/tenant-admin — log in as the DEMO store admin.`);
console.log("Waiting for the dashboard to load (up to 5 minutes)...\n");

await page.goto(`${baseUrl}/tenant-admin`);
await page.waitForURL("**/tenant-admin**", { timeout: 300_000, waitUntil: "networkidle" });
// Give Clerk a beat to settle its cookies after the redirect dance.
await page.waitForTimeout(3000);

await context.storageState({ path: statePath });
console.log(`Session saved to ${statePath}`);
console.log("Now run:  node scripts/docs-shots/capture.mjs\n");
await browser.close();
