# PRD-201 — Destructive Super-Admin Endpoint Removal & CSRF Defence-in-Depth

> **Status:** Proposed
> **Phase:** R1 — Pre-Production Blocker
> **Severity:** MEDIUM _(down-rated from the first-pass "CRITICAL CSRF" — see [Pre-flight verification](./REMEDIATION-INDEX.md#pre-flight-verification--2026-05-29). The destructive routes are SUPER_ADMIN-gated and Clerk's `SameSite=Lax` cookie blunts the classic `<img>`/auto-submit CSRF vector. The real defect is **debug scaffolding still shipped in production** plus missing defence-in-depth — quick to fix, but not a live one-click-wipe)_
> **Module(s) touched:** `app/api/super-admin/tenants/reset-templates/route.ts` (delete), `app/api/super-admin/**/cleanup-s3*`, destructive super-admin route handlers, `lib/reserved-subdomains.ts` (or wherever `RESERVED_SUBDOMAINS` lives), a new `lib/security/require-same-origin.ts`
> **Depends on:** None.
> **Blocks:** Confidence that a stolen/again-authenticated super-admin session cannot be cross-site-tricked into destructive actions.
> **Owner:** Gerard + Claude.
> **Last updated:** 2026-05-29

---

## 1. Problem

The first pass rated this CRITICAL ("destructive GET CSRF"). Reading the code down-rates it:

- **It is auth-gated.** `app/api/super-admin/tenants/reset-templates/route.ts` opens with `if (!user || user.role !== "SUPER_ADMIN") return 401`. Only a logged-in super-admin can trigger it.
- **Clerk blunts CSRF.** Sessions ride a `SameSite=Lax` cookie, so a cross-site `<img src=…?confirm=yes>` or auto-submitting form does **not** send the session on a top-level cross-site request in modern browsers. The classic CSRF chain is largely defeated already.

But three genuine defects remain, and they are cheap to fix:

1. **Debug scaffolding shipped to production.** The route's own header comment says *"ONE-TIME CLEANUP ROUTE — DELETE AFTER USE."* It was never deleted. It performs a **destructive S3 + DB wipe** on `GET ?subdomain=X&confirm=yes` (and `POST` just calls the same `GET` handler). A destructive action behind a **GET** is wrong regardless of CSRF: it is reachable by prefetchers, link-scanners, browser history replay, and server-log shoulder-surfing. Given the template-delete incident on 2026-04-29 (3 LekkerWeed clones wiped, recovered via S3 versioning), a live one-time-wipe route is exactly the class of thing that should not exist.
2. **Internal `steps[]` trace leaked.** The handler returns a `steps[]` array describing each S3/DB operation it performed — internal bucket prefixes, tenant ids, and operation order — to the caller.
3. **`RESERVED_SUBDOMAINS` not enforced on rename, and `_cd` missing from the list.** Super-admin tenant **rename** does not re-check `RESERVED_SUBDOMAINS`, so a tenant can be renamed onto a reserved/structural slug. The custom-domain placeholder `_cd` (used by the middleware rewrite, see PRD-212) is **not** in `RESERVED_SUBDOMAINS`, so a tenant could claim `_cd` and collide with the routing internals.

This PRD **deletes** the one-time wipe route, adds **same-origin/defence-in-depth** checks to the remaining destructive super-admin endpoints, converts any destructive `GET` to an explicit `POST` with a typed confirmation body, stops leaking `steps[]`, and closes the `RESERVED_SUBDOMAINS` gaps.

## 2. Users / personas

| Role | How they benefit |
|---|---|
| **Super-admin** | Destructive actions require an explicit POST + confirmation; no accidental trigger via a prefetched link |
| **Tenant** | Cannot be renamed onto a reserved/structural slug; `_cd` collision impossible |
| **Incident responder** | One fewer "one-click wipe" route in the attack/oops surface; no `steps[]` topology leak |

## 3. User stories

- As a **super-admin**, the leftover one-time cleanup route is gone; the supported way to reset a tenant's templates is an audited, POST-only, body-confirmed admin action.
- As an **attacker** with a cross-site foothold, even if `SameSite` were ever relaxed, a destructive super-admin endpoint rejects my request because the `Origin`/`Sec-Fetch-Site` header is not same-origin.
- As an **operator**, a destructive endpoint never echoes the internal step-by-step S3/DB trace back to the browser.

## 4. Acceptance criteria

**Remove the scaffolding:**

- [ ] **AC-1** `app/api/super-admin/tenants/reset-templates/route.ts` is **deleted**. If a supported "reset a tenant's templates to base" capability is still needed, it is reimplemented as a POST-only handler (AC-3) guarded by the template-delete protections from the 2026-04-29 incident PR (force + cascade flags, S3-versioning-safe).
- [ ] **AC-1a** Any `cleanup-s3`-style route with an over-broad prefix is scoped to a single tenant path (`tenants/{tenantId}/…`) and cannot target a bare/base prefix.

**Destructive routes → POST + confirmation + same-origin:**

- [ ] **AC-2** No destructive (delete/reset/purge) super-admin action is reachable via `GET`. Audit `app/api/super-admin/**` for `GET` handlers that mutate/delete; convert each to `POST`/`DELETE`.
- [ ] **AC-3** Each destructive handler requires a typed JSON body confirmation (e.g. `{ confirm: "<tenantSlug>" }` that must match the target) — Zod-validated — not a `?confirm=yes` query flag.
- [ ] **AC-4** A reusable `requireSameOrigin(req)` guard (`lib/security/require-same-origin.ts`) rejects state-changing super-admin requests whose `Origin` (or `Sec-Fetch-Site: same-origin`) header is absent/cross-site, returning `403 CROSS_ORIGIN_BLOCKED`. Applied to all destructive super-admin handlers as defence-in-depth on top of Clerk's `SameSite`.

**Stop the leak:**

- [ ] **AC-5** Destructive handlers do not return an internal `steps[]`/operation-trace array to the client. They return `{ success, summary: { deleted: n } }`; the detailed trace is `console.error`/audit-logged server-side only.

**Reserved subdomains:**

- [ ] **AC-6** `RESERVED_SUBDOMAINS` includes `_cd` and any other routing-structural placeholders (audit `middleware.ts` rewrites for the full set).
- [ ] **AC-7** Super-admin tenant **rename** re-runs the `RESERVED_SUBDOMAINS` + format check (same validation as create), rejecting reserved/invalid slugs with `400 RESERVED_SUBDOMAIN`.

**Audit:**

- [ ] **AC-8** Every destructive super-admin action writes an audit row (actor, target tenant, action, timestamp). (Until the audit hash-chain in PRD-208 lands, a structured `console.error` audit line is acceptable.)

## 4.1 Design framework conformance

No storefront UI. Super-admin destructive actions gain a typed confirmation modal (reuse existing admin dialog primitive) — no new design tokens.

- [x] Reuse existing admin dialog/confirm primitive — N/A new tokens
- [x] No template-specific values introduced

## 5. Scope

**In scope:** delete the one-time reset-templates route; scope `cleanup-s3`; convert destructive GETs to POST+confirm; `requireSameOrigin` guard; remove `steps[]` leak; `RESERVED_SUBDOMAINS` `_cd` + rename enforcement; destructive-action audit lines.

**Out of scope:**
- A full double-submit CSRF token framework — unnecessary given `SameSite=Lax` + same-origin checks; revisit only if cookie policy changes.
- The broad `withSuperAdmin` wrapper rollout → PRD-203 (this PRD hardens the destructive subset; PRD-203 generalises auth wrapping).
- Custom-domain `_cd` cache-isolation fix → PRD-212 (this PRD only reserves the slug).

## 6. Non-functional requirements

| NFR | Requirement |
|---|---|
| Safety | No destructive action without an explicit POST + matching confirmation token |
| Defence-in-depth | Same-origin check independent of Clerk's `SameSite` (survives a future cookie-policy change) |
| Least disclosure | No internal operation trace in responses |
| Auditability | Every destructive action attributable to an actor |

## 7. Success metrics

- Zero destructive super-admin actions reachable via `GET` (route inventory).
- `reset-templates/route.ts` no longer exists.
- 100% of destructive super-admin handlers call `requireSameOrigin`.
- `_cd` present in `RESERVED_SUBDOMAINS`; rename rejects reserved slugs (test).
- Zero `steps[]` arrays in destructive responses.

## 8. API surface

| Method | Path | Change |
|---|---|---|
| ~~GET~~ | ~~`/api/super-admin/tenants/reset-templates`~~ | **Deleted** |
| POST | `/api/super-admin/tenants/[id]/reset-templates` | (If retained) POST-only, `{ confirm }` body, same-origin, audited |
| POST/DELETE | destructive super-admin routes | `requireSameOrigin` + typed confirmation |

New error codes: `CROSS_ORIGIN_BLOCKED` (403), `RESERVED_SUBDOMAIN` (400), `CONFIRMATION_MISMATCH` (400).

## 9. Data model changes

None (audit rows reuse existing logging until PRD-208's audit table hardening).

## 10. Events emitted / consumed

| Event | Direction | Payload | Subscribers |
|---|---|---|---|
| `superadmin.destructive_action` | emit | `{ actorId, action, targetTenantId, summary }` | audit / logs |
| `superadmin.cross_origin_blocked` | emit | `{ actorId, route }` | logs (alert in PRD-215) |

## 11. UI / UX

Super-admin destructive buttons open a confirmation dialog requiring the operator to type the tenant slug (matches AC-3 body). Reuses the existing admin dialog component.

## 12. Test plan

**Unit (Vitest):**
- `require-same-origin.test.ts` — same-origin passes; cross-site / missing-Origin rejected with 403.
- `reserved-subdomains.test.ts` — `_cd` reserved; rename validation rejects reserved + malformed slugs.

**Integration:**
- `super-admin-destructive.route.test.ts` — destructive endpoint: GET → 405/404; POST without `confirm` → 400; POST cross-origin → 403; POST same-origin + matching confirm → 200 and **no** `steps[]` in body.
- `tenant-rename.route.test.ts` — rename to `_cd` / reserved → 400.

**E2E (Playwright):**
- `super-admin-reset.spec.ts` — confirm dialog requires typed slug; cancel aborts; success shows summary only.

**Coverage target:** 90% on the security guard + reserved-subdomain modules.

## 13. Open questions

- [ ] **OQ-1** Is a "reset tenant templates to base" capability still operationally needed, or can it be retired entirely (best outcome)? Owner: Gerard. Resolution: confirm with ops; if retired, AC-1's POST reimplementation is dropped.
- [ ] **OQ-2** Should `requireSameOrigin` apply to **all** super-admin mutations or only destructive ones? Owner: Gerard. Resolution: all mutations (cheap, consistent) unless a legitimate cross-origin caller exists.
- [ ] **OQ-3** Full `RESERVED_SUBDOMAINS` set — enumerate every middleware routing placeholder beyond `_cd`. Owner: Gerard + Claude (grep `middleware.ts`).

## 14. Dependencies

**Strict:** None.

**Soft:**
- PRD-203 (auth wrappers) — `requireSameOrigin` should compose cleanly with the eventual `withSuperAdmin` wrapper.
- PRD-208 (audit table) — destructive-action audit rows graduate from `console.error` to the tamper-evident audit table.
- PRD-212 (custom-domain cache) — consumes the `_cd` reservation.

## 15. Estimated effort

- **Delete route + scope cleanup-s3:** 1 hour
- **GET→POST+confirm conversions + `requireSameOrigin`:** 3 hours
- **`steps[]` removal + audit lines:** 1 hour
- **`RESERVED_SUBDOMAINS` `_cd` + rename enforcement:** 1 hour
- **Tests:** 2 hours
- **Total:** ≈ 8 hours (≈ 1 day for 1 dev + Claude pair)

## 16. References

- Existing code: `app/api/super-admin/tenants/reset-templates/route.ts` (header "DELETE AFTER USE"; `steps[]`), `middleware.ts` (subdomain/`_cd` rewrites), `RESERVED_SUBDOMAINS` source
- Incident: `project_template_delete_incident_2026_04_29.md` (super-admin DELETE wiped 3 clones; PR #81 protections) — the precedent for treating destructive admin routes as high-blast-radius
- Standards: [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) (SameSite + same-origin), [MDN `Sec-Fetch-Site`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Sec-Fetch-Site)
- 2026-05-29 review: original C3 (re-rated MEDIUM), `RESERVED_SUBDOMAINS` findings

## 17. Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-05-29 | Claude (with Gerard) | Initial draft. |
| 0.2 | 2026-05-29 | Claude (Opus 4.8) | Severity down-rated CRITICAL→MEDIUM after verifying SUPER_ADMIN gate + Clerk `SameSite=Lax`; reframed from "build CSRF tokens" to "delete debug scaffolding + add same-origin defence-in-depth". |
