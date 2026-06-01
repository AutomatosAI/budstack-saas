#!/usr/bin/env node
/**
 * PRD-216 AC-7 (PRD-202 regression guard): zero `enterWith(` and zero
 * `setTenantContext(` anywhere in app/lib/components/middleware.
 *
 * PRD-202 replaces request-scoped tenant context that leaked across requests
 * (`AsyncLocalStorage.enterWith()` and the bare `setTenantContext()` helper)
 * with `runWithTenantContext()` / `withTenantContext()`, which scope the
 * context to a single async callback and cannot bleed between tenants.
 * Re-introducing either call risks cross-tenant data exposure.
 *
 * The scan blanks string/comment content first (via strip-strings.mjs), so a
 * token mentioned inside a string literal or comment does not trip the gate —
 * only real code call-sites do. The scripts/ci/ directory is NOT scanned, so
 * this file's own pattern literals cannot self-trip.
 *
 * NOTE: until PRD-202 lands, the live tree still contains these calls
 * (lib/tenant.ts). This gate is therefore wired REPORT-ONLY in ci.yml; it
 * flips to blocking once PRD-202 removes them.
 *
 * Exits non-zero (CI failure) if any occurrence is found.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { blankNonCode, offsetToLineCol } from "./strip-strings.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");
const scanDirs = ["app", "lib", "components"].map((d) => join(appRoot, d));
const scanFiles = [join(appRoot, "middleware.ts")];

// Match `enterWith(` / `setTenantContext(` as a token (any receiver, e.g.
// `als.enterWith(`), but not a longer identifier like `setTenantContextFoo(`.
const BANNED_RE =
  /(?<![A-Za-z0-9_$])(enterWith|setTenantContext)(?![A-Za-z0-9_$])\s*\(/g;

function walk(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === "dist") continue;
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) files.push(full);
  }
  return files;
}

const targets = [...scanDirs.flatMap(walk), ...scanFiles.filter(existsSync)];
const violations = [];

for (const file of targets) {
  const src = readFileSync(file, "utf8");
  const blanked = blankNonCode(src);

  BANNED_RE.lastIndex = 0;
  let m;
  while ((m = BANNED_RE.exec(blanked)) !== null) {
    const { line, col } = offsetToLineCol(src, m.index);
    const rel = file.slice(appRoot.length + 1);
    violations.push({ rel, line, col, token: `${m[1]}(` });
  }
}

if (violations.length > 0) {
  console.error(
    `\n✗ PRD-202 gate FAILED: ${violations.length} tenant-context escape(s):\n`,
  );
  for (const v of violations) {
    console.error(
      `  ${v.rel}:${v.line}:${v.col}  →  ${v.token}  — PRD-202: set tenant context only via runWithTenantContext()/withTenantContext()`,
    );
  }
  console.error(
    `\n  Fix: replace enterWith()/setTenantContext() with the callback-scoped runWithTenantContext() from "@/lib/tenant-context".`,
  );
  console.error(
    `  Rule: docs/PRDS/REMEDIATION/PRD-202-*.md (AC-7); enforced by PRD-216 AC-7.\n`,
  );
  process.exit(1);
}

console.log("✓ PRD-202 gate: no enterWith()/setTenantContext() in app/lib/components/middleware");
