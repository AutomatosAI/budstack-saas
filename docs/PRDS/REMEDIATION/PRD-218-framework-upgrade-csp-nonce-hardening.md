# PRD-218 — Framework Upgrade & CSP Nonce Hardening (split from PRD-200)

> **Status:** Proposed
> **Phase:** R1 — Pre-Production Blocker (the deferred infra slice of PRD-200)
> **Severity:** HIGH (Next.js advisories) + MEDIUM (CSP hardening)
> **Module(s) touched:** `package.json`, `pnpm-lock.yaml`, `next.config.js`, `middleware.ts`, `<Script>` usages across `app/**`, the CSP header source
> **Depends on:** PRD-200 (code-level edge hardening) shipped — this PRD owns the two items PRD-200 could not safely auto-apply.
> **Blocks:** Treating any environment as production — the HIGH DoS/SSRF advisories on 14.2.35 stay open until AC-1.
> **Owner:** Gerard (major-bump decision + smoke sign-off) + Claude (implementation).
> **Last updated:** 2026-05-29

---

## 1. Problem

PRD-200 shipped the code-level HTTP-edge fixes (`legacyCss` XSS, email-template HTML sanitisation, error redaction, health + drgreen-keys info-leaks, the local `env.windows-dev` purge). Two findings from the **same** review are infrastructural — they carry breaking-change risk and need a human decision plus manual smoke testing, so they were deliberately kept out of the code-fix PR. This PRD owns them so PRD-200 can close cleanly.

1. **Next.js dependency advisories (HIGH, not auth-bypass).** We run **14.2.35**. `CVE-2025-29927` (middleware authorization bypass) was fixed in **14.2.25** and targets the **Pages** router — we are clear (App Router). The advisories that *do* apply to 14.2.35 are **HIGH** DoS (Server Components / HTTP request deserialization), **HIGH** SSRF in server actions, and **LOW** cache-poisoning — all cleared at **15.5.x**. Dependency hygiene with a real DoS exposure, not an open auth hole.

2. **CSP retains `script-src 'unsafe-inline'` (MEDIUM, hardening).** The current CSP allows inline scripts, which negates much of CSP's XSS value. Moving to per-request nonces (or hashes) means a missed injection sink — a PRD-200-class finding — still cannot execute.

These were carved out so PRD-200 could ship the safe code fixes immediately. Both need Gerard's go: the major-bump path (OQ-1) and the inline-script audit (OQ-2).

## 2. Users / personas

| Role | How they benefit |
|---|---|
| **Storefront customer** | A missed XSS sink cannot execute under a nonce-based CSP |
| **Prospective enterprise tenant** | The dependency-advisory + CSP rows in a security questionnaire pass |
| **Gerard / ops** | The running Next.js carries zero HIGH advisories; CSP is defensible |

## 3. User stories

- As an **attacker**, a Next.js DoS/SSRF advisory I find in a scanner is already patched on the running version.
- As an **attacker**, even if I find an un-sanitised sink, my injected `<script>` is blocked because it lacks the per-request nonce.

## 4. Acceptance criteria

**Framework upgrade:**

- [ ] **AC-1** `next` upgraded to a version with **zero HIGH advisories** (`pnpm audit --prod` shows no HIGH/CRITICAL for `next`). Target **15.5.x**; if the App-Router major bump is not feasible in this PRD's window, pin to the latest `14.2.x` patch that clears the HIGH DoS/SSRF advisories and open a follow-up to reach 15.x. Decision recorded in §9 OQ-1.
- [ ] **AC-1a** `pnpm build` + `pnpm typecheck` green after the bump; storefront, tenant-admin, and super-admin smoke paths manually verified (App-Router behaviour differences — async `cookies()`/`headers()`, caching defaults, middleware rewrites — checked).

**CSP hardening:**

