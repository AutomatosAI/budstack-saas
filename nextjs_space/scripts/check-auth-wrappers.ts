/**
 * check-auth-wrappers CLI (PRD-203 US-002).
 *
 * Scans every `app/api/**\/route.ts`, classifies each exported HTTP handler
 * (see check-auth-wrappers.core.ts), and prints a wrapped / allow-listed /
 * violation report.
 *
 * Exit code is ADVISORY by default (US-002 — the repo still has ~95 unwrapped
 * routes). Pass `--strict` (or AUTH_WRAPPERS_STRICT=true) to exit non-zero on
 * any violation; US-010 wires `--strict` into `pnpm check:auth-wrappers` to make
 * the gate blocking once the rollout (US-006..009) is complete.
 *
 * Run from `nextjs_space/`:  pnpm check:auth-wrappers
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { classifySource, deriveApiPath, type RouteClassification } from "./check-auth-wrappers.core";

function findRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findRouteFiles(full));
    else if (entry.name === "route.ts" || entry.name === "route.tsx") out.push(full);
  }
  return out;
}

function main(): void {
  const strict = process.argv.includes("--strict") || process.env.AUTH_WRAPPERS_STRICT === "true";
  const cwd = process.cwd();
  const apiDir = join(cwd, "app", "api");

  const results: RouteClassification[] = findRouteFiles(apiDir)
    .sort()
    .map((file) => classifySource(deriveApiPath(relative(cwd, file)), readFileSync(file, "utf8")));

  let wrapped = 0;
  let allowListed = 0;
  let violationHandlers = 0;
  const offenders: string[] = [];

  for (const r of results) {
    for (const h of r.handlers) {
      if (h.status === "wrapped") wrapped += 1;
      else if (h.status === "allow-listed") allowListed += 1;
      else violationHandlers += 1;
    }
    if (r.violations.length > 0) {
      offenders.push(`  ${r.apiPath}: ${r.violations.join(", ")}`);
    }
  }

  const totalHandlers = wrapped + allowListed + violationHandlers;
  console.log(`[check:auth-wrappers] scanned ${results.length} route files\n`);

  if (offenders.length > 0) {
    console.log("VIOLATIONS — exported handlers neither wrapped nor allow-listed:");
    console.log(offenders.join("\n"));
    console.log("");
  } else {
    console.log("No violations: every handler is wrapped or allow-listed.\n");
  }

  console.log(
    `Summary: ${results.length} files | ${totalHandlers} handlers | ` +
      `wrapped ${wrapped} | allow-listed ${allowListed} | violations ${violationHandlers}`,
  );

  if (violationHandlers > 0 && !strict) {
    console.log("report-only (advisory) — PRD-203 US-010 wires --strict to make this blocking.");
  }

  process.exit(strict && violationHandlers > 0 ? 1 : 0);
}

main();
