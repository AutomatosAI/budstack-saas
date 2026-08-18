#!/usr/bin/env node
/**
 * Article-typography guard: no `prose-*` classes while the plugin is absent.
 *
 * `@tailwindcss/typography` is NOT installed — tailwind.config.ts loads only
 * `tailwindcss-animate`. Every `prose`, `prose-*` and `not-prose` class in this
 * app is therefore INERT: Tailwind's preflight strips heading sizes, paragraph
 * margins and list markers, and with no typography plugin nothing puts them
 * back. Long-form pages carrying those classes render as unstyled flow.
 *
 * That went unnoticed for a long time because the classes LOOK like they work.
 * Eight surfaces shipped that way, including tenant blog posts on live
 * storefronts and the TipTap editor, where authors wrote posts with no visible
 * formatting at all.
 *
 * Use instead:
 *   .bs-article      — BudStacks-branded long-form (app/globals.css).
 *                      budstacks.io, /learn, /documents, the legal pages, and
 *                      the admin TipTap editor.
 *   .tenant-article  — storefront long-form (components/tenant-theme-provider.tsx,
 *                      inside TENANT_SCOPED_CSS). Takes its colours from the
 *                      tenant-remapped shadcn tokens, so an operator's blog
 *                      renders in THEIR brand rather than ours.
 *
 * IF THE PLUGIN IS EVER INTENTIONALLY INSTALLED, this file is the one place to
 * delete — remove it, its package.json script, and its ci.yml step.
 *
 * Exits non-zero (CI failure) if a violation is found.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");

/** Only source that renders markup. Config and lockfiles are irrelevant here. */
const SCAN_DIRS = ["app", "components", "lib"];
const SCAN_EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".css"];
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", "coverage"]);

/**
 * `prose` as a CLASS token, not the English word. Matches `prose`, `prose-lg`,
 * `not-prose` and variant-prefixed forms (`sm:prose`, `hover:prose-a:underline`).
 *
 * Anchored on a class-token boundary to the left — whitespace, quote or
 * backtick — so "prose" inside a sentence cannot match, while
 * `class="a prose-lg b"` does. Comments are stripped before this runs, which is
 * the real defence against prose-the-English-word.
 *
 * ONE quantified class for the tail, deliberately. The previous form ended
 * `prose(?:-[a-z0-9-]+)*`, which nests a `+` inside a `*` over a character class
 * that itself contains `-`. That makes `prose-` followed by many dashes
 * ambiguous to split, and the failing right-boundary lookahead then walks every
 * split — exponential backtracking (CodeQL js/redos, flagged on PR #258;
 * measured at 7ms for 28 dashes and rising sharply). A single `[a-z0-9:-]*` has
 * exactly one way to match any input, so the same lookahead can only unwind it
 * one character at a time: linear, measured flat at 0ms out to 60 dashes.
 *
 * The right boundary is KEPT — dropping it was the first attempt and it
 * regressed "a paragraph of prose," into a match.
 */
const VIOLATION = /(?:^|[\s"'`])(?:[a-z-]+:)*(?:not-)?prose[a-z0-9:-]*(?=[\s"'`]|$)/;

/**
 * Strip comments before testing, rather than testing only `className=` lines.
 *
 * Two reasons this needs real state tracking instead of a per-line heuristic:
 *
 *  1. A multi-line className — `className={cn(\n  "prose prose-lg",\n)}` — puts
 *     the classes on a line with no `class=` on it. A per-line attribute test
 *     misses exactly the formatting Prettier produces on long class lists.
 *  2. This codebase writes block comments WITHOUT leading asterisks on
 *     continuation lines, so "skip lines starting with *" does not identify
 *     them. The explanatory comments that document this very ban would be
 *     reported as violations of it.
 *
 * Comment markers inside a template literal (the CSS in
 * components/tenant-theme-provider.tsx) are treated as comments too, which is
 * correct — they are CSS comments.
 */
function stripComments(source) {
  const out = [];
  let inBlock = false;

  for (const line of source.split("\n")) {
    let cleaned = "";
    let i = 0;

    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf("*/", i);
        if (end === -1) {
          i = line.length;
        } else {
          inBlock = false;
          i = end + 2;
        }
        continue;
      }
      if (line.startsWith("/*", i)) {
        inBlock = true;
        i += 2;
        continue;
      }
      if (line.startsWith("//", i)) break; // rest of the line is a comment
      cleaned += line[i];
      i += 1;
    }

    out.push(cleaned);
  }

  return out;
}

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else if (SCAN_EXTENSIONS.some((ext) => entry.endsWith(ext))) {
      yield full;
    }
  }
}

const violations = [];

for (const dir of SCAN_DIRS) {
  for (const file of walk(join(appRoot, dir))) {
    const rel = relative(appRoot, file);
    const raw = readFileSync(file, "utf8");

    stripComments(raw).forEach((cleaned, i) => {
      if (!VIOLATION.test(cleaned)) return;
      violations.push({ file: rel, line: i + 1, text: cleaned.trim() });
    });
  }
}

if (violations.length > 0) {
  console.error(
    "✗ Article-typography guard failed — `prose-*` classes do nothing in this app.",
  );
  console.error(
    "  @tailwindcss/typography is not installed, so these style NOTHING.",
  );
  console.error("  Use .bs-article (platform) or .tenant-article (storefront).\n");
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`);
    console.error(`    ${v.text.slice(0, 160)}`);
  }
  process.exit(1);
}

console.log(
  "✓ Article-typography guard: no inert prose-* classes in app/, components/, lib/.",
);
