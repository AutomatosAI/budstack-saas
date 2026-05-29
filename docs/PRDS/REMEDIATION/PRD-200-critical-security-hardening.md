# PRD-200 — Security Hardening (secret purge, error redaction, `legacyCss` XSS, email-template HTML, info-leak endpoints)

> **Status:** Code fixes shipped & gated green (AC-2, AC-2b, AC-3, AC-3b, AC-4, AC-5a, AC-6, AC-7 — CI gate `pnpm check:security`). Framework bump (AC-1/AC-1a) + CSP nonces (AC-8) rehomed to [PRD-218](./PRD-218-framework-upgrade-csp-nonce-hardening.md). **Closeable once AC-2a (Railway key rotation — Gerard) lands**; only the AC-3a `sanitizeCss` unit tests still await PRD-207's Vitest harness.
> **Phase:** R1 — Pre-Production Blocker
> **Severity:** HIGH _(down-rated from the first-pass "CRITICAL" — see [Pre-flight verification](./REMEDIATION-INDEX.md#pre-flight-verification--2026-05-29); none of these components is an open auth-bypass, but together they are the HTTP-edge hygiene a paying tenant's security questionnaire will probe first)_
> **Module(s) touched:** `package.json`, `app/store/[slug]/layout.tsx`, `app/api/super-admin/email-templates/route.ts`, `lib/email-sanitize.ts`, `app/api/super-admin/tenants/[id]/drgreen-keys/route.ts`, `app/api/health/route.ts`, `lib/css-utils.ts`, `scripts/ci/check-css-sanitized.mjs` + `scripts/ci/check-no-error-message-leaks.mjs` (added), repo-root `env.windows-dev` (deleted), `.env.example` (added)
> **Depends on:** None — can begin immediately.
> **Blocks:** Treating any environment as production. Blocks PRD-216 (CI security gates re-checks these on every PR).
> **Owner:** Gerard + Claude. Security sign-off: Gerard.
> **Last updated:** 2026-05-29

---

## 1. Problem

The 2026-05-29 review flagged six HTTP-edge / hygiene gaps. After verification, **none is the "CRITICAL middleware auth-bypass" the first pass implied** — but each is real, and a tenant's security review will hit them on day one.

1. **Next.js dependency advisories (HIGH, not auth-bypass).** We run **14.2.35**. The headline scare — `CVE-2025-29927` middleware authorization bypass — was **fixed in 14.2.25**, so we are already clear, and the app uses the **App Router** (the advisory targets Pages-router `middleware`). The advisories that *do* apply to 14.2.35 are: **HIGH** DoS via Server Components / HTTP request deserialization, **HIGH** SSRF in server actions, and **LOW** cache-poisoning. All clear at **15.5.x**. This is dependency hygiene with a real DoS exposure, not an open authentication hole.
2. **`env.windows-dev` local secret-spill (MED-HIGH).** A 24-key env file sits at the repo root. It is **gitignored and never committed** (`git log --all -- env.windows-dev` returns nothing), so this is **not a repository breach** — but the file holds live-looking values including `ENCRYPTION_KEY` (the master key that decrypts *every* tenant's Dr Green payment-signing key), `AWS_SECRET_ACCESS_KEY`, `CLERK_SECRET_KEY`, `DRGREEN_SECRET_KEY`, and `DATABASE_URL`. A laptop compromise or an accidental `git add -f` turns it into a full breach.
3. **Stored XSS via `legacyCss` (HIGH, confirmed).** `app/store/[slug]/layout.tsx:323` correctly sanitises tenant CSS — `{customCss && <style dangerouslySetInnerHTML={{ __html: sanitizeCss(customCss) }} />}`. But **20 lines later, line 331 injects `legacyCss` raw**: `{legacyCss && <style dangerouslySetInnerHTML={{ __html: legacyCss }} />}`. `legacyCss` is assembled at `:174-178` from template-asset CSS. A CSS payload with `</style><script>…` or a CSS `expression()`/`url(javascript:…)` vector executes in the storefront origin — i.e. in front of customers entering KYC/payment details. This is the one finding here that touches end-user PII directly.
4. **Super-admin email-template raw-HTML sink (MEDIUM).** `app/api/super-admin/email-templates/route.ts` accepts raw HTML bodies and persists them; they are later rendered into outbound emails. Stored XSS / HTML-injection into transactional email, exploitable by a compromised super-admin session.
5. **Server error text leaked to clients (MEDIUM).** ~27 route handlers return `error.message` (or `JSON.stringify(error)`) in the response body. This leaks stack frames, Prisma error detail, internal hostnames, and Dr Green API internals. All client-facing errors must go through the `apiError()` envelope in `lib/api-error.ts`, which returns a stable code and logs the detail server-side only.
6. **Debug-instrumentation info leaks (MEDIUM).**
   - `app/api/health/route.ts:41-53` returns `process.memoryUsage()` + `process.uptime()` to **anonymous** callers — fingerprinting + capacity-probing aid.
   - `app/api/super-admin/tenants/[id]/drgreen-keys/route.ts:60-62` returns `base64DecodedLen`, `base64DecodedFirstByteHex`, and `base64DecodedAsTextStart = bytes.toString("utf-8").slice(0, 30)` — i.e. **the first 30 bytes of decoded key material** plus its length. This is decryption-debug scaffolding that must not ship; even behind super-admin auth it is a needless oracle over secret bytes.
7. **CSP retains `script-src 'unsafe-inline'` (MEDIUM, hardening).** The current CSP allows inline scripts, which negates much of CSP's XSS value. Move to nonces (or hashes) so finding #3/#4-class injections cannot execute even if a sink is missed.

This PRD purges + rotates the local secret file, closes the `legacyCss` sink, sanitises the email-template HTML, routes client-facing errors through generic messages, and strips the debug oracles. **Findings #1 (Next.js bump) and #7 (CSP nonces) carry breaking-change risk that needs a human bump decision + manual smoke, so they were rehomed to [PRD-218](./PRD-218-framework-upgrade-csp-nonce-hardening.md)** rather than half-deferred inside this PRD — letting the safe code fixes ship and close cleanly.

## 2. Users / personas

| Role | How they benefit |
|---|---|
| **Storefront customer** | Cannot be served attacker JS via a poisoned template CSS blob |
| **Tenant admin** | Transactional emails cannot carry injected HTML/script |
| **Gerard / ops** | Health + key-debug endpoints stop leaking internals; one master key rotated off a risky local file |
| **Prospective enterprise tenant** | The dependency-advisory + headers questions in their security questionnaire pass |

## 3. User stories

- As a **customer**, when I open a tenant storefront, every `<style>` block has been sanitised — no template can smuggle script into the page where I enter my card / KYC details.
- As an **attacker**, a Next.js DoS/SSRF advisory I find in a scanner is already patched on the running version.
- As an **incident responder**, a leaked local laptop does not hand the attacker `ENCRYPTION_KEY`, because it has been rotated and the file deleted.
- As an **API consumer**, a server error returns `{ success: false, error: { code } }` with no stack trace or internal hostname.

## 4. Acceptance criteria

> **Status tags:** **[DONE]** code shipped & verified · **[OPEN]** still required to close this PRD · **[TEST→207]** automated test/gate backfills with PRD-207 (no harness yet) · **[MOVED→218]** rehomed to PRD-218.

**Dependency hygiene → [MOVED→218]:**

- **AC-1 / AC-1a** — `next` upgraded to a zero-HIGH-advisory version + `pnpm build`/`typecheck`/smoke green. **Rehomed to [PRD-218](./PRD-218-framework-upgrade-csp-nonce-hardening.md)** (carries App-Router breaking-change risk; needs Gerard's major-bump decision + manual smoke).

**Local secret purge + rotation:**

- [x] **AC-2** **[DONE]** `env.windows-dev` deleted from disk; `.env.example` (values redacted) documents the required variable **names** only. (commit `2c8d8ab`)
- [ ] **AC-2a** **[OPEN — Gerard/Railway]** `ENCRYPTION_KEY`, `DRGREEN_SECRET_KEY`, `CLERK_SECRET_KEY`, `AWS_SECRET_ACCESS_KEY`, and the `DATABASE_URL` password **rotated** in Railway (prod + staging). Because `ENCRYPTION_KEY` decrypts tenant Dr Green keys, rotation follows the PRD-211 versioned-key flow (decrypt-with-old → re-encrypt-with-new), not a hard swap. **This is the only remaining action to fully close PRD-200** — an ops task, not code.
- [x] **AC-2b** **[DONE]** `git log --all --full-history -- '*env.windows-dev*'` confirmed empty — the file was never committed, so no history scrub is required.

**`legacyCss` XSS:**

- [x] **AC-3** **[DONE]** `app/store/[slug]/layout.tsx:331` wraps `legacyCss` in `sanitizeCss(...)`, identical to the `customCss` path at `:323`. No raw `legacyCss` reaches `dangerouslySetInnerHTML`.
- [ ] **AC-3a** **[TEST→207]** `sanitizeCss()` unit tests (`</style><script>`, `expression(...)`, `url(javascript:...)`, `@import url(//evil)`, comment-break payloads) — no Vitest harness exists yet; lands with PRD-207.
- [x] **AC-3b** **[DONE]** the only two CSS `dangerouslySetInnerHTML` sinks (`:323`, `:331`) are both `sanitizeCss`-wrapped, enforced by the wired CI gate `pnpm check:css-sanitized` (`scripts/ci/check-css-sanitized.mjs`) — green.

**Email-template HTML:**

- [x] **AC-4** **[DONE]** `app/api/super-admin/email-templates/route.ts` POST/PUT Zod-validate the payload (`createTemplateSchema.safeParse`) and sanitise via `sanitizeEmailHtml`/`sanitizeEmailSubject` (`lib/email-sanitize.ts`) before persistence — no `<script>`, event handlers, or `javascript:` hrefs survive.

**Error redaction:**

- [~] **AC-5** **[PARTIAL — client leak closed & gated]** The client-facing leak is closed and enforced by the green `check:no-error-leaks` CI gate (see AC-5a): customer-facing routes return generic messages and log raw detail server-side (verified — `store/[slug]/products/route.ts:90-92` and `store/[slug]/orders/submit/route.ts:143-165` use `console.error`/`log()` + `.includes()` control-flow, never the raw message in the response body). **Remaining gap:** not every route is standardised on a single `apiError()` envelope, and the per-error correlation id depends on PRD-215's structured logger. Admin-only operational tooling (`test-smtp`, `migrate-s3-paths`, `reset-templates`) intentionally surfaces operation status to the super-admin.
- [x] **AC-5a** **[DONE]** wired CI gate `pnpm check:no-error-leaks` (`scripts/ci/check-no-error-message-leaks.mjs`) asserts zero `error.message`/`err.message` inside a `Response.json(...)` body across `app/api/**` — green. Aggregate runner: `pnpm check:security`.

**Info-leak endpoints:**

- [x] **AC-6** **[DONE]** `app/api/health/route.ts` returns only `{ status }` (+ 200/503) to anonymous callers. Memory, uptime, and per-service detail are returned **only** behind a valid `HEALTH_DETAIL_TOKEN` bearer header.
- [x] **AC-7** **[DONE]** `drgreen-keys/route.ts` GET returns `{ configured, looksValid }` only — the `base64DecodedLen`/`base64DecodedFirstByteHex`/`base64DecodedAsTextStart` decode-debug block is deleted; no byte of decoded key material is exposed.

**CSP hardening → [MOVED→218]:**

- **AC-8** — CSP `script-src` nonce migration (drop `'unsafe-inline'`; `frame-ancestors`, `object-src 'none'`). **Rehomed to [PRD-218](./PRD-218-framework-upgrade-csp-nonce-hardening.md)** (needs an inline-`<script>` audit + manual smoke before tightening).

## 4.1 Design framework conformance

No new UI surfaces. The `legacyCss` fix is server-side; CSP nonces are infrastructural. Storefront visual output is unchanged (sanitiser already runs on `customCss` with no reported regressions).

- [x] No new tokens / primitives — N/A
- [x] Data-driven template rule respected — no template-specific value added to platform code
- [x] Storefront render unchanged post-sanitise — manual visual diff on 2 live tenants

## 5. Scope

**In scope:** `env.windows-dev` delete + key rotation; `legacyCss` sanitisation; email-template HTML sanitisation; client-facing error redaction; health + drgreen-keys debug-leak removal.

**Out of scope:**
- **Next.js framework bump + CSP nonce migration → [PRD-218](./PRD-218-framework-upgrade-csp-nonce-hardening.md)** (split out: both need a human bump/inline-audit decision + manual smoke).
- CSRF on destructive super-admin routes → PRD-201.
- Tenant-context concurrency → PRD-202.
- The broad input-validation sweep (Zod everywhere) → PRD-204 (this PRD only Zod-validates the email-template body it touches).
- Structured logging / PII redaction in logs → PRD-215 (also supplies the AC-5 correlation id).
- Vitest/Playwright test harness + the AC-3a/AC-5a gates → PRD-207.
- Full Dependabot/CodeQL automation → PRD-216.

## 6. Non-functional requirements

| NFR | Requirement |
|---|---|
| Backward compatibility | Next.js bump must not regress storefront/admin render or middleware rewrites |
| Performance | `sanitizeCss` on `legacyCss` adds < 2 ms per storefront render (already paid for `customCss`) |
| Security | Zero HIGH/CRITICAL `next` advisories post-bump; zero decoded-key bytes in any response |
| Observability | Redacted errors still log full detail server-side with correlation id |
| Reversibility | Key rotation uses PRD-211 versioned-key flow so no tenant Dr Green key is orphaned |

## 7. Success metrics

- `pnpm audit --prod` HIGH/CRITICAL count for `next` = **0**.
- Zero `dangerouslySetInnerHTML` CSS sinks unwrapped by `sanitizeCss` (CI grep gate).
- Zero response bodies containing `error.message` across `app/api/**` (CI grep gate).
- `GET /api/health` body to anon caller contains no `memory`/`uptime`/`version` keys.
- `drgreen-keys` GET returns no substring of decoded key material.
- `env.windows-dev` absent from working tree; rotated keys confirmed live in Railway.

## 8. API surface

| Method | Path | Change |
|---|---|---|
| GET | `/api/health` | Body reduced for anon; detail behind `HEALTH_DETAIL_TOKEN` |
| GET | `/api/super-admin/tenants/[id]/drgreen-keys` | Drops decoded-byte debug fields |
| POST/PUT | `/api/super-admin/email-templates` | Body Zod-validated + HTML-sanitised |

No new public endpoints. Error envelope standardised to `apiError()`.

## 9. Data model changes

None.

## 10. Events emitted / consumed

| Event | Direction | Payload | Subscribers |
|---|---|---|---|
| `security.css_sanitised_blocked` | emit (log) | `{ tenantSlug, pattern }` | logs (later audit, PRD-215) |
| `security.key_rotation.encryption_key` | emit | `{ rotatedAt, tenantsReencrypted }` | logs / audit (PRD-211 flow) |

(Event bus is not yet built — these are log lines today; PRD-215 formalises them.)

## 11. UI / UX

No visible UI change. Storefront renders identically once `legacyCss` is sanitised; super-admin key panel shows `configured / looksValid` booleans instead of decoded bytes.

## 12. Test plan

**Unit (Vitest — stood up in PRD-207):**
- `css-utils.test.ts` — `sanitizeCss` neutralises `</style><script>`, `expression()`, `url(javascript:)`, `@import`, comment-break payloads (AC-3a).
- `api-error.test.ts` — `apiError()` never serialises a raw `Error` message.
- `email-templates.schema.test.ts` — Zod rejects script/event-handler HTML; allow-list passes safe formatting.

**Integration:**
- `health.route.test.ts` — anon GET has no `memory`/`uptime`; token GET includes detail (AC-6).
- `drgreen-keys.route.test.ts` — GET response contains no `base64Decoded*` keys (AC-7).

**E2E (Playwright):**
- `storefront-legacycss-xss.spec.ts` — seed a tenant with a malicious `legacyCss` blob; assert no script executes and no `<script>` node is present in the rendered `<head>`.

**Grep gates — already wired as `pnpm check:security` (`scripts/ci/`), re-run in PRD-216 CI:**
- No unwrapped CSS `dangerouslySetInnerHTML` — `check:css-sanitized` (AC-3b). **Green.**
- No `error.message` in API `Response.json` bodies — `check:no-error-leaks` (AC-5a). **Green.**

**Coverage target:** 90% on `css-utils.ts` + `api-error.ts` (security-critical).

## 13. Open questions

- [→] **OQ-1** Next.js **15.5.x major bump vs 14.2.x patch** — **moved to [PRD-218](./PRD-218-framework-upgrade-csp-nonce-hardening.md) OQ-1** (the framework bump now lives there).
- [→] **OQ-2** Does any storefront template legitimately rely on inline `<script>` (blocking the CSP nonce migration)? — **moved to [PRD-218](./PRD-218-framework-upgrade-csp-nonce-hardening.md) OQ-2**.
- [ ] **OQ-3** Is `legacyCss` still needed at all, or can the `customCss` path subsume it? Owner: Gerard. Resolution: if legacy templates are migrated, delete the `legacyCss` branch outright (best fix). _(Still open, but moot for security — the `:331` sink is now sanitised either way.)_
- [x] **OQ-4** `HEALTH_DETAIL_TOKEN` vs internal-only port for health detail — **resolved:** shipped the `HEALTH_DETAIL_TOKEN` bearer approach (works on Railway without a second port; anon callers get `{ status }` only).

## 14. Dependencies

**Strict:** None — first PRD that can start.

**Soft:**
- PRD-211 (encryption versioned-key flow) — `ENCRYPTION_KEY` rotation should use it to avoid orphaning tenant Dr Green keys; if PRD-211 has not landed, do a manual decrypt-old/re-encrypt-new run scripted for this PRD.
- PRD-207 (test foundation) — Vitest harness for the unit tests above; until it lands, ship the grep gates + E2E and backfill units with PRD-207.

## 15. Estimated effort

- **Next.js bump + smoke:** 5 hours (more if 15.x major surfaces breakage)
- **Secret purge + rotation:** 3 hours (coordinated with PRD-211 flow)
- **`legacyCss` + email-template sanitisation:** 2 hours
- **`apiError()` rollout across ~27 handlers:** 4 hours
- **Health + drgreen-keys leak removal:** 1 hour
- **CSP nonce migration:** 3 hours
- **Tests + grep gates:** 4 hours
- **Total:** ≈ 22 hours (≈ 2 days for 1 dev + Claude pair; +1 day if Next 15 major bump is taken)

## 16. References

- Existing code: `app/store/[slug]/layout.tsx:174-178,323,331`, `lib/css-utils.ts`, `app/api/super-admin/email-templates/route.ts`, `app/api/super-admin/tenants/[id]/drgreen-keys/route.ts:53-80`, `app/api/health/route.ts:41-53`, `lib/api-error.ts`
- Advisories: `CVE-2025-29927` (Next.js middleware bypass — **fixed 14.2.25, N/A to us**), Next.js Server Components DoS + SSRF advisories (apply to 14.2.35)
- Standards: [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html), [MDN CSP nonces](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src)
- 2026-05-29 review: original C1, C2, H7, plus error-leak / health / drgreen-keys findings
- Memory: `project_encryption_v2_prefix.md` (v2 prefix detection — relevant to `drgreen-keys` decode block)

## 17. Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-05-29 | Claude (with Gerard) | Initial draft from 2026-05-29 review. |
| 0.2 | 2026-05-29 | Claude (Opus 4.8) | Severity down-rated CRITICAL→HIGH after verification; Next.js framing corrected (CVE-2025-29927 already patched; real exposure is DoS/SSRF); `legacyCss` line + `drgreen-keys` decode-leak lines + `kyc`/health paths verified against code. |
| 0.3 | 2026-05-29 | Claude (Opus 4.8) | **Status flipped to closeable.** Code fixes shipped & code-verified: AC-2 (env purge + `.env.example`), AC-2b (history-clean), AC-3 (`legacyCss` sanitised), AC-4 (email HTML zod+sanitise), AC-6 (health token-gated), AC-7 (drgreen-keys decode-leak removed). AC-3b + AC-5a CI grep gates verified **wired & green** (`pnpm check:security`). AC-5 marked PARTIAL (client leak closed + gated; envelope/correlation-id → PRD-215). **AC-1/AC-1a (Next bump) + AC-8 (CSP nonces) rehomed to PRD-218**; only the AC-3a `sanitizeCss` unit tests await PRD-207's Vitest harness; OQ-4 resolved. **Only AC-2a (Railway key rotation, Gerard) remains to fully close.** |