- [ ] **AC-2** CSP `script-src` drops `'unsafe-inline'` in favour of a per-request nonce (Next.js middleware/`headers()` nonce propagated to `<Script>`). `frame-ancestors 'self'` for storefront, `'none'` for admin. `object-src 'none'`.
- [ ] **AC-2a** Every legitimate inline `<script>` (template embeds, analytics) is enumerated and either nonce-tagged or hash-allowed; any deviation documented in §9 OQ-2.
- [ ] **AC-2b** Smoke pass confirms storefront browse → checkout and admin login → dashboard still function with the tightened CSP (zero CSP violations in the console on the golden paths).

## 5. Scope

**In scope:** Next.js version bump + smoke; CSP nonce migration.

**Out of scope:**
- All PRD-200 code fixes (shipped).
- Other dependency upgrades (Clerk / nodemailer / handlebars) → existing `security/phase-8` work + PRD-216.
- CI dependency automation (Dependabot / CodeQL / `pnpm audit` gate) → PRD-216.

## 6. Non-functional requirements

| NFR | Requirement |
|---|---|
| Backward compatibility | Bump must not regress storefront/admin render or middleware subdomain rewrites |
| Security | Zero HIGH/CRITICAL `next` advisories post-bump; no `'unsafe-inline'` in `script-src` |
| Reversibility | Attempt the bump on a worktree first; keep the CSP nonce change behind a quick revert if a golden path breaks |

## 7. Success metrics

- `pnpm audit --prod` HIGH/CRITICAL count for `next` = **0**.
- CSP response header carries a per-request `'nonce-…'` and no `'unsafe-inline'` in `script-src`.
- Golden-path smoke (storefront browse → checkout; admin login → dashboard) clean of CSP violations.

## 8. Test plan

- `pnpm build` + `pnpm typecheck` green post-bump.
- Manual smoke: storefront, tenant-admin, super-admin (focus on App-Router behaviour diffs).
- CSP: load storefront + admin; assert no CSP violations in console; assert the header has a nonce and no `'unsafe-inline'` in `script-src`.
- Automated golden-path CSP regression lands with PRD-207 (Playwright).

## 9. Open questions

- [ ] **OQ-1** Next.js **15.5.x major bump vs latest 14.2.x patch** — does App-Router code hit breaking changes (async `cookies()`/`headers()`, caching defaults, `next/image`)? Owner: Gerard. Resolution: attempt 15.5.x on a worktree; fall back to the latest 14.2.x patch that clears the HIGH advisories, with a follow-up ticket to reach 15.x.
- [ ] **OQ-2** Does any storefront template legitimately rely on inline `<script>` (which would block a strict nonce migration)? Owner: Gerard. Resolution: audit `defaults.json` / template HTML; nonce-tag or hash any legitimate inline before tightening.

## 10. Dependencies

**Strict:** PRD-200 shipped (code-level edge hardening) — so the only remaining HTTP-edge exposure is the framework version + CSP layer this PRD closes.

**Soft:**
- PRD-207 (Vitest + Playwright) — automated golden-path CSP regression once the harness exists.
- PRD-216 (CI/CD security gates) — re-runs `pnpm audit` on every PR so the advisory count cannot silently regress.

## 11. Estimated effort

- Next.js bump + smoke: **5 h** (more if 15.x major surfaces breakage)
- CSP nonce migration: **3 h**
- **Total:** ≈ **1 day** (+1 day if the Next 15 major bump is taken)

## 12. References

- Split from [PRD-200](./PRD-200-critical-security-hardening.md) AC-1 / AC-1a / AC-8.
- Advisories: Next.js Server Components DoS + SSRF (apply to 14.2.35); `CVE-2025-29927` (already patched in 14.2.25, N/A to us).
- [MDN CSP nonces](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/script-src)

## 13. Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-05-29 | Claude (Opus 4.8) | Split AC-1 / AC-1a / AC-8 out of PRD-200 so the code-level fixes could ship immediately; framed as the deferred framework-upgrade + CSP-nonce infra slice that needs Gerard's bump decision and inline-script audit. |
