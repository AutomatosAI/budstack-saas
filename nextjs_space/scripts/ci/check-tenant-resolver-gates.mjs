#!/usr/bin/env node
/**
 * PRD-205 US-008 — local tenant-resolver invariants (AC-1a + AC-2b + §7 metrics).
 *
 * Mirrors the CI gate PRD-216 will formalise; run it locally before pushing.
 * Two assertions:
 *
 *   GATE 1 (AC-1a / §7): lib/tenant-resolver.ts performs RESOLUTION only and must
 *   never bind the AsyncLocalStorage — zero `setTenantContext(` / `enterWith(`.
 *   Binding stays at the request boundary (PRD-202's runWithTenantContext).
 *
 *   GATE 2 (AC-2b / §7): every host-identity tenant lookup goes through the
 *   canonical resolver — zero `prisma.tenants.findFirst({ where: { subdomain | customDomain … } })`
 *   OUTSIDE lib/tenant-resolver.ts. `findFirst` is the exact pattern AC-2b and §7
 *   name: a "scan for the first matching row" on a host field, which is the
 *   duplicate-resolver smell the canonical path replaces (it also enforces
 *   isActive + the lower-case retry). Call sites that are genuinely NOT request
 *   resolution (super-admin domain-uniqueness checks, admin clone-by-subdomain —
 *   they must match inactive tenants, which the isActive-enforcing resolver can't
 *   express) carry an inline `tenant-gate:allow(<reason>)` comment above the call.
 *
 * Deliberately OUT of this grep gate's scope:
 *   - `findUnique({ where: { subdomain } })` — a by-unique-constraint point lookup
 *     (`subdomain`/`customDomain` are @unique), not the findFirst scan AC-2b targets.
 *   - The "no inactive tenant resolves anywhere" guarantee (AC-1b) — proven by the
 *     real-DB integration tests (US-009) and the cross-tenant E2E (US-011), not by
 *     a static grep.
 *
 * The `where` clause is isolated before testing for the host keys, so a lookup
 * keyed on `id` that merely *selects* the `subdomain`/`customDomain` columns does
 * not trip the gate. String/comment text is blanked first (shared strip-strings
 * helper) so tokens inside literals don't match. Exits non-zero on any unexplained
 * violation.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { blankNonCode, offsetToLineCol, matchParen } from "./strip-strings.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", ".."); // -> nextjs_space
const RESOLVER_REL = "lib/tenant-resolver.ts";
const RESOLVER_ABS = join(appRoot, RESOLVER_REL);
const SCAN_DIRS = ["lib", "app"].map((d) => join(appRoot, d));
const PRAGMA = "tenant-gate:allow";

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

// Walks from the index of an opening `{` to its matching `}` in string-blanked
// code. Returns the index of the matching `}`, or -1.
function matchBrace(blanked, openIdx) {
  let depth = 0;
  for (let i = openIdx; i < blanked.length; i++) {
    const c = blanked[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

let failed = false;

// ---- GATE 1 (AC-1a): no ALS mutation inside the canonical resolver -----------
{
  const src = readFileSync(RESOLVER_ABS, "utf8");
  const blanked = blankNonCode(src);
  const ALS_RE = /\b(setTenantContext|enterWith)\s*\(/g;
  const hits = [];
  let m;
  while ((m = ALS_RE.exec(blanked)) !== null) {
    const { line, col } = offsetToLineCol(src, m.index);
    hits.push({ line, col, token: m[1] });
  }
  if (hits.length > 0) {
    failed = true;
    console.error(`\n✗ [AC-1a] ${RESOLVER_REL} must never bind the ALS — found ${hits.length} call(s):`);
    for (const h of hits) console.error(`    ${RESOLVER_REL}:${h.line}:${h.col}  →  ${h.token}(`);
    console.error("  Fix: resolution RETURNS { tenantId, tenant }; binding is PRD-202's runWithTenantContext.");
  } else {
    console.log(`✓ [AC-1a] no setTenantContext/enterWith in ${RESOLVER_REL}`);
  }
}

// ---- GATE 2 (AC-2b): no off-resolver findFirst on subdomain/customDomain -----
{
  const FINDER_RE = /prisma\s*\.\s*tenants\s*\.\s*findFirst\s*\(/g;
  const WHERE_RE = /\bwhere\s*:\s*\{/g;
  const KEY_RE = /\b(subdomain|customDomain)\b/;
  const violations = [];

  const files = SCAN_DIRS.flatMap(walk).filter((f) => f !== RESOLVER_ABS);

  for (const file of files) {
    const src = readFileSync(file, "utf8");
    const blanked = blankNonCode(src);
    const rawLines = src.split("\n");

    FINDER_RE.lastIndex = 0;
    let m;
    while ((m = FINDER_RE.exec(blanked)) !== null) {
      const openParen = m.index + m[0].length - 1;
      const closeParen = matchParen(blanked, openParen);
      if (closeParen === -1) continue;
      const argBlanked = blanked.slice(openParen + 1, closeParen);

      // Isolate the where-object(s) so a `select: { subdomain }` on an id-keyed
      // lookup can't trip the gate — only a host key in `where` counts.
      let keyedOnHost = false;
      WHERE_RE.lastIndex = 0;
      let w;
      while ((w = WHERE_RE.exec(argBlanked)) !== null) {
        const braceOpen = w.index + w[0].length - 1;
        const braceClose = matchBrace(argBlanked, braceOpen);
        if (braceClose === -1) continue;
        if (KEY_RE.test(argBlanked.slice(braceOpen, braceClose + 1))) {
          keyedOnHost = true;
          break;
        }
      }
      if (!keyedOnHost) continue;

      const { line } = offsetToLineCol(src, m.index);
      const closeLine = offsetToLineCol(src, closeParen).line;
      // Exemption pragma lives in a comment (blanked out of `blanked`), so check the
      // RAW source from 6 lines above the finder through the call's closing line.
      const from = Math.max(0, line - 1 - 6);
      const windowRaw = rawLines.slice(from, closeLine).join("\n");
      if (windowRaw.includes(PRAGMA)) continue;

      violations.push({ rel: relative(appRoot, file), line });
    }
  }

  if (violations.length > 0) {
    failed = true;
    console.error(`\n✗ [AC-2b] ${violations.length} off-resolver findFirst on subdomain/customDomain:`);
    for (const v of violations) {
      console.error(`    ${v.rel}:${v.line}  →  prisma.tenants.findFirst({ where: { subdomain|customDomain … } })`);
    }
    console.error("  Fix: resolve via resolveTenant({ kind: 'slug'|'host'|'headers' }) from \"@/lib/tenant-resolver\".");
    console.error("  Or, if this is genuinely NOT request resolution (e.g. an admin uniqueness check), add a");
    console.error("  // tenant-gate:allow(<reason>) comment directly above the call explaining why.");
  } else {
    console.log("✓ [AC-2b] every off-resolver findFirst on subdomain/customDomain is removed or exempted");
  }
}

if (failed) {
  console.error("\nPRD-205 tenant-resolver gates FAILED.\n");
  process.exit(1);
}
console.log("\n✓ PRD-205 tenant-resolver gates passed (AC-1a + AC-2b).");
