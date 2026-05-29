# PRD-215 — Enterprise Operational Readiness (structured logger + PII/PHI redaction, status page, runbooks, SLO, alerting)

> **Status:** Proposed
> **Phase:** R5 — Customer Readiness
> **Severity:** HIGH _(headline driver elevated by the verification pass: **special-category PHI/PII is written to plaintext logs** on a medical-cannabis platform — emails + KYC status + full Dr Green responses sit outside the DB encryption perimeter. The operational gaps (no status page, runbooks, SLO, alerting) are the rest of the enterprise-readiness bar.)_
> **Module(s) touched:** new `lib/logger.ts` (+ `lib/redact.ts` reuse), `app/actions/kyc-check.ts`, `app/api/consultation/submit/route.ts`, `app/tenant-admin/layout.tsx`, `lib/api-error.ts`, `lib/rate-limit.ts`, `app/api/health/route.ts`, `package.json` (`optionalDependencies`), and ~199 files carrying `console.*`; new `docs/runbooks/`, `docs/SLO.md`, `docs/STATUS_PAGE.md`
> **Depends on:** PRD-214 (runbooks need a current architecture doc) — **strict for the runbook section**. Soft on PRD-203 (auth wrapper surface for log correlation) and PRD-211 (this PRD supplies the alerting channel its rate-limit/webhook fixes need).
> **Blocks:** First paying enterprise customer + the operational sections of a security questionnaire (logging, monitoring, incident response, DR).
> **Owner:** Gerard + Claude. Ops/compliance sign-off: Gerard + DPO advisor.
> **Last updated:** 2026-05-29

---

## 1. Problem

BudStacks has no operational-readiness layer, and the most acute symptom is a data-protection one.

1. **PHI/PII written to plaintext logs (HIGH — headline).** On a medical-cannabis platform, customer email + KYC status + consultation/Dr Green payloads are **special-category data** (GDPR Art. 9 health data). They are currently `console.log`-ed in cleartext, landing in Railway's log store — **outside the database encryption perimeter** and outside `lib/redact.ts`. Verified live lines:
   - `app/actions/kyc-check.ts:122` — `console.log(`[KYC] ${clerkUser.email}: isActive=… isKYCVerified=… adminApproval=… → verified=…`)` — email + KYC verification state.
   - `app/api/consultation/submit/route.ts:153` — logs the customer email ("User `${body.email}` already exists in Clerk").
   - `app/api/consultation/submit/route.ts:208` — logs the customer email ("Created local user mirror for `${body.email}`").
   - `app/api/consultation/submit/route.ts:426-427` — logs `email=${body.email} clientId=… kycLink=…`; and `:431` logs the **full Dr Green response** via `JSON.stringify(drGreenResponse)`.
   - `app/tenant-admin/layout.tsx:35` and `:52` — log the admin's Clerk email + tenant.
   This is the highest-severity item here and the reason the PRD is HIGH.
