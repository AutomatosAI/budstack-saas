// Docs screenshot rig — walks every admin view in manifest.json using the
// session from auth-setup.mjs and writes retina PNGs to shots/.
//
//   node scripts/docs-shots/capture.mjs [baseUrl] [--only id1,id2]
//
// Re-run after any release to refresh every screenshot. One entry failing
// never stops the run (its failure is listed at the end).
import { chromium } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const baseUrl = process.argv[2]?.startsWith("http") ? process.argv[2] : "https://budstacks.io";
const onlyArg = process.argv.find((a) => a.startsWith("--only"));
const only = onlyArg ? (onlyArg.split("=")[1] || process.argv[process.argv.indexOf(onlyArg) + 1] || "").split(",").filter(Boolean) : null;

const statePath = join(here, "state.json");
const manifestPath = join(here, "manifest.json");
const outDir = join(here, "shots");

if (!existsSync(statePath)) {
  console.error("No state.json — run auth-setup.mjs first (one-time login).");
  process.exit(1);
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  storageState: statePath,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2, // retina-crisp in guides
  colorScheme: "light", // guides render light-theme shots; flip for a dark set
});
const page = await context.newPage();

const failures = [];
let done = 0;
const entries = only ? manifest.filter((m) => only.includes(m.id)) : manifest;

for (const entry of entries) {
  const { id, route, clickSelector, waitFor, fullPage = true, settleMs = 1200, gotoWait = "networkidle" } = entry;
  try {
    await page.goto(baseUrl + route, { waitUntil: gotoWait, timeout: 45_000 });
    const clickList = entry.clicks || (clickSelector ? [clickSelector] : []);
    for (const sel of clickList) {
      // role=tab[name="X"] or a plain CSS/text selector
      const m = sel.match(/^role=(\w+)\[name="(.+)"\]$/);
      const target = m ? page.getByRole(m[1], { name: m[2] }) : page.locator(sel);
      await target.first().click({ timeout: 15_000 });
      await page.waitForLoadState("networkidle").catch(() => {});
    }
    if (waitFor) await page.locator(waitFor).first().waitFor({ timeout: 20_000 });
    await page.waitForTimeout(settleMs); // charts/accordions settle
    // A login redirect means the session expired — fail loudly, don't shoot the login page.
    if (page.url().includes("/auth/login") || page.url().includes("accounts.")) {
      throw new Error("redirected to login — session expired; re-run auth-setup.mjs");
    }
    await page.screenshot({ path: join(outDir, `${id}.png`), fullPage });
    done++;
    console.log(`  ✓ ${id}`);
  } catch (err) {
    failures.push({ id, error: String(err.message || err).slice(0, 140) });
    console.log(`  ✗ ${id} — ${String(err.message || err).slice(0, 100)}`);
  }
}

await browser.close();
console.log(`\n${done}/${entries.length} captured → ${outDir}`);
if (failures.length) {
  console.log("Failed:");
  for (const f of failures) console.log(`  - ${f.id}: ${f.error}`);
  process.exitCode = 1;
}
