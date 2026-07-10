import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * PRD-220 — every relative import in scripts/ must resolve to a real file.
 *
 * scripts/ is OUTSIDE the Next.js build's type-check graph, so a lib/ module
 * moving (e.g. lib/encryption → lib/security/encryption in the PRD-209
 * reorg) breaks these scripts silently: nothing fails until the script runs.
 * That is exactly how the email-worker sidecar crash-looped in production on
 * 2026-07-10 — `import { decrypt } from '../lib/encryption'` had pointed at
 * a long-moved module, unnoticed because nothing had ever run the worker.
 *
 * This walks every scripts/**\/*.ts (excluding _archive/) and asserts each
 * relative `from "..."` specifier resolves with the extensions ts/tsx/js/
 * mjs or an index.ts. No module is imported — pure filesystem checks, no
 * side effects.
 */

const ROOT = process.cwd(); // vitest runs from nextjs_space/
const SCRIPTS_DIR = join(ROOT, "scripts");
const RESOLVABLE_SUFFIXES = [".ts", ".tsx", ".js", ".mjs", "/index.ts"];

function walkScripts(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry === "_archive") return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walkScripts(full);
    return entry.endsWith(".ts") ? [full] : [];
  });
}

function relativeSpecifiers(file: string): string[] {
  const source = readFileSync(file, "utf8");
  return [...source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map((m) => m[1]);
}

describe("scripts/ relative imports resolve (PRD-220 crash-loop regression)", () => {
  const files = walkScripts(SCRIPTS_DIR);

  it("finds script files to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [f.slice(ROOT.length + 1)] as const))(
    "%s",
    (relFile) => {
      const file = join(ROOT, relFile);
      const broken = relativeSpecifiers(file).filter((spec) => {
        const base = normalize(join(dirname(file), spec));
        return !RESOLVABLE_SUFFIXES.some((suffix) => existsSync(base + suffix));
      });
      expect(broken, `unresolvable imports in ${relFile}`).toEqual([]);
    },
  );
});
