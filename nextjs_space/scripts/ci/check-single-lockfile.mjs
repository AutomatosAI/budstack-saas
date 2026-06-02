#!/usr/bin/env node
/**
 * PRD-209 AC-7: single-lockfile guard.
 *
 * The app standardises on pnpm (`pnpm-lock.yaml` + a `packageManager` field in
 * package.json). A second lockfile from a different package manager —
 * `yarn.lock` or `package-lock.json` — means a contributor installed with the
 * wrong tool, which silently diverges the dependency graph CI resolves from.
 *
 * This gate fails the build if any foreign lockfile appears next to
 * `pnpm-lock.yaml`, so the drift is caught at PR time rather than in prod.
 *
 * Exits non-zero (CI failure) if a violation is found.
 */
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..", "..");

const REQUIRED = "pnpm-lock.yaml";
const FORBIDDEN = ["yarn.lock", "package-lock.json", "npm-shrinkwrap.json"];

const errors = [];

if (!existsSync(join(appRoot, REQUIRED))) {
  errors.push(
    `Missing ${REQUIRED}. The app is pinned to pnpm — run \`pnpm install\` and commit the lockfile.`,
  );
}

for (const name of FORBIDDEN) {
  if (existsSync(join(appRoot, name))) {
    errors.push(
      `Found ${name} alongside ${REQUIRED}. Delete it and reinstall with pnpm — only one lockfile may be committed.`,
    );
  }
}

if (errors.length > 0) {
  console.error("✗ Lockfile guard (PRD-209 AC-7) failed:");
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`✓ Lockfile guard: ${REQUIRED} present, no foreign lockfile.`);
