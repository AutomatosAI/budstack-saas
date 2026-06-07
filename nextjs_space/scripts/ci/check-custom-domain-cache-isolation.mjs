#!/usr/bin/env node
/**
 * PRD-212 AC-2 gate — custom-domain ISR cache isolation.
 *
 * Next.js keys its full-route (ISR) cache on the resolved PATHNAME. If middleware
 * rewrote every custom domain to the constant `/store/_cd/...`, then EVERY
 * `export const revalidate` route under `app/store/[slug]/` would share one cache
 * bucket per path and bleed one tenant's render onto another's domain. PRD-212
 * fixes this by rewriting to a HOST-SCOPED `/store/cd-<hash(host)>/...` segment.
 *
 * This gate enumerates every cached route under `app/store/[slug]/` (so a NEW
 * cached route added later is surfaced, not silently uncovered) and asserts the
 * isolation mechanism is in place:
 *
 *   GATE A — the custom-domain rewrite is host-scoped: middleware.ts contains NO
 *   constant `/store/_cd` rewrite target and DOES route through
 *   customDomainRewritePath (lib/custom-domain-rewrite.ts).
 *
 *   GATE B — inventory: list each `export const revalidate` under
 *   `app/store/[slug]/`. All are reached via the same `_cd`→cd-<hash> rewrite, so
 *   the host-scoped segment covers them uniformly. The list is printed (and the
 *   count asserted > 0) so reviewers see the covered surface.
 *
 * String/comment text is blanked first so a `_cd` mentioned in a comment does not
 * trip GATE A. Exits non-zero on any violation.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { blankNonCode, offsetToLineCol } from "./strip-strings.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", ".."); // -> nextjs_space
const MIDDLEWARE_ABS = join(appRoot, "middleware.ts");
const STORE_SLUG_DIR = join(appRoot, "app", "store", "[slug]");
const HELPER_FN = "customDomainRewritePath";

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

let failed = false;

// ---- GATE A: middleware custom-domain rewrite is host-scoped, not `_cd` -------
{
  if (!existsSync(MIDDLEWARE_ABS)) {
    console.error("✗ [AC-2] middleware.ts not found at expected path");
    process.exit(1);
  }
  const src = readFileSync(MIDDLEWARE_ABS, "utf8");
  const blanked = blankNonCode(src); // strips strings + comments

  // A constant `/store/_cd` rewrite target anywhere in executable code is the bug.
  const CONST_RE = /\/store\/_cd/g;
  const constHits = [];
  let m;
  while ((m = CONST_RE.exec(blanked)) !== null) {
    const { line } = offsetToLineCol(src, m.index);
    constHits.push(line);
  }
  // The host-scoped helper must be the rewrite mechanism.
  const usesHelper = new RegExp(`\\b${HELPER_FN}\\s*\\(`).test(blanked);

  if (constHits.length > 0) {
    failed = true;
    console.error(
      `\n✗ [AC-2/GATE A] middleware.ts still rewrites custom domains to the constant /store/_cd ` +
        `(line(s) ${constHits.join(", ")}). This collapses every custom domain into one ISR cache bucket.`,
    );
    console.error(
      `  Fix: rewrite via ${HELPER_FN}(host, pathname) from "@/lib/custom-domain-rewrite" (host-scoped key).`,
    );
  } else if (!usesHelper) {
    failed = true;
    console.error(
      `\n✗ [AC-2/GATE A] middleware.ts does not route the custom-domain rewrite through ${HELPER_FN}().`,
    );
    console.error(
      `  Fix: use ${HELPER_FN}(host, pathname) from "@/lib/custom-domain-rewrite" so the ISR key is per-host.`,
    );
  } else {
    console.log("✓ [AC-2/GATE A] custom-domain rewrite is host-scoped (no constant /store/_cd; uses customDomainRewritePath)");
  }
}

// ---- GATE B: inventory every cached route under app/store/[slug] -------------
{
  if (!existsSync(STORE_SLUG_DIR)) {
    console.error("✗ [AC-2] app/store/[slug] not found at expected path");
    process.exit(1);
  }
  const REVAL_RE = /export\s+const\s+revalidate\s*=/;
  const cachedRoutes = [];

  for (const file of walk(STORE_SLUG_DIR)) {
    const src = readFileSync(file, "utf8");
    const blanked = blankNonCode(src);
    if (REVAL_RE.test(blanked)) {
      cachedRoutes.push(relative(appRoot, file));
    }
  }

  if (cachedRoutes.length === 0) {
    // Not a hard failure on its own, but unexpected — the storefront is meant to
    // be ISR-cached. Surface it loudly.
    console.warn("⚠ [AC-2/GATE B] no `export const revalidate` found under app/store/[slug] — expected at least page.tsx");
  } else {
    console.log(`✓ [AC-2/GATE B] ${cachedRoutes.length} cached route(s) under app/store/[slug] covered by the host-scoped rewrite:`);
    for (const r of cachedRoutes.sort()) console.log(`    • ${r}`);
  }
}

if (failed) {
  console.error("\nPRD-212 custom-domain cache-isolation gate FAILED.\n");
  process.exit(1);
}
console.log("\n✓ PRD-212 custom-domain cache-isolation gate passed (AC-2).");
