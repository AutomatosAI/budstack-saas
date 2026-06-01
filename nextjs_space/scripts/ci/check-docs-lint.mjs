#!/usr/bin/env node
/**
 * PRD-216 AC-7b — ADVISORY docs-lint (regression guard for PRD-214).
 *
 * PRD-214 reconciled the architecture/marketing docs to the running system
 * (Clerk auth, Railway hosting, data-driven templates) and removed claims the
 * platform cannot substantiate. This gate warns if a doc REINTRODUCES one of
 * those retired patterns:
 *   - auth docs:      the `next-auth` library or the legacy `/api/auth/session` route
 *   - domain docs:    `abacus` (the old Abacus.AI control plane)
 *   - marketing docs: the unsubstantiated "HIPAA Ready" / "Lighthouse 90+" /
 *                     "5-minute launch" claims (PRD-214 AC-8 / AC-8a)
 *
 * ADVISORY ONLY: the CI step runs with continue-on-error: true, so this never
 * fails the build (AC-7b). The script still exits non-zero on findings so it is
 * usable as a local check.
 *
 * Low-false-positive by design — this scans PROSE (line-based; markdown has no
 * JS string-literals to blank), so it leans on:
 *   1. EXACT signals: hyphenated `next-auth` (the npm pkg) — NOT camelCase
 *      "NextAuth" prose nor the `NEXTAUTH_SECRET` env var, both of which appear
 *      legitimately in the reconciled docs; specific claim phrases, not bare
 *      "HIPAA"/"5 minutes" (which recur as webhook windows / TTLs).
 *   2. A citation/legacy-marker exemption: a line that documents the retired
 *      thing as gone (stale, legacy, no longer, vestigial, removed, …) or backs
 *      a claim with a citation (URL, footnote, `file:line`, PRD-NNN, "verified")
 *      is NOT flagged — that is the "adjacent citation marker" rule from
 *      PRD-214 §"docs-lint".
 *
 * docs/PRDS/ and any archive/ dir are NOT scanned: the PRDs (incl. this one and
 * PRD-214) quote the banned terms to DEFINE the policy, and archived docs are
 * intentionally-retained point-in-time snapshots.
 *
 * Exits non-zero if any finding (advisory only — see ci.yml step).
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const docsDir = join(repoRoot, "docs");
const extraFiles = [join(repoRoot, "README.md")];

// Banned patterns. `requireOnLine` (optional) narrows a high-frequency word to
// its claim context so incidental uses (e.g. a "5 min" webhook window) do not trip.
const PATTERNS = [
  { label: "next-auth", re: /next-auth/i, hint: "auth is Clerk — remove next-auth" },
  { label: "/api/auth/session", re: /\/api\/auth\/session/, hint: "legacy NextAuth route — auth is Clerk" },
  { label: "abacus", re: /abacus/i, hint: "hosting/DNS is Railway — remove Abacus.AI" },
  { label: "HIPAA Ready", re: /HIPAA[\s-]*Ready/i, hint: "unsubstantiated — needs legal/DPO sign-off or removal" },
  { label: "Lighthouse 90+", re: /Lighthouse\s*90\+?/i, hint: "unsubstantiated perf claim — cite a measurement or remove" },
  {
    label: "5-minute launch claim",
    re: /\b5[\s-]?minutes?\b/i,
    requireOnLine: /launch|live|store|time to launch|total time/i,
    hint: "unsubstantiated launch-time claim — cite or soften",
  },
];

// A line is exempt if it documents the retired thing as gone, or cites a source.
const EXEMPT_ON_LINE =
  /(stale|legacy|no longer|not used|never built|removed|vestigial|deprecated|old doc|superseded|supersedes|https?:\/\/|\[\^|\bPRD-\d|`[^`]*:\d|source:|cited?|verified|measured|NEXTAUTH_SECRET)/i;

function walk(dir) {
  const files = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "archive" || entry === "PRDS") continue;
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) files.push(...walk(full));
    else if (/\.(md|mdx)$/i.test(entry)) files.push(full);
  }
  return files;
}

const targets = [...walk(docsDir), ...extraFiles.filter(existsSync)];
const findings = [];

for (const file of targets) {
  const lines = readFileSync(file, "utf8").split("\n");
  const rel = file.slice(repoRoot.length + 1);
  lines.forEach((line, idx) => {
    if (EXEMPT_ON_LINE.test(line)) return;
    for (const p of PATTERNS) {
      if (!p.re.test(line)) continue;
      if (p.requireOnLine && !p.requireOnLine.test(line)) continue;
      findings.push({ rel, line: idx + 1, label: p.label, hint: p.hint });
    }
  });
}

if (findings.length > 0) {
  console.error(
    `\n⚠ PRD-214 docs-lint (ADVISORY): ${findings.length} retired pattern(s) in docs:\n`,
  );
  for (const f of findings) {
    console.error(`  ${f.rel}:${f.line}  →  ${f.label}  — PRD-214 advisory: ${f.hint}`);
  }
  console.error(
    `\n  Advisory only (never blocks CI). Reconcile per docs/PRDS/REMEDIATION/PRD-214-*.md,`,
  );
  console.error(
    `  or add a citation/legacy marker on the line if the mention is intentional.\n`,
  );
  process.exit(1);
}

console.log("✓ PRD-214 docs-lint (advisory): no retired auth/domain/marketing patterns reintroduced");
