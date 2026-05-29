# PRD-216 CI/CD Security Gates — Implementation Plan

Single source of truth for Ralph progress. Flip `- [ ]` → `- [x]` ONLY on real success
(never for a BLOCKED marker). Stories execute in priority order.

Branch: `ralph/prd-216-ci-cd-security-gates` (worktree at
`/Users/gkavanagh/Development/HealingBuds/budstack-saas-prd-216`). App in `nextjs_space/` (pnpm).
Source PRD: `docs/PRDS/REMEDIATION/PRD-216-ci-cd-security-gates.md`.

## Grounded reality (verified on this branch off main)
- PRD-200 grep gates already exist + PASS (`nextjs_space/scripts/ci/*.mjs`) but are NOT wired into `ci.yml`.
- PRD-202 NOT merged: `lib/tenant.ts` still has 12 `setTenantContext(` + 3 `enterWith(`.
- PRD-215 NOT merged: ~42 console/logger lines still reference PII field names.
- PRD-207 NOT merged: no `test`/`test:cov` script, no vitest config.
→ Gates whose source cleanup hasn't landed are wired REPORT-ONLY / non-blocking until then.

## Stories

- [x] US-001 — PRD-202 grep gate script (no `enterWith(`/`setTenantContext(`)
- [x] US-002 — PRD-215 PII-in-logs grep gate script
- [x] US-003 — Unified runner + wire grep gates into `ci.yml` (PRD-200 blocking; 202/215 report-only)
- [x] US-004 — Advisory docs-lint (PRD-214), non-blocking `ci.yml` step
- [x] US-005 — Dependabot config (`.github/dependabot.yml`)
- [ ] US-006 — CodeQL workflow (`.github/workflows/codeql.yml`)
- [ ] US-007 — Secret-scan workflow (gitleaks) + `.gitleaks.toml` allow-list
- [ ] US-008 — SBOM generation workflow (CycloneDX JSON) + artifact upload
- [ ] US-009 — Flip `eslint.ignoreDuringBuilds:false` in `next.config.js` (conditional BLOCK on lint backlog)
- [ ] US-010 — Non-blocking test-gate job in `ci.yml` (wires PRD-207 when it lands) → last story, emit RALPH_COMPLETE

## Notes
- US-003 depends on US-001 + US-002. US-010 is the final story.
- Only US-009 has a conditional BLOCK path (revert flag + record OQ-2 if lint backlog blocks the build).
- All other stories are authorable autonomously (config + scripts; live runs verified on GitHub post-merge).
