# PRD-200 — Security Hardening (Next.js bump, secret purge, error redaction, `legacyCss` XSS, info-leak endpoints)

> **Status:** Proposed
> **Phase:** R1 — Pre-Production Blocker
> **Severity:** HIGH _(down-rated from the first-pass "CRITICAL" — see [Pre-flight verification](./REMEDIATION-INDEX.md#pre-flight-verification--2026-05-29); none of these components is an open auth-bypass, but together they are the HTTP-edge hygiene a paying tenant's security questionnaire will probe first)_
> **Module(s) touched:** `package.json`, `next.config.js`, `app/store/[slug]/layout.tsx`, `app/api/super-admin/email-templates/route.ts`, `app/api/super-admin/tenants/[id]/drgreen-keys/route.ts`, `app/api/health/route.ts`, `lib/api-error.ts`, `lib/css-utils.ts`, repo-root `env.windows-dev` (delete)
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

This PRD bumps Next.js, purges + rotates the local secret file, closes the `legacyCss` sink, sanitises the email-template HTML, routes all errors through `apiError()`, strips the debug oracles, and tightens CSP.

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

**Dependency hygiene:**

- [ ] **AC-1** `next` upgraded to a version with **zero HIGH advisories** (`pnpm audit --prod` shows no HIGH/CRITICAL for `next`). Target **15.5.x**; if the App-Router major bump is not feasible in this PRD's window, pin to the latest `14.2.x` patch that clears the HIGH DoS/SSRF advisories and open a follow-up to reach 15.x. Decision recorded in §13 OQ-1.
- [ ] **AC-1a** `pnpm build` + `pnpm typecheck` green after the bump; storefront, tenant-admin, and super-admin smoke paths manually verified (App-Router behaviour differences checked).

**Local secret purge + rotation:**

- [ ] **AC-2** `env.windows-dev` deleted from disk. A `.env.example` (values redacted) documents the required variable **names** only.
- [ ] **AC-2a** `ENCRYPTION_KEY`, `DRGREEN_SECRET_KEY`, `CLERK_SECRET_KEY`, `AWS_SECRET_ACCESS_KEY`, and the `DATABASE_URL` password are **rotated** in Railway (prod + staging). Because `ENCRYPTION_KEY` decrypts tenant Dr Green keys, rotation follows the key-version procedure in PRD-211 (decrypt-with-old → re-encrypt-with-new), not a hard swap.
- [ ] **AC-2b** `git log --all --full-history -- '*env.windows-dev*'` confirmed empty and recorded in the PR description (proof no history scrub is required).

**`legacyCss` XSS:**

- [ ] **AC-3** `app/store/[slug]/layout.tsx:331` wraps `legacyCss` in `sanitizeCss(...)`, identical to the `customCss` path at `:323`. No raw `legacyCss` reaches `dangerouslySetInnerHTML`.
- [ ] **AC-3a** `sanitizeCss()` in `lib/css-utils.ts` is unit-tested against `</style><script>`, `expression(...)`, `url(javascript:...)`, `@import url(//evil)`, and CSS-comment-break payloads — all neutralised.
- [ ] **AC-3b** A repo-wide grep test asserts **no** `dangerouslySetInnerHTML` passes a `*Css`/`*css*` variable that is not wrapped in `sanitizeCss(...)`.

**Email-template HTML:**

- [ ] **AC-4** `app/api/super-admin/email-templates/route.ts` POST/PUT sanitise the HTML body with the existing `sanitize-html` allow-list (headings, links, basic formatting; no `<script>`, no event handlers, no `javascript:` hrefs) before persistence. Zod-validate the payload shape.

**Error redaction:**

- [ ] **AC-5** Every client-facing route returns errors through `apiError(code, status)` from `lib/api-error.ts`. No handler returns `error.message`, `String(error)`, or `JSON.stringify(error)` in the body. The raw error is `console.error`-logged server-side with a correlation id (until PRD-215's structured logger lands).
- [ ] **AC-5a** Grep test: zero occurrences of `error.message` / `err.message` inside a `NextResponse.json(...)` / `Response.json(...)` argument across `app/api/**`.

**Info-leak endpoints:**

- [ ] **AC-6** `app/api/health/route.ts` returns only `{ status: 'ok' }` (+ a 200/503) to unauthenticated callers. Memory, uptime, version, and per-service detail are returned **only** when a valid `HEALTH_DETAIL_TOKEN` bearer header is present (used by uptime monitoring), or removed entirely if not needed.
- [ ] **AC-7** `drgreen-keys/route.ts` GET response drops `base64DecodedLen`, `base64DecodedFirstByteHex`, and `base64DecodedAsTextStart`. It may return a boolean `{ configured: true, looksValid: boolean }` only — never any byte of decoded key material. The decode-debug block (`:53-80`) is deleted.

**CSP hardening:**

- [ ] **AC-8** CSP `script-src` drops `'unsafe-inline'` in favour of a per-request nonce (Next.js `headers()` + nonce propagation to `<Script>`). `frame-ancestors 'self'` for storefront, `'none'` for admin. `object-src 'none'`. Any deviation (e.g. a third-party widget needing inline) documented in §13.

## 4.1 Design framework conformance

No new UI surfaces. The `legacyCss` fix is server-side; CSP nonces are infrastructural. Storefront visual output is unchanged (sanitiser already runs on `customCss` with no reported regressions).

- [x] No new tokens / primitives — N/A
- [x] Data-driven template rule respected — no template-specific value added to platform code
- [x] Storefront render unchanged post-sanitise — manual visual diff on 2 live tenants

## 5. Scope

**In scope:** Next.js bump; `env.windows-dev` delete + key rotation; `legacyCss` sanitisation; email-template HTML sanitisation; `apiError()` rollout for leaked errors; health + drgreen-keys debug-leak removal; CSP nonce migration.

**Out of scope:**
- CSRF on destructive super-admin routes → PRD-201.
- Tenant-context concurrency → PRD-202.
- The broad input-validation sweep (Zod everywhere) → PRD-204 (this PRD only Zod-validates the email-template body it touches).
- Structured logging / PII redaction in logs → PRD-215.
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

**Grep gates (also wired into PRD-216 CI):**
- No unwrapped CSS `dangerouslySetInnerHTML` (AC-3b).
- No `error.message` in API response bodies (AC-5a).

**Coverage target:** 90% on `css-utils.ts` + `api-error.ts` (security-critical).

## 13. Open questions

- [ ] **OQ-1** Next.js **15.5.x major bump vs 14.2.x patch** — does the App Router code hit breaking changes (e.g. `cookies()`/`headers()` async, caching defaults)? Owner: Gerard. Resolution: attempt 15.5.x on a worktree; fall back to latest 14.2.x patch that clears HIGH advisories if regressions are non-trivial, with a follow-up ticket to reach 15.x.
- [ ] **OQ-2** Does any storefront template legitimately rely on inline `<script>` (blocking the CSP nonce migration)? Owner: Gerard. Resolution: audit `defaults.json`/template HTML; nonce-tag or hash any legitimate inline.
- [ ] **OQ-3** Is `legacyCss` still needed at all, or can the `customCss` path subsume it? Owner: Gerard. Resolution: if legacy templates are migrated, delete the `legacyCss` branch outright (best fix).
- [ ] **OQ-4** `HEALTH_DETAIL_TOKEN` vs internal-only port for health detail — which fits Railway? Owner: Gerard.

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
