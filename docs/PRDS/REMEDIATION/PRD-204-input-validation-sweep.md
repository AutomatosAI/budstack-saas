# PRD-204 — Input Validation Sweep (Zod everywhere, `parseUuid` helper, prototype-pollution fix, body caps)

> **Status:** Proposed
> **Phase:** R2 — Tenant Isolation Foundation
> **Severity:** HIGH _(no single confirmed RCE, but a stack of "trust the input" gaps — raw path-param ids into Prisma, an unguarded recursive `deepMerge`, un-validated PATCH bodies, no body-size cap — that together are exactly the class a pentest enumerates first. See [Pre-flight verification](./REMEDIATION-INDEX.md#pre-flight-verification--2026-05-29).)_
> **Module(s) touched:** `lib/utils.ts` (`deepMerge`), a new `lib/validation/parse-uuid.ts`, a new `lib/validation/body.ts` (size caps + parse helper), `app/api/customer/profile/route.ts`, `app/api/super-admin/tenants/[id]/route.ts`, and the ~41 dynamic-segment route files plus the ~50 body-accepting routes under `app/api/**`
> **Depends on:** Soft on **PRD-203** (validation runs inside the wrapped handler — land them together to touch each route once) and **PRD-207** (test harness). Feeds **PRD-208** (typed `tenant.settings` builds on the Zod schemas defined here).
> **Blocks:** PRD-208 (schema hardening reuses the `tenant.settings` Zod schema this PRD introduces).
> **Owner:** Gerard + Claude. Security sign-off: Gerard.
> **Last updated:** 2026-05-29

---

## 1. Problem

The project's own coding rule is "validate all user input at system boundaries with Zod" — but only **6 of 107** API routes import `zod`. The rest trust the wire. Four concrete gaps:

1. **Path-param ids go straight into Prisma `where` clauses with no shape check.** There are **17 dynamic route directories** (`[id]`, `[slug]`, `[orderId]`) covering **~41 route files**. None validates the segment before use. For example `app/api/super-admin/tenants/[id]/route.ts` uses `params.id` directly in `where: { id: params.id }` at lines `:21, :91, :117, :270, :313, :376, :382`, and `app/api/tenant-admin/customers/[id]/route.ts` does the same at `:47, :175, :298, :449, :471` (and even interpolates it into a string at `:473`: `` `deleted-${params.id}@deleted.com` ``). A malformed id is at best a noisy Prisma error returned to the client (info leak — PRD-200), at worst an unintended lookup; either way it is unvalidated external input reaching the data layer. The fix is a tiny `parseUuid()` helper applied at the top of every id/slug handler.

2. **`deepMerge(any, any): any` has no prototype-pollution filter.** `lib/utils.ts:12` recurses over `Object.keys(overrides)` and assigns into a fresh object, but it **does not skip `__proto__`, `constructor`, or `prototype` keys**:

   ```ts
   // lib/utils.ts:12
   export function deepMerge(base: any, overrides: any): any {
     if (!base) return overrides;
     if (!overrides) return base;
     const result = { ...base };
     for (const key of Object.keys(overrides)) {       // ← no key allow/deny-list
       const val = overrides[key];
       if (val && typeof val === 'object' && !Array.isArray(val)) {
         result[key] = deepMerge(base[key], val);       // ← recurses into attacker-shaped keys
       } else if (val !== undefined && val !== null && val !== '') {
         result[key] = val;
       }
     }
     return result;
   }
   ```

   It is called on **attacker-influenced data**: `app/api/tenant-admin/branding/route.ts:231` merges into `designSystem` and `:430` merges `settings.pageContent` from the request body. `Object.keys` does not enumerate `__proto__` on a normal object literal, but a JSON body parsed with a `"__proto__"` key, or a `"constructor"/"prototype"` chain, can still poison the result object's prototype on the recursive branch. On a persistent Node process (Railway), a successful pollution is process-wide. Fix: an explicit `DANGEROUS_KEYS` deny-list (`__proto__`, `constructor`, `prototype`) skipped on every level, plus `Object.create(null)` accumulators where practical.

3. **`customer/profile` PATCH accepts an unbounded, unvalidated body.** `app/api/customer/profile/route.ts:75-76` does `const body = await request.json(); const { firstName, lastName, phone, address } = body;` then writes them straight to Prisma at `:88-97`. **No Zod, no length caps** on `firstName`/`lastName`/`phone`, and `address` is a free-form `Json` column written verbatim — a client can store an arbitrarily large/odd blob. (This route's missing tenant scope is fixed in PRD-203; this PRD adds the *shape/size* validation.)

4. **Super-admin tenant PATCH `settings` blob is unvalidated.** `app/api/super-admin/tenants/[id]/route.ts:78-87` destructures `settings` (among others) from the body with no schema; it later merges into the tenant's `settings` JSON. `settings` drives domain provisioning, Clerk-org mapping, Railway DNS records, branding — a malformed or hostile blob has broad blast radius. Needs a strict Zod schema (the same one PRD-208 will reuse to type `tenant.settings` on read).

Underlying all four: **there is no request body-size cap.** No `bodyParser.sizeLimit`/route `config` exists; `request.json()` is called ~56 times across `app/api` with no upstream limit, so any route is a trivial memory-pressure DoS vector (compounding the Next.js Server-Components DoS advisory in PRD-200).

This PRD: adds `parseUuid()` and applies it to all id/slug handlers; hardens `deepMerge` against prototype pollution; Zod-validates every body-accepting route (starting with `customer/profile` PATCH and super-admin tenant `settings`); and adds a shared body-size cap helper used at every `request.json()` boundary.

## 2. Users / personas

| Role | How they benefit |
|---|---|
| **Every tenant** | Malformed/hostile input is rejected at the edge with a clean 400, never reaching Prisma or polluting a shared prototype |
| **Storefront customer** | Profile fields have sane caps; a bad request gets a clear validation error, not a 500 |
| **Gerard / ops** | A `__proto__` payload cannot poison the persistent Node process; oversized bodies cannot exhaust memory |
| **Developer** | One `parseUuid(params.id)` line and one Zod `schema.parse(body)` line per route — a documented, copy-safe pattern |
| **Enterprise prospect** | "All inputs validated with a schema library; prototype pollution and body-size DoS explicitly mitigated" is demonstrable |

## 3. User stories

- As an **attacker**, a request with a malformed `[id]` returns a generic `400 Invalid request`, not a Prisma error string revealing the schema.
- As an **attacker**, a JSON body containing `"__proto__": { … }` or a `constructor.prototype` chain is stripped by `deepMerge` and cannot alter object prototypes.
- As a **customer**, if I submit a 10 MB `address` blob, I get a `413`/`400`, not a silent write.
- As a **developer**, I reach for `parseUuid` / the shared Zod body helper and cannot accidentally pass raw input to Prisma.

## 4. Acceptance criteria

**`parseUuid` helper + rollout:**

- [ ] **AC-1** A `parseUuid(value: string): string` helper in `lib/validation/parse-uuid.ts` validates against the UUID format (the id format Prisma uses for these models) and **throws `ApiError(…, 400)`** (from `lib/api-error.ts`) on failure, so the wrapper's `apiError()` returns a clean generic 400.
- [ ] **AC-1a** Every dynamic-segment route handler (the ~41 files under the 17 `[id]`/`[slug]`/`[orderId]` directories) validates the segment via `parseUuid()` (or a documented `parseSlug()` for the genuinely-string `[slug]` storefront routes) **before** it is used in any Prisma call or string interpolation. Specifically including `super-admin/tenants/[id]` (`:21,91,117,270,313,376,382`) and `tenant-admin/customers/[id]` (`:47,175,298,449,471,473`).
- [ ] **AC-1b** A CI grep/AST gate (PRD-216) flags any `params.id`/`params.slug` used in a Prisma `where`/template string without a preceding `parseUuid`/`parseSlug`.

**`deepMerge` prototype-pollution fix:**

- [ ] **AC-2** `deepMerge` (`lib/utils.ts:12`) skips the keys `__proto__`, `constructor`, and `prototype` at **every** recursion level (a shared `DANGEROUS_KEYS` set), and never assigns onto the object's prototype. Behaviour for all legitimate keys is unchanged (the existing "override wins unless undefined/null/empty-string" + "arrays replace" semantics are preserved).
- [ ] **AC-2a** Unit tests prove `deepMerge(base, JSON.parse('{"__proto__":{"polluted":true}}'))` does **not** set `({}).polluted`, and the same for `constructor.prototype` chains and nested occurrences.
- [ ] **AC-2b** The two attacker-reachable call sites (`branding/route.ts:231,430`) are covered by an integration test feeding a pollution payload through the real route.

**Zod at every body boundary:**

- [ ] **AC-3** `customer/profile` PATCH (`route.ts:75-76`) validates the body with a Zod schema: `firstName`/`lastName` length-capped (e.g. ≤ 100), `phone` pattern + length-capped, `address` a typed object with capped string fields — not free-form. Invalid → `apiValidationError(...)` 400.
- [ ] **AC-4** `super-admin/tenants/[id]` PATCH `settings` (`route.ts:78-87`) validates `settings` against a **strict** Zod schema (`.strict()` — unknown keys rejected) covering the known settings shape (clerkOrgId, railway*, domain*, branding). This schema lives in `lib/validation/tenant-settings.ts` and is **exported for reuse by PRD-208** (typed `tenant.settings` on read).
- [ ] **AC-5** The remaining body-accepting routes under `app/api/**` validate their request body with a route-local Zod schema at the top of the handler. Routes already using Zod (`signup`, `onboarding`, `tenant-admin/posts`, `auth/reset-password`, `consultation/submit`, `tenant-admin/posts/[id]`) are confirmed compliant; the rest are migrated.

**Body-size caps:**

- [ ] **AC-6** A shared `parseJsonBody(req, schema, { maxBytes })` helper in `lib/validation/body.ts` enforces a default max body size (e.g. 256 KB for JSON; a larger documented cap for upload/multipart routes) **before** parsing, returning `413`/`400` if exceeded, then runs the Zod `schema.parse`. The ~56 `request.json()` sites adopt it.
- [ ] **AC-6a** Upload routes (multipart) keep their existing magic-byte validation (`lib/upload-validation.ts`) and additionally enforce a documented max file size; the JSON cap does not apply to multipart.

## 4.1 Design framework conformance

No UI surface. Validation is server-side. No template-specific values introduced — the `tenant-settings` schema describes structural keys (clerkOrgId, railway ids, domain), **never** template names/logos/colors/slugs (those remain S3-sourced per the data-driven rule).

- [x] No new tokens / primitives — N/A
- [x] Data-driven template rule respected — settings schema holds no template content
- [x] Validation failures use `apiValidationError()` from `lib/api-error.ts`

## 5. Scope

**In scope:** `parseUuid`/`parseSlug` helpers + rollout to all dynamic routes; `deepMerge` prototype-pollution fix; Zod schemas for `customer/profile` PATCH and super-admin tenant `settings`; Zod on remaining body routes; shared body-size-capped JSON parse helper.

**Out of scope:**
- Tenant-scoping `customer/profile` (the missing `tenantId` filter) → PRD-203. This PRD adds *shape/size* validation only.
- Typing `tenant.settings` on **read** (`as any` × 35) → PRD-208 (it consumes the schema this PRD exports).
- The auth wrappers themselves → PRD-203.
- CSS/HTML sanitisation (`legacyCss`, email-template HTML) → PRD-200.

## 6. Non-functional requirements

| NFR | Requirement |
|---|---|
| Security | No raw path param reaches Prisma; `deepMerge` cannot pollute prototypes; body size bounded on every JSON route |
| Correctness | `deepMerge` legitimate-merge behaviour byte-identical to today for non-dangerous keys |
| Performance | `parseUuid` is a regex check (µs); Zod parse on small bodies < 1 ms; size check is pre-parse and O(1) on content-length |
| Backward compatibility | Valid existing requests still succeed unchanged; only malformed/oversized/hostile inputs now 400/413 |
| Consistency | All validation errors use `apiValidationError()` — uniform 400 envelope |

## 7. Success metrics

- Dynamic-route files using `parseUuid`/`parseSlug`: **100%** of the ~41 (up from 0).
- `pnpm audit`-style prototype-pollution unit suite on `deepMerge`: **all pass** (pollution blocked).
- API routes importing/using Zod on their body: **all body-accepting routes** (up from 6).
- Zero `request.json()` calls without a size cap (CI gate, PRD-216).
- No Prisma error string returned to a client for a malformed id (covered by PRD-200's error-redaction gate).

## 8. API surface

No change to valid request/response shapes. New rejection behaviour:

| Method | Path | New behaviour |
|---|---|---|
| (any) | `/api/**/[id]` etc. | Malformed id → `400 Invalid request` (was: Prisma error / 500) |
| PATCH | `/api/customer/profile` | Over-length/odd body → `400` with field error |
| PATCH | `/api/super-admin/tenants/[id]` | Unknown/invalid `settings` keys → `400` (strict schema) |
| (any) | body routes | Body > cap → `413`/`400` |

## 9. Data model changes

None. The `tenant-settings` Zod schema is a **validation artifact** (it describes the existing `settings Json?` column); PRD-208 decides whether to promote any of it to typed columns.

## 10. Events emitted / consumed

| Event | Direction | Payload | Subscribers |
|---|---|---|---|
| `security.prototype_pollution_blocked` | emit (log) | `{ route, blockedKey }` | logs / alert (PRD-215) — should be **zero** in steady state |
| `validation.body_rejected` | emit (log) | `{ route, reason }` | logs (PRD-215); high rate may indicate a misbehaving client or probe |

(No event bus yet — log lines today; PRD-215 formalises them.)

## 11. UI / UX

No new UI. Client forms that already submit valid data are unaffected; malformed submissions now receive a structured 400 the existing form-error UI can surface (instead of a generic 500).

## 12. Test plan

**Unit (Vitest — PRD-207):**
- `parse-uuid.test.ts` — accepts valid UUID; rejects `''`, `'../'`, SQL-ish strings, overlong input → throws `ApiError(400)`.
- `deep-merge.test.ts` — **prototype-pollution suite** (AC-2a): `__proto__`, `constructor`, `prototype`, nested + array-wrapped variants all blocked; legitimate deep merges unchanged vs. a golden fixture.
- `tenant-settings.schema.test.ts` — strict schema rejects unknown keys + bad types; accepts the known settings shape.
- `body.test.ts` — `parseJsonBody` rejects over-cap before parsing; passes within cap.

**Integration (testcontainers Postgres — PRD-207):**
- `branding-proto-pollution.integration.test.ts` — POST a `__proto__` payload through `branding/route.ts`; assert no global pollution and a clean response (AC-2b).
- `customer-profile-validation.integration.test.ts` — over-length `firstName` / oversized `address` → 400 (AC-3).
- `tenant-settings-patch.integration.test.ts` — unknown `settings` key → 400 (AC-4).
- `path-param-validation.integration.test.ts` — `/api/super-admin/tenants/not-a-uuid` → 400, no Prisma leak (AC-1a).

**E2E (Playwright):**
- `profile-form-validation.spec.ts` — submitting an over-long field surfaces the validation error in the UI, no 500.

**Coverage target:** 95% on `lib/utils.ts` (`deepMerge`), `lib/validation/parse-uuid.ts`, `lib/validation/tenant-settings.ts`, `lib/validation/body.ts` (security-critical). 80% baseline on migrated route validation branches.

## 13. Open questions

- [ ] **OQ-1** Are the dynamic ids always UUIDs, or do any use cuid/nanoid? (`users.id`/`tenants.id` are `String @id` — confirm generator.) Owner: Gerard. Resolution: inspect Prisma `@default`; `parseUuid` vs a generic `parseId` accordingly. Storefront `[slug]` is intentionally a non-UUID subdomain string → `parseSlug` (allow-list charset, length cap).
- [ ] **OQ-2** Right default JSON body cap — 256 KB covers branding/page-content merges; confirm the largest legitimate `pageContent`/`settings` payload. Owner: Gerard. Resolution: measure the biggest real branding save; set cap at ~2× with a per-route override.
- [ ] **OQ-3** Replace `deepMerge` with a vetted library (e.g. a maintained deep-merge with pollution guards) vs. hardening in place? Owner: Claude. Resolution: harden in place (smaller diff, keeps the bespoke "skip empty / replace arrays" semantics callers rely on); add the test suite either way.
- [ ] **OQ-4** Where to enforce the size cap given Next.js App Router has no global `bodyParser` config — in `parseJsonBody` via `content-length` + stream cap, or via `middleware.ts`? Owner: Claude. Resolution: in `parseJsonBody` (works for both Edge and Node handlers); middleware as a coarse backstop.

## 14. Dependencies

**Strict:** None to start (helpers + `deepMerge` fix are self-contained).

**Soft:**
- PRD-203 (auth wrappers) — validation runs inside the wrapped handler; landing both together avoids editing each of ~41 routes twice.
- PRD-207 (test foundation) — Vitest + testcontainers for the suites above.

**Feeds:**
- **PRD-208** — imports the `tenant-settings` Zod schema to type `tenant.settings` on read (the `as any` × 35 problem).

## 15. Estimated effort

- **`parseUuid`/`parseSlug` helpers + roll out to ~41 dynamic routes:** 8 hours
- **`deepMerge` prototype-pollution fix + pollution test suite:** 3 hours
- **`tenant-settings` strict Zod schema + super-admin PATCH wiring:** 4 hours
- **`customer/profile` PATCH Zod + caps:** 2 hours
- **Shared `parseJsonBody` size-cap helper + adoption across body routes:** 8 hours
- **Tests (unit + integration + E2E):** 7 hours
- **Total:** ≈ 32 hours (≈ 4 days for 1 dev + Claude pair)

## 16. References

- Existing code: `lib/utils.ts:12` (`deepMerge`, no pollution guard), `app/api/tenant-admin/branding/route.ts:231,430` (attacker-reachable `deepMerge` calls), `app/api/customer/profile/route.ts:75-76,88-97` (un-validated PATCH body), `app/api/super-admin/tenants/[id]/route.ts:78-87` (un-validated `settings`), `app/api/tenant-admin/customers/[id]/route.ts:47,175,298,449,471,473` and `app/api/super-admin/tenants/[id]/route.ts:21,91,117,270,313,376,382` (raw `params.id` into Prisma), `lib/upload-validation.ts` (existing magic-byte validation to keep)
- Counts (verified 2026-05-29): 17 dynamic-segment directories / ~41 route files with `[id]`/`[slug]`/`[orderId]`; only 6 of 107 routes import `zod`; ~56 `request.json()` call sites; no `bodyParser`/`sizeLimit` config present
- Error envelope: `lib/api-error.ts` (`apiValidationError`, `ApiError`) — repo has no `lib/api-response.ts`
- Standards: [OWASP Mass Assignment / Prototype Pollution](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html), [Zod](https://zod.dev), [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- Memory: `MEMORY.md` (branding `deepMerge`/`designSystem` notes), coding rule "validate inputs at boundaries with Zod"
- 2026-05-29 review: findings #6 (16 routes no UUID validation), `deepMerge` no pollution filter, `customer/profile` PATCH no caps, super-admin tenants PATCH `settings` no Zod

## 17. Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-05-29 | Claude (with Gerard) | Initial draft from 2026-05-29 review. |
| 0.2 | 2026-05-29 | Claude (Opus 4.8) | Verified against code: `deepMerge` at `lib/utils.ts:12` confirmed lacking pollution guard + its two attacker-reachable call sites; 17 dynamic dirs / ~41 route files confirmed; raw `params.id` Prisma uses anchored; `customer/profile` PATCH + super-admin `settings` un-validated bodies confirmed; only 6/107 routes use Zod; no body-size config present; corrected envelope module to `lib/api-error.ts`. |