2. **No structured logger; raw `console.*` everywhere; no log-level PII redaction.** Measured **839** `console.*` calls across `.ts`/`.tsx` in `nextjs_space` (**450** in `app/` + `lib/` + `components/` specifically; the first-pass review's "437" under-counted). There is no log levelling, no correlation id propagation, no environment-aware verbosity, and — critically — **no redaction at the log boundary**. Note: `lib/redact.ts` (`sanitizeForLogging`) already exists and is used by `lib/audit-log.ts`, but **none of the raw `console.*` calls go through it**, and even `lib/api-error.ts:89` logs error context via raw `console.error`. The redaction primitive exists; the logger that would apply it universally does not.
3. **No status page.** There is a health endpoint (`app/api/health/route.ts`) but no externally-consumable status surface. An enterprise customer's "where do I see uptime/incidents?" has no answer.
4. **No runbooks.** Only `docs/SECURITY_PHASE_0_RUNBOOK.md` exists. There is no incident-response runbook, no DR/backup-restore drill, no "Redis down" / "Dr Green API down" / "Postgres failover" procedure.
5. **No SLO doc.** No documented availability/latency targets, error budget, or what an incident is measured against.
6. **Rate-limit / webhook fail-open has no alerting hook.** `lib/rate-limit.ts:94-95` fails open when Redis is down — `console.warn('[RateLimit] Redis unavailable — allowing request through (fail-open)…')` — with **no alert**. The same applies to the webhook rate-limit fail-open. The *fix* to those controls lives in PRD-211; **this PRD supplies the alerting channel** they call when they fail open, so a silent loss of rate-limiting becomes a paged incident.
7. **`optionalDependencies` link to a sibling repo (MEDIUM — build reproducibility).** `package.json:58-59` declares `"@automatos/widget-sdk": "link:../../automatos-widget-sdk/packages/react"` — a local filesystem `link:` to a sibling repo that does not exist in CI or on Railway. It is in `optionalDependencies` so installs don't hard-fail, but it makes builds non-reproducible and is undocumented. It must be documented + pinned to a published version, or removed.

This PRD: introduces a structured logger (`lib/logger.ts`) that redacts PII/PHI via `lib/redact.ts` and carries correlation ids; replaces the PHI-leaking `console.*` calls (and migrates the rest); stands up a status page, runbooks, an SLO doc, and an alerting channel; and resolves the sibling-SDK dependency.

## 2. Users / personas

| Role | How they benefit |
|---|---|
| **Data subject (customer)** | Their health/KYC data stops landing in plaintext logs outside the encryption perimeter |
| **On-call engineer (Gerard)** | Structured, redacted logs with correlation ids; a runbook per incident class; an alert when rate-limiting fails open |
| **Enterprise customer** | A status page + published SLO + incident-response process to point their vendor-risk team at |
| **DPO** | Log redaction closes the special-category-data-in-logs gap; supports the PRD-213 erasure-completeness requirement |

## 3. User stories

- As a **customer**, my email and KYC status are never written to a log line in cleartext.
- As **on-call**, when something breaks I get one structured log stream with correlation ids and a runbook that tells me exactly what to check (Redis, Dr Green, Postgres) and how to recover.
- As an **enterprise buyer**, I can see a status page, read your SLO, and review your incident-response + DR runbooks.
- As the **DPO**, I can attest that PII/PHI in logs is redacted and retention is bounded.

## 4. Acceptance criteria

**Structured logger + PII/PHI redaction:**

- [ ] **AC-1** A new `lib/logger.ts` wraps a structured logging library (pino preferred — fast, JSON, low overhead) exposing `logger.info/warn/error/debug` with a child-logger pattern for per-request correlation ids. Levels are environment-aware (`debug` off in production).
- [ ] **AC-1a** Every log call passes its payload through `lib/redact.ts` `sanitizeForLogging` (or pino's `redact` paths configured from the same `SENSITIVE_FIELDS` set) so emails/names/phones/addresses/KYC links/credentials are stripped before they hit the transport. A single source of truth for the field set (extend `lib/redact.ts`, don't fork it).
- [ ] **AC-1b** `lib/api-error.ts` is updated so its server-side error log (currently raw `console.error` at `:89`) goes through `logger.error` with the correlation id, keeping the existing client-facing redaction unchanged.

**Kill the PHI leaks (priority):**

- [ ] **AC-2** `app/actions/kyc-check.ts:122` no longer logs the email; it logs a non-PII identifier (e.g. local user id / Dr Green client id) + the boolean states, via `logger.info`.
- [ ] **AC-2a** `app/api/consultation/submit/route.ts:153,208,426-427` no longer log `body.email`; `:431` no longer logs the raw `JSON.stringify(drGreenResponse)` (log a redacted summary — status + presence flags only).
- [ ] **AC-2b** `app/tenant-admin/layout.tsx:35,52` no longer log the admin email; log the Clerk user id + tenant id only.
- [ ] **AC-2c** A grep gate (CI, PRD-216) asserts no `console.log`/`console.error` interpolates a known PII field name (`email`, `body.email`, `clerkUser.email`, `firstName`, `phone`, `address`, `drGreenResponse`) — shared with PRD-213.

**Migrate remaining `console.*`:**

- [ ] **AC-3** The ~839 `console.*` calls (450 in `app`/`lib`/`components`) are migrated to `logger.*` in priority order: (1) the PHI lines above, (2) `app/` request handlers + actions, (3) `lib/`, (4) `components/`. Build/scripts/tests `console.*` may be left or excluded explicitly. A `no-console` ESLint rule (error in `app`/`lib`/`components`, allow in scripts/tests) prevents regression and is wired into the existing CI lint step.
- [ ] **AC-3a** Migration is mechanical-but-reviewed: no log call loses information that ops needs, and none gains PII it didn't have.

**Status page:**

- [ ] **AC-4** A status surface exists — either a hosted status page (e.g. an external provider fed by the health endpoint) or an in-app `/status` route — showing platform + dependency health (app, Postgres, Redis, Dr Green). Documented in `docs/STATUS_PAGE.md`. (Coordinate with PRD-200's health-endpoint hardening so detail stays behind a token.)

**Runbooks:**

- [ ] **AC-5** `docs/runbooks/` contains, at minimum: incident-response (severity levels, comms, correlation-id lookup), `redis-down.md`, `drgreen-api-down.md`, `postgres-failover-and-restore.md` (with a tested backup-restore drill using the `pg_dump`/`pg_restore` procedure from `MEMORY.md`), and `rate-limit-fail-open.md`. Each references the **current** architecture (gated on PRD-214).

**SLO:**

- [ ] **AC-6** `docs/SLO.md` defines availability + latency targets (e.g. 99.9% monthly availability, storefront p95 < N ms), the error budget, and how breaches map to incidents. The status page + alerting measure against it.

**Alerting channel:**

- [ ] **AC-7** An alerting hook (`lib/alert.ts` posting to a Slack/email/PagerDuty webhook from env config) is added and **called by the rate-limit/webhook fail-open paths** (`lib/rate-limit.ts:94-95` and the webhook limiter) so a fail-open event pages on-call instead of only `console.warn`. (The fail-open *fix* is PRD-211; this PRD owns the alert channel.)
- [ ] **AC-7a** The alert channel is also wired to `security.tenant_context_missing` (PRD-202) and erasure-noop events (PRD-213) so the cross-PRD log events have somewhere to go.

**Sibling-SDK dependency:**

- [ ] **AC-8** `package.json:58-59` `"@automatos/widget-sdk": "link:../../automatos-widget-sdk/packages/react"` is resolved: either documented + pinned to a published version (registry or git tag), or removed if unused. CI install + Railway build must not depend on a sibling working-copy path.

## 4.1 Design framework conformance

One small UI surface if the `/status` route is in-app; otherwise none. A `/status` page uses existing layout primitives, shows dependency health as simple status pills, and adds no template-specific values.

- [ ] **AC-9** `/status` (if in-app) uses existing UI primitives; no new design tokens.
- [x] No template-specific values added to platform code.
- [x] Logger/alerting are infrastructural — no storefront visual change.

## 5. Scope

**In scope:** `lib/logger.ts` + redaction wiring; eliminate the verified PHI log lines; migrate `console.*` → `logger.*` (+ `no-console` lint); status page; runbooks (incl. DR/backup-restore drill); SLO doc; alerting channel wired to fail-open + cross-PRD events; resolve the `@automatos/widget-sdk` `link:` dependency.

**Out of scope:**
- The **fix** to the webhook/rate-limit fail-open behaviour and the webhook HMAC/egress hardening → **PRD-211** (this PRD only supplies the alert channel they call).
- Centralised log **aggregation/SIEM** beyond Railway's store + the structured stream → follow-up.
- The GDPR erasure flow itself → **PRD-213** (this PRD's log redaction is the dependency that makes erasure *complete*).
- Tracing/APM (OpenTelemetry) → follow-up; correlation ids are the minimum here.

## 6. Non-functional requirements

| NFR | Requirement |
|---|---|
| Data protection | No PII/PHI in any log line post-migration; redaction applied at the log boundary via the single `lib/redact.ts` field set |
| Performance | Structured logging adds negligible overhead (pino is async/low-cost); no measurable storefront p95 regression |
| Observability | Every request carries a correlation id; the same id appears in `apiError` client responses and server logs |
| Reliability | Fail-open events (Redis/webhook) page on-call within the alert channel's delivery SLA |
| Reproducibility | CI + Railway builds do not depend on a sibling working-copy `link:` |
| Retention | Log retention is bounded and documented (supports PRD-213 erasure completeness) |

## 7. Success metrics

- 0 PII/PHI fields in log lines (CI grep gate) — down from the 6 verified leak sites.
- `console.*` in `app`/`lib`/`components` driven to ~0 (from 450) and held by `no-console` lint.
- Status page live; SLO published; ≥5 runbooks in `docs/runbooks/` including a *tested* backup-restore drill.
- Rate-limit fail-open produces an alert in 100% of induced-failure tests (previously 0).
- `pnpm install --frozen-lockfile` succeeds in CI with no sibling-repo path dependency.

## 8. API surface

| Method | Path | Change |
|---|---|---|
| GET | `/status` | (Optional, if in-app) public dependency-health summary; detail behind the PRD-200 health token |

No other external API change. Internal: `lib/logger.ts`, `lib/alert.ts` added; `lib/api-error.ts` logging routed through the logger.

## 9. Data model changes

None.

## 10. Events emitted / consumed

| Event | Direction | Payload | Subscribers |
|---|---|---|---|
| `ops.rate_limit_fail_open` | emit | `{ identifier(hashed), reason: "redis_unavailable" }` | `lib/alert.ts` → on-call |
| `ops.webhook_rate_limit_fail_open` | emit | `{ source, reason }` | `lib/alert.ts` → on-call |
| `security.tenant_context_missing` | consume | from PRD-202 | `lib/alert.ts` (should be zero in steady state) |
| `account.erasure_noop_user_not_found` | consume | from PRD-213 | `lib/alert.ts` |

This PRD makes the cross-PRD log events (PRD-200/202/213) into deliverable alerts rather than log lines.

## 11. UI / UX

- **Status page:** simple dependency-health pills (app / Postgres / Redis / Dr Green) + recent-incident list. If hosted externally, link it from the marketing/footer.
- **No storefront/admin visual change** from the logger or alerting.

## 12. Test plan

**Unit (Vitest — PRD-207):**
- `logger.test.ts` — `logger.*` emits structured JSON at the right level; production omits `debug`; child loggers carry the correlation id.
- `logger-redaction.test.ts` — logging an object with `email`/`firstName`/`phone`/`address`/`kycLink`/`drGreenResponse` produces redacted output (reuses `lib/redact.ts` field set); a Dr Green response is summarised, not dumped.
- `alert.test.ts` — `lib/alert.ts` posts to the configured webhook; failures are swallowed (alerting never breaks the request).

**Integration:**
- `consultation-submit.logging.test.ts` — submitting a consultation produces **no** log line containing the email or the raw Dr Green response (asserts AC-2/AC-2a against `app/api/consultation/submit/route.ts`).
- `rate-limit-fail-open.alert.test.ts` — with Redis unavailable, the limiter fails open **and** fires `ops.rate_limit_fail_open` to the alert channel (asserts AC-7 against `lib/rate-limit.ts:94-95`).

**E2E (Playwright):** N/A for logger; a smoke check that `/status` renders dependency health if the in-app route is chosen.

**Grep gates (CI, PRD-216):** no PII field name interpolated into a `console.*`/`logger.*` raw message (AC-2c); `no-console` in `app`/`lib`/`components`.

**Coverage target:** 95% on `lib/logger.ts` + `lib/redact.ts` (data-protection-critical); 90% on `lib/alert.ts`.

## 13. Open questions

- [ ] **OQ-1** Logging library — pino (fast, JSON, ecosystem) vs a thin custom wrapper? Owner: Gerard. Resolution: pino with `redact` configured from `lib/redact.ts`'s field set, unless bundle/runtime constraints on the Next.js server surface a problem.
- [ ] **OQ-2** Status page — hosted provider (Better Uptime / Instatus, fed by the health endpoint) vs in-app `/status`? Owner: Gerard. Resolution: hosted for the public SLA surface; in-app `/status` optional for internal detail.
- [ ] **OQ-3** Alert transport — Slack webhook vs PagerDuty vs email? Owner: Gerard. Resolution: start with a Slack/Discord webhook from env; make `lib/alert.ts` transport-pluggable so PagerDuty can be added later.
- [ ] **OQ-4** Is `@automatos/widget-sdk` actually used at runtime, or dead? Owner: Gerard. Resolution: if used, publish + pin; if not, remove the `optionalDependencies` entry and any import.
- [ ] **OQ-5** Log-retention window (must satisfy PRD-213 erasure completeness without losing ops value)? Owner: DPO + Gerard. Resolution: document in `docs/SLO.md` + the erasure runbook.

## 14. Dependencies

**Strict:**
- **PRD-214** — runbooks must reference a current architecture doc (auth = Clerk, hosting = Railway); the runbook section is blocked until the docs are reconciled.

**Soft:**
- **PRD-211** — supplies the rate-limit/webhook fail-open *fix*; this PRD supplies the alert channel those fixes call. Land together for the fail-open story to be complete.
- **PRD-213** — log redaction here is the dependency that makes GDPR erasure *complete* (PII must stop reaching plaintext logs).
- **PRD-202** — emits `security.tenant_context_missing`; this PRD gives it an alert sink.
- **PRD-200** — health-endpoint hardening; the status page must keep detail behind the health token.
- **PRD-207** — Vitest harness for the logger/redaction/alert tests.
- **PRD-203** — auth wrapper is a natural place to attach the per-request correlation-id child logger.

## 15. Estimated effort

- **`lib/logger.ts` + `lib/redact.ts` wiring + `api-error.ts` integration:** 6 hours
- **Eliminate the 6 PHI leak sites + grep gate:** 3 hours
- **Migrate ~450 `console.*` (app/lib/components) + `no-console` lint:** 10 hours
- **Status page (hosted or `/status`) + `STATUS_PAGE.md`:** 5 hours
- **Runbooks (incl. tested backup-restore DR drill) + `SLO.md`:** 10 hours
- **`lib/alert.ts` + wire fail-open + cross-PRD events:** 5 hours
- **Resolve `@automatos/widget-sdk` link dependency:** 2 hours
- **Tests:** 7 hours
- **Total:** ≈ 48 hours (≈ 6 days for 1 dev + Claude pair)

## 16. References

- Existing code (verified 2026-05-29): PHI logs at `app/actions/kyc-check.ts:122`, `app/api/consultation/submit/route.ts:153,208,426-427,431`, `app/tenant-admin/layout.tsx:35,52`; `lib/redact.ts` (`sanitizeForLogging`, `SENSITIVE_FIELDS`); `lib/audit-log.ts` (already uses redaction); `lib/api-error.ts:89` (raw `console.error`); `lib/rate-limit.ts:94-95` (fail-open `console.warn`, no alert); `app/api/health/route.ts`; `package.json:58-59` (`@automatos/widget-sdk` `link:`); `docs/SECURITY_PHASE_0_RUNBOOK.md` (only existing runbook)
- Measured: **839** `console.*` calls across `.ts`/`.tsx` in `nextjs_space` (**450** in `app`/`lib`/`components`), across ~199 files — the first-pass "437" under-counted
- Standards: GDPR Art. 9 (special-category/health data), Art. 32 (security of processing — log hygiene); [pino redaction](https://getpino.io/#/docs/redaction); [Google SRE — SLOs & error budgets](https://sre.google/sre-book/service-level-objectives/)
- Cross-PRD: PRD-211 (fail-open fix + webhook hardening), PRD-213 (GDPR erasure completeness), PRD-202 (`tenant_context_missing` alert sink), PRD-200 (health-endpoint token), PRD-214 (current architecture for runbooks)
- Memory: `project_railway_environments.md` (`pg_dump`/`pg_restore` for the DR drill — Railway Postgres v17), `MEMORY.md` (Railway log store)
- 2026-05-29 review: "PHI/PII to plaintext logs [ELEVATED → HIGH]"; "No structured logger; console.* calls; no PII redaction"; "No status page; no runbooks; no SLO doc; no DR drill"; "Webhook rate-limit fail-open has no alerting hook"; "`optionalDependencies` link to sibling `automatos-widget-sdk` repo"

## 17. Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-05-29 | Claude (with Gerard) | Initial draft from 2026-05-29 review. |
| 0.2 | 2026-05-29 | Claude (Opus 4.8) | Verified the 6 PHI log lines against code and made them the headline; **re-measured `console.*` at 839 total / 450 in app+lib+components (first pass said 437 — under-counted)**; confirmed `lib/redact.ts` exists + is used by `audit-log.ts` but not by raw `console.*`; confirmed `lib/api-error.ts:89` logs via raw `console.error`; confirmed rate-limit fail-open at `lib/rate-limit.ts:94-95` has no alert; confirmed `@automatos/widget-sdk` `link:` at `package.json:58-59`; confirmed only `SECURITY_PHASE_0_RUNBOOK.md` exists. Added logger/redaction/alert AC split + cross-PRD event sinks. |
