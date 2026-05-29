#!/usr/bin/env node
/**
 * AC-3b gate: no `dangerouslySetInnerHTML` may inject a `*Css`/`*css*`
 * expression that is not wrapped in `sanitizeCss(...)`.
 *
 * Storefront CSS (custom styles, per-section overrides, padding) originates
 * from tenant-controlled layout/defaults data. Injected raw, it allows
 * `</style><script>` breakout. Every CSS sink must pass through
 * `sanitizeCss()` (lib/css-utils.ts).
 *
 * A sink passes when EITHER:
 *   (a) its `__html` expression contains an inline `sanitizeCss(` call, OR
 *   (b) every css-ish identifier it references is pre-sanitized by
 *       convention — a name starting with `sanitized` (a memoised
 *       `sanitizeCss(...)` result) or a SCREAMING_SNAKE compile-time constant.
 *
 * Non-CSS sinks (markdown HTML, hardcoded SVG icons) are out of scope — this
 * gate only inspects expressions that reference a css-ish identifier.
 *
 * Exits non-zero (CI failure) if any violation is found.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { blankNonCode, offsetToLineCol } from "./strip-strings.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..");
const scanRoots = [join(repoRoot, "app"), join(repoRoot, "components")];

const SINK = "dangerouslySetInnerHTML";
const IDENT_RE = /[A-Za-z_$][A-Za-z0-9_$]*/g;
const isCssIdent = (id) => /css/i.test(id);
const isPreSanitized = (id) =>
  /^sanitized/i.test(id) || /^[A-Z][A-Z0-9_]*$/.test(id);

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) files.push(...walk(full));
    else if (/\.(tsx|jsx)$/.test(entry)) files.push(full);
  }
  return files;
}

/**
 * Given blanked source and the index just after a `__html` token, returns the
 * [start, end) span of the value expression (between the `:` and the `}` that
 * closes the inner `{ __html: ... }` object), or null.
 */
function htmlValueSpan(blanked, afterHtml) {
  let i = afterHtml;
  while (i < blanked.length && blanked[i] !== ":") {
    if (blanked[i] === "}" || blanked[i] === "{") return null;
    i++;
  }
  if (blanked[i] !== ":") return null;
  const start = i + 1;
  let depth = 0;
  for (let j = start; j < blanked.length; j++) {
    const c = blanked[j];
    if (c === "{") depth++;
    else if (c === "}") {
      if (depth === 0) return { start, end: j };
      depth--;
    }
  }
  return null;
}

const violations = [];

for (const root of scanRoots) {
  for (const file of walk(root)) {
    const src = readFileSync(file, "utf8");
    const blanked = blankNonCode(src);

    let idx = blanked.indexOf(SINK);
    while (idx !== -1) {
      const htmlIdx = blanked.indexOf("__html", idx);
      if (htmlIdx !== -1) {
        const span = htmlValueSpan(blanked, htmlIdx + "__html".length);
        if (span) {
          const expr = blanked.slice(span.start, span.end);
          const idents = expr.match(IDENT_RE) || [];
          const cssIdents = idents.filter(isCssIdent);
          const hasInlineSanitize = /\bsanitizeCss\s*\(/.test(expr);

          if (cssIdents.length > 0 && !hasInlineSanitize) {
            const unsafe = cssIdents.filter(
              (id) => id !== "sanitizeCss" && !isPreSanitized(id),
            );
            if (unsafe.length > 0) {
              const { line, col } = offsetToLineCol(src, span.start);
              const rel = file.slice(repoRoot.length + 1);
              violations.push({
                rel,
                line,
                col,
                expr: src.slice(span.start, span.end).trim().replace(/\s+/g, " "),
                unsafe,
              });
            }
          }
        }
      }
      idx = blanked.indexOf(SINK, idx + SINK.length);
    }
  }
}

if (violations.length > 0) {
  console.error(
    `\n✗ AC-3b FAILED: ${violations.length} unsanitised CSS injection sink(s):\n`,
  );
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.line}:${v.col}`);
    console.error(`      __html: ${v.expr}`);
    console.error(`      unsanitised css var(s): ${v.unsafe.join(", ")}`);
  }
  console.error(
    `\n  Fix: wrap the value in sanitizeCss(...) from "@/lib/css-utils".\n`,
  );
  process.exit(1);
}

console.log("✓ AC-3b: all CSS dangerouslySetInnerHTML sinks are sanitised");
