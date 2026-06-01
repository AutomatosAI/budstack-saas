#!/usr/bin/env node
/**
 * PRD-216 AC-7a (PRD-215/213 regression guard): flag PII field names that
 * reach a raw `console.*` / `logger.*` call argument.
 *
 * PRD-215/213 routes user PII through `lib/redact.ts` before it is ever
 * logged. Interpolating a raw PII identifier (email, firstName, phone,
 * address, drGreenResponse, …) into a log call re-introduces the exact leak
 * those PRDs close — plaintext PII in application logs.
 *
 * Detection mirrors check-no-error-message-leaks.mjs: blank string/comment
 * content first (strip-strings.mjs), find each console/logger call, walk to
 * its matching `)`, and scan ONLY the argument span for a banned identifier.
 * Because blankNonCode() preserves `${...}` interpolation code but blanks
 * plain string text, a PII word INSIDE a template interpolation or as a bare
 * argument identifier trips the gate, while the same word inside a quoted
 * string literal does not. The scripts/ci/ directory is not scanned, so this
 * file's own pattern literals cannot self-trip.
 *
 * NOTE: until PRD-215 lands, the live tree still logs these identifiers. This
 * gate is therefore wired REPORT-ONLY (continue-on-error) in ci.yml; it flips
 * to blocking once PRD-215's redaction merges.
 *
 * Exits non-zero (CI failure) if any occurrence is found.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { blankNonCode, offsetToLineCol, matchParen } from "./strip-strings.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");
const scanDirs = ["app", "lib", "components"].map((d) => join(appRoot, d));
const scanFiles = [join(appRoot, "middleware.ts")];

// A console.(log|error|warn|info|debug)( or logger.<level>( call as a token
// (any receiver, e.g. `this.logger.info(`), but not `myConsole.log(`.
const CALL_RE =
  /(?<![A-Za-z0-9_$])(?:console\s*\.\s*(?:log|error|warn|info|debug)|logger\s*\.\s*[A-Za-z]+)\s*\(/g;

// Banned PII identifiers per PRD-216 AC-7. Token-boundaried + case-sensitive
// to keep false-positives low: matches `email` / `body.email` / `clerkUser.email`
// (the `email` token after a dot) but not `emailSent` or `ipAddress`.
const PII_RE =
  /(?<![A-Za-z0-9_$])(email|firstName|phone|address|drGreenResponse)(?![A-Za-z0-9_$])/g;

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

  CALL_RE.lastIndex = 0;
  let m;
  while ((m = CALL_RE.exec(blanked)) !== null) {
    const openParen = m.index + m[0].length - 1;
    const closeParen = matchParen(blanked, openParen);
    if (closeParen === -1) continue;

    const argSpan = blanked.slice(openParen + 1, closeParen);
    PII_RE.lastIndex = 0;
    let pii;
    while ((pii = PII_RE.exec(argSpan)) !== null) {
      const absOffset = openParen + 1 + pii.index;
      const { line, col } = offsetToLineCol(src, absOffset);
      const rel = file.slice(appRoot.length + 1);
      violations.push({ rel, line, col, token: pii[1] });
    }
    // Advance past this call so overlapping CALL_RE matches don't double-count.
    CALL_RE.lastIndex = closeParen + 1;
  }
}

if (violations.length > 0) {
  console.error(
    `\n✗ PRD-215 gate FAILED: ${violations.length} PII identifier(s) in console/logger calls:\n`,
  );
  for (const v of violations) {
    console.error(
      `  ${v.rel}:${v.line}:${v.col}  →  ${v.token} in console/logger call  — PRD-215/213: redact PII before logging (use lib/redact.ts)`,
    );
  }
  console.error(
    `\n  Fix: pass PII through redact() from "@/lib/redact" before logging, or log a non-PII id instead.`,
  );
  console.error(
    `  Rule: docs/PRDS/REMEDIATION/PRD-215-*.md / PRD-213; enforced by PRD-216 AC-7.\n`,
  );
  process.exit(1);
}

console.log("✓ PRD-215 gate: no PII identifiers in console/logger calls in app/lib/components/middleware");
