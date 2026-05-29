#!/usr/bin/env bash
#
# PRD-216 US-003 — repo-root runner for the BLOCKING security grep gates.
#
# Runs the PRD-200 string-aware gates (CSS sanitization + error-message-leak)
# that already PASS on this tree, so they can gate the build immediately.
# Exits non-zero if any gate fails. Usable locally (`bash scripts/ci/grep-gates.sh`)
# and from CI; resolves the repo root from its own location so cwd does not matter.
#
# NOT run here: the PRD-202 (tenant-context) and PRD-215 (PII-in-logs) gates.
# Their source cleanups are unmerged, so they still flag pre-existing debt and
# would red the build. Those run REPORT-ONLY via `pnpm check:grep-gates:report`
# (wired continue-on-error in ci.yml). When PRD-202 / PRD-215 land and their
# gates go green, move them into this blocking runner.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "▶ PRD-200 security grep gates (blocking)…"
pnpm --dir "${REPO_ROOT}/nextjs_space" check:security
echo "✓ PRD-200 security grep gates passed."
