#!/usr/bin/env node
/**
 * AC-5a gate: zero occurrences of `error.message` / `err.message` inside a
 * `NextResponse.json(...)` / `Response.json(...)` argument across `app/api/**`.
 *
 * Raw exception messages must never reach a client response body — they leak
 * stack traces, file paths, SQL, and secrets. Handlers must route errors
 * through `apiError()` (lib/api-error.ts), which logs server-side with a
 * correlation id and returns a redacted envelope.
 *
 * The scan blanks string/comment content first, so `error.message` mentioned
 * inside a string literal (e.g. a static message) does not trip the gate —
 * only real code references inside a response-call argument do.
 *
 * Exits non-zero (CI failure) if any violation is found.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { blankNonCode, offsetToLineCol, matchParen } from "./strip-strings.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(here, "..", "..", "app", "api");

const CALL_RE = /(?:Next)?Response\s*\.\s*json\s*\(/g;
const LEAK_RE = /(?<![A-Za-z0-9_$])(?:error|err)\s*\.\s*message\b/g;

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) files.push(full);
  }
  return files;
}

const violations = [];

for (const file of walk(apiRoot)) {
  const src = readFileSync(file, "utf8");
  const blanked = blankNonCode(src);

  CALL_RE.lastIndex = 0;
  let m;
  while ((m = CALL_RE.exec(blanked)) !== null) {
    const openParen = m.index + m[0].length - 1;
    const closeParen = matchParen(blanked, openParen);
    if (closeParen === -1) continue;

    const argSpan = blanked.slice(openParen + 1, closeParen);
    LEAK_RE.lastIndex = 0;
    let leak;
    while ((leak = LEAK_RE.exec(argSpan)) !== null) {
      const absOffset = openParen + 1 + leak.index;
      const { line, col } = offsetToLineCol(src, absOffset);
      const rel = file.slice(file.indexOf("/app/api/") + 1);
      violations.push({ rel, line, col, token: leak[0].replace(/\s+/g, "") });
    }
  }
}

if (violations.length > 0) {
  console.error(
    `\n✗ AC-5a FAILED: ${violations.length} raw error message(s) leaked into response bodies:\n`,
  );
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.line}:${v.col}  →  ${v.token} inside Response.json(...)`);
  }
  console.error(
    `\n  Fix: route the error through apiError(error, { safeMessage }) from "@/lib/api-error".\n`,
  );
  process.exit(1);
}

console.log("✓ AC-5a: no error.message/err.message in app/api Response.json bodies");
