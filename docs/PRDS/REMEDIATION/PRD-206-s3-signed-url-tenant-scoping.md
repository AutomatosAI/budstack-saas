# PRD-206 — S3 Signed URL Tenant Scoping

> **Status:** Proposed
> **Phase:** R2 — Tenant Isolation Foundation
> **Severity:** HIGH _(the signing helper performs **no** caller-tenant assertion — a tenant-admin endpoint can sign a presigned GET for `tenants/{anyOtherTenantId}/…` and read another tenant's uploaded assets. The two upload routes that *do* guard are using a bypassable substring check, not the signer. See [Pre-flight verification](./REMEDIATION-INDEX.md#pre-flight-verification--2026-05-29).)_
> **Module(s) touched:** `lib/s3.ts` (`getFileUrl`, `uploadFile`), a new `lib/s3-tenant-guard.ts`, `app/store/preview/[templateSlug]/page.tsx` (`signS3Path`), `app/api/tenant-admin/upload/route.ts`, `app/api/tenant-admin/branding/upload/route.ts`, `app/api/tenant-admin/templates/[id]/preview-image/route.ts`, `app/api/super-admin/templates/[id]/route.ts`
> **Depends on:** Soft on **PRD-202** (caller's `tenantId` comes from the bound context) and **PRD-203** (the wrapper supplies `tenantId` to the handler) and **PRD-205** (canonical resolver). None strict — the guard can take an explicit `tenantId` argument in the interim.
> **Blocks:** Nothing downstream; closes a direct cross-tenant asset-read vector before scaling.
> **Owner:** Gerard + Claude. Security sign-off: Gerard.
> **Last updated:** 2026-05-29

---

## 1. Problem

Tenant assets live under a strict per-tenant S3 prefix: **`tenants/{tenantId}/templates/{templateSlug}/`** (confirmed across `lib/tenant-template-upload-service.ts:84`, `app/api/onboarding/route.ts:275`, `app/api/tenant-admin/templates/clone/route.ts:59`, `create-blank/route.ts:73`). That prefix **is** the isolation boundary for files. But the function that mints signed URLs does not enforce it.

`getFileUrl(key)` (`lib/s3.ts:60`) takes an arbitrary key and returns a presigned GET valid for an hour:

```ts
// lib/s3.ts:60
export async function getFileUrl(key: string, contentTypeHint?: string): Promise<string> {
  const s3Client = await createS3Client();
  const { bucketName } = await getBucketConfig();
  // …content-type inference…
  const command = new GetObjectCommand({ Bucket: bucketName, Key: key, … });
  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });   // ← signs ANY key, no caller check
}
```

There is **no parameter for, and no assertion of, the calling tenant.** Whatever `key` a handler passes gets signed. The handlers that call it pass keys derived from request input:

- `app/api/super-admin/templates/[id]/route.ts:82` signs `updateData.previewUrl` (super-admin, broad by design — but still unscoped).
- `app/api/tenant-admin/templates/[id]/preview-image/route.ts:88` signs `s3Key` after building it from `tenants/${tenantId}/` — safe *only because the path was just constructed*, not because the signer checks.
- `app/api/tenant-admin/branding/upload/route.ts:74` signs `cloudStoragePath` returned from `uploadFile`.

The storefront preview path is worse. `signS3Path` (`app/store/preview/[templateSlug]/page.tsx:72`) has an explicit **absolute-path passthrough**:

```ts
// app/store/preview/[templateSlug]/page.tsx:72
async function signS3Path(val: string, s3Prefix: string, contentTypeHint?: string): Promise<string> {
  const isAbsolute = val.startsWith('development/') || val.startsWith('tenants/') || val.startsWith('templates/');
  return getFileUrl(isAbsolute ? val : `${s3Prefix}/${val}`, contentTypeHint);   // ← a value beginning `tenants/<other>/…` is signed as-is
}
```

So a layout/defaults value (data that flows from S3 template JSON, which a tenant admin can edit) beginning `tenants/<other-tenant-id>/…` is signed verbatim against that other tenant's prefix.

**The codebase already knows the right check — but applies it in the wrong place, weakly, and inconsistently.** Two upload routes do:

```ts
// app/api/tenant-admin/upload/route.ts:51  (and branding/upload/route.ts:67)
if (tenantId && !key.includes(`tenants/${tenantId}/`)) {
  return NextResponse.json({ error: "Upload path violation" }, { status: 500 });
}
```

Three problems with that: (1) it is a **substring** check (`.includes`), so `tenants/<victim>/x/tenants/<me>/y` passes; (2) it guards only the **two upload** routes, not `getFileUrl` itself, so every *signing* call site is unprotected; (3) it lives in route handlers, so any new caller of `getFileUrl` silently misses it. `uploadFile` (`lib/s3.ts:28`) likewise takes a caller-supplied `tenantPrefix` and trusts it.

This PRD moves the assertion **into the S3 helper layer**, makes it a strict prefix match (not substring), and makes it the single chokepoint every sign/upload passes through.

## 2. Users / personas

| Role | How they benefit |
|---|---|
| **Every tenant** | Their uploaded assets (logos, hero media, template files) cannot be signed and read by another tenant's session |
| **Storefront customer** | Preview/render never leaks another tenant's private S3 object via a mis-scoped signed URL |
| **Developer** | `getFileUrl`/`uploadFile` enforce tenant scope centrally — a new caller cannot forget the check |
| **Enterprise prospect** | "Signed URLs are asserted against the caller's tenant prefix before issuance" is a concrete, testable isolation control |

## 3. User stories

- As **tenant A's admin**, if I (or a crafted template value) request a signed URL for `tenants/B/…`, the request is rejected — I can only ever sign within `tenants/A/`.
- As a **developer**, I call `getFileUrl(key, { tenantId })` and the helper throws if `key` is not within `tenants/{tenantId}/` — I cannot accidentally issue a cross-tenant URL.
- As a **super-admin**, I can still sign across tenants for legitimate admin tooling via an explicit, audited bypass — never an implicit one.

## 4. Acceptance criteria

**Central tenant-prefix guard:**

- [ ] **AC-1** A `lib/s3-tenant-guard.ts` exports `assertKeyInTenantScope(key: string, tenantId: string): void` that throws `ApiError(403)` unless `key` is within the caller's prefix. The match is a **strict path-segment prefix** on `tenants/{tenantId}/` (normalised: collapse `//`, reject `..`, reject leading-slash tricks) — **not** a substring `.includes`. The folder prefix from `getBucketConfig()` (e.g. `development/`) is accounted for.
- [ ] **AC-1a** Tests prove the bypass strings the current `.includes` check would allow are **rejected**: `tenants/<victim>/x/tenants/<me>/y`, `tenants/<me>-evil/…`, `tenants/<me>/../<victim>/…`, URL-encoded `..%2F` variants.

**Enforce at the signer + uploader:**

- [ ] **AC-2** `getFileUrl` (`lib/s3.ts:60`) gains a required tenant-scope argument for tenant-scoped callers: `getFileUrl(key, { tenantId })`. When `tenantId` is provided it calls `assertKeyInTenantScope(key, tenantId)` before signing. A super-admin/system caller uses an explicit `getFileUrl(key, { bypassTenantScope: true, reason })` overload — never an implicit unscoped call.
- [ ] **AC-2a** `uploadFile` (`lib/s3.ts:28`) asserts the **final** computed key is within `tenants/{tenantId}/` using the same guard (replacing the trust in the caller-supplied `tenantPrefix`), so an upload can never land outside the caller's prefix.
- [ ] **AC-3** The two existing route-level substring checks (`tenant-admin/upload/route.ts:51`, `branding/upload/route.ts:67`) are **removed** in favour of the helper-level assertion (single source of truth). The routes pass `tenantId` into `uploadFile`/`getFileUrl`.

**Fix the preview passthrough:**

- [ ] **AC-4** `signS3Path` (`app/store/preview/[templateSlug]/page.tsx:72`) no longer signs an arbitrary `tenants/<...>/` absolute path. It resolves the value within the **current** tenant/template `s3Prefix` and asserts the result is in that tenant's scope; a value pointing at another tenant's prefix is dropped (returns null/skip), not signed.
- [ ] **AC-4a** Because preview/storefront asset paths come from S3 template JSON (data-driven), the guard treats the tenant whose template is being previewed as the scope owner — no template-specific value is hardcoded; the `tenantId` is derived from the resolved tenant (PRD-205).

**Super-admin bypass is explicit + audited:**

- [ ] **AC-5** Cross-tenant signing that is legitimately needed (super-admin template tooling at `super-admin/templates/[id]/route.ts:82`) uses the explicit `bypassTenantScope` path, gated by `withSuperAdmin` (PRD-203), and logs a `s3.cross_tenant_sign` event with the key + reason for audit.

## 4.1 Design framework conformance

No UI surface. The change is in the S3 helper + signing call sites. **Critically respects the data-driven template rule:** the guard keys off the resolved `tenantId` and the `tenants/{tenantId}/…` prefix convention — it adds **no** template-specific names/slugs/paths to platform code. S3 remains the source of truth for asset content; this PRD only constrains *which* tenant's S3 prefix a caller may sign.

- [x] No new tokens / primitives — N/A
- [x] Data-driven template rule respected — guard uses `tenantId` + prefix convention only, no hardcoded template values
- [x] Errors use `ApiError`/`apiError()` from `lib/api-error.ts`

## 5. Scope

**In scope:** `assertKeyInTenantScope` strict-prefix guard; enforce it inside `getFileUrl` + `uploadFile`; remove the bypassable route-level substring checks; fix the `signS3Path` absolute-path passthrough; explicit audited super-admin bypass.

**Out of scope:**
- Where the caller's `tenantId` comes from (bound context) → PRD-202/PRD-203/PRD-205 (this PRD accepts an explicit `tenantId` arg until those land).
- S3 bucket-policy / IAM-level isolation (defence-in-depth at the AWS layer) — noted as a follow-up in §13, not built here.
- Magic-byte upload validation (already present in `lib/upload-validation.ts`) → unchanged.
- Public storefront asset caching / ISR → PRD-212.

## 6. Non-functional requirements

| NFR | Requirement |
|---|---|
| Security | No signed URL or upload can target a prefix outside the caller's `tenants/{tenantId}/`; strict prefix, not substring |
| Correctness | Legitimate same-tenant signs/uploads behave identically to today |
| Performance | The guard is a string-normalise + prefix compare (µs); zero added S3 round-trips |
| Backward compatibility | Existing same-tenant flows unchanged; only cross-tenant keys (a bug) now throw |
| Auditability | Every super-admin cross-tenant sign is logged with key + reason |

## 7. Success metrics

- `getFileUrl` calls without either a `tenantId` scope or an explicit `bypassTenantScope`: **0** (CI gate, PRD-216).
- Substring `.includes('tenants/…')` scope checks remaining in route handlers: **0** (replaced by the helper).
- Bypass-string test suite (AC-1a): **all rejected**.
- `signS3Path` cross-tenant passthrough: **closed** (test-proven).
- Cross-tenant asset-read attempt in E2E: **403/blocked**, zero bytes returned.

## 8. API surface

No external HTTP API change. Internal signature change:

| Function | Before | After |
|---|---|---|
| `getFileUrl(key, hint?)` | signs any key | `getFileUrl(key, { tenantId })` asserts scope, or `{ bypassTenantScope, reason }` |
| `uploadFile(buf, name, type?, prefix?)` | trusts caller prefix | asserts final key in `tenants/{tenantId}/` |
| `signS3Path(val, prefix, hint?)` | passes `tenants/*` through | resolves within current tenant scope, drops out-of-scope |

## 9. Data model changes

None. (S3 key conventions unchanged; only the access check is added.)

## 10. Events emitted / consumed

| Event | Direction | Payload | Subscribers |
|---|---|---|---|
| `s3.cross_tenant_sign_blocked` | emit (log) | `{ callerTenantId, requestedKey }` | logs / alert (PRD-215) — should be **zero** in steady state |
| `s3.cross_tenant_sign` | emit (audit) | `{ adminUserId, key, reason }` | audit log (super-admin explicit bypass, AC-5) |

(No event bus yet — log lines today; PRD-215 formalises them.)

## 11. UI / UX

None. Same-tenant asset rendering and uploads are visually unchanged; a (buggy) cross-tenant asset reference simply fails to render rather than leaking the other tenant's file.

## 12. Test plan

**Unit (Vitest — PRD-207):**
- `s3-tenant-guard.test.ts` — `assertKeyInTenantScope` accepts `tenants/{id}/templates/x/logo.png`; rejects the full bypass-string set in AC-1a; handles the `development/` folder-prefix; rejects `..`/encoded traversal.
- `s3.test.ts` — `getFileUrl` throws on out-of-scope key with `tenantId`; signs on in-scope; `bypassTenantScope` path signs cross-tenant and logs the audit event; `uploadFile` rejects a final key outside scope.

**Integration (testcontainers Postgres + S3 mock / localstack — PRD-207):**
- `upload-scope.integration.test.ts` — tenant A uploads → key under `tenants/A/`; an attempt to coerce a `tenants/B/` prefix is rejected (AC-2a, AC-3).
- `preview-sign-scope.integration.test.ts` — a template-JSON value pointing at `tenants/B/…` previewed in tenant A's context is dropped, not signed (AC-4).

**E2E (Playwright):**
- `cross-tenant-asset-read.spec.ts` — as tenant A, drive a flow that requests a signed URL for a known tenant-B object; assert 403/blocked and that no tenant-B bytes are retrievable.

**Coverage target:** 95% on `lib/s3-tenant-guard.ts` and the guarded paths of `lib/s3.ts` (security-critical).

## 13. Open questions

- [ ] **OQ-1** Should super-admin tooling get blanket `bypassTenantScope`, or per-call reason + audit? Owner: Gerard. Resolution: per-call explicit `reason` + audit log (AC-5) — blanket bypass re-creates the "trust the caller" hole at the admin tier.
- [ ] **OQ-2** Add S3 bucket-policy / IAM path-condition defence-in-depth (deny cross-prefix at the AWS layer)? Owner: Gerard. Resolution: out of scope here, but file a follow-up — application-layer guard + IAM condition is the belt-and-braces target.
- [ ] **OQ-3** Some assets are referenced by absolute `development/…` paths (legacy/base-template). How does the guard treat the shared base-template prefix vs. per-tenant? Owner: Gerard. Resolution: per MEMORY, each tenant owns a **full copy** under `tenants/{id}/` (no base fallback), so storefront/preview signing should never need a non-tenant prefix; base-template reads are a build/onboarding-time operation (super-admin/system context) using the explicit bypass.
- [ ] **OQ-4** Where does `tenantId` come from for the public **preview** page before PRD-205 lands? Owner: Claude. Resolution: derive from the resolved preview tenant/template; thread it explicitly into `signS3Path` until the canonical resolver is wired.

## 14. Dependencies

**Strict:** None — the guard accepts an explicit `tenantId`, so it can land independently.

**Soft:**
- PRD-203 (auth wrappers) — supplies `tenantId` from the bound context to handlers, so call sites pass it cleanly.
- PRD-202 (tenant context) — once bound, `tenantId` is available without threading; until then it is passed explicitly.
- PRD-205 (canonical resolver) — the preview page's tenant derivation (AC-4a/OQ-4) uses it when available.
- PRD-207 (test foundation) — Vitest + S3-mock/localstack harness for the integration tests.

## 15. Estimated effort

- **`assertKeyInTenantScope` strict-prefix guard + normaliser + bypass-string test suite:** 4 hours
- **Wire guard into `getFileUrl` + `uploadFile`; add explicit bypass overload:** 3 hours
- **Remove route-level substring checks; thread `tenantId` into the 4 signing/upload call sites:** 3 hours
- **Fix `signS3Path` passthrough + preview-scope handling:** 2 hours
- **Tests (unit + integration + E2E) + audit-event wiring:** 4 hours
- **Total:** ≈ 16 hours (≈ 2 days for 1 dev + Claude pair)

## 16. References

- Existing code: `lib/s3.ts:60` (`getFileUrl` — signs any key, no caller assertion), `lib/s3.ts:28` (`uploadFile` — trusts caller `tenantPrefix`), `app/store/preview/[templateSlug]/page.tsx:72-75` (`signS3Path` absolute-path passthrough including `tenants/`), `app/api/tenant-admin/upload/route.ts:51` + `app/api/tenant-admin/branding/upload/route.ts:67` (bypassable `.includes('tenants/${tenantId}/')` substring check), `app/api/tenant-admin/templates/[id]/preview-image/route.ts:88` + `app/api/super-admin/templates/[id]/route.ts:82` (unguarded `getFileUrl` call sites)
- Prefix convention (verified 2026-05-29): `tenants/{tenantId}/templates/{templateSlug}/` — `lib/tenant-template-upload-service.ts:84`, `app/api/onboarding/route.ts:275`, `app/api/tenant-admin/templates/clone/route.ts:59`, `create-blank/route.ts:73`
- Error envelope: `lib/api-error.ts` (`ApiError`, `apiError`) — repo has no `lib/api-response.ts`
- Standards: [AWS S3 presigned URL scoping](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ShareObjectPreSignedURL.html), [OWASP IDOR / Broken Object-Level Authorization](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- Memory: `MEMORY.md` (Tenant S3 Path Architecture — one path per tenant, no base fallback; `getTemplateAssets` single path), `reference_s3_versioning_recovery.md`
- 2026-05-29 review: finding #8 (`signS3Path` no caller-tenant assertion)

## 17. Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-05-29 | Claude (with Gerard) | Initial draft from 2026-05-29 review. |
| 0.2 | 2026-05-29 | Claude (Opus 4.8) | Verified against code: `getFileUrl` (`lib/s3.ts:60`) confirmed signing any key with no caller assertion; `signS3Path` absolute-`tenants/`-path passthrough confirmed (`page.tsx:72`); discovered the existing guard is a **bypassable substring `.includes`** present on only 2 upload routes (`:51`/`:67`) and applied in handlers, not the signer — reframed the fix as a strict-prefix guard centralised in the S3 layer; anchored unguarded signing call sites; confirmed the `tenants/{tenantId}/` prefix convention across onboarding/clone/create-blank; corrected envelope module to `lib/api-error.ts`. |
