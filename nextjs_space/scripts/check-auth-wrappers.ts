/**
 * check-auth-wrappers CLI (PRD-203 US-002).
 *
 * Scans every `app/api/**\/route.ts`, classifies each exported HTTP handler
 * (see check-auth-wrappers.core.ts), and prints a wrapped / allow-listed /
 * violation report.
 *
 * As of US-010 the rollout (US-006..009) is complete, so `pnpm check:auth-wrappers`
 * runs with `--strict` — any violation exits non-zero (the gate is BLOCKING
 * locally). CI runs it as a non-blocking advisory step; PRD-216 makes CI blocking.
 * Omitting `--strict` (or AUTH_WRAPPERS_STRICT=true) still gives an advisory run.
 *
 * Two fail-closed self-checks (US-010) stop the gate ever passing vacuously: a
 * bare-handler canary that MUST classify as a violation, and a guard that the
 * scan found at least one route file.
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

  // Non-vacuousness self-test (US-010, AC-4b): a known-bare handler MUST be a
  // violation. If the classifier ever regresses to pass everything, this trips
  // first — fail-closed regardless of --strict (a broken gate is never "green").
  const canary = classifySource(
    "/api/__vacuousness_canary__",
    "export async function GET() { return new Response('x'); }",
  );
  if (canary.violations.length !== 1) {
    console.error(
      "✗ check:auth-wrappers is VACUOUS: the bare-handler canary was not flagged — " +
        "the classifier is broken. Refusing to report a passing gate.",
    );
    process.exit(1);
  }

  const results: RouteClassification[] = findRouteFiles(apiDir)
    .sort()
    .map((file) => classifySource(deriveApiPath(relative(cwd, file)), readFileSync(file, "utf8")));

  if (results.length === 0) {
    console.error(
      `✗ check:auth-wrappers scanned 0 route files under ${apiDir} — the gate is ` +
        "misconfigured (wrong cwd or moved api dir). Refusing to pass vacuously.",
    );
    process.exit(1);
  }

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
