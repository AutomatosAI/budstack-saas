# PRD-212 — Custom-Domain ISR Cache Isolation Fix

> **Status:** Proposed
> **Phase:** R4 — Template & Data Discipline
> **Severity:** HIGH _(a cross-tenant content-serving bug: one tenant's fully-rendered storefront can be served on a different tenant's custom domain. Not an auth bypass, but it is a tenant-isolation breach at the cache layer — see [Pre-flight verification](./REMEDIATION-INDEX.md#pre-flight-verification--2026-05-29). Affects only custom-domain tenants, but those are exactly the white-label customers.)_
> **Module(s) touched:** `app/store/[slug]/page.tsx`, `app/store/[slug]/the-wire/page.tsx`, `middleware.ts` (custom-domain rewrite), `lib/tenant.ts` (`getCurrentTenant`), any other `revalidate`-enabled route under `app/store/[slug]/`
> **Depends on:** Coordinate with PRD-201, which reserves the `_cd` placeholder in `RESERVED_SUBDOMAINS` (so no tenant can register `_cd` and confuse the rewrite).
> **Blocks:** Onboarding any tenant on a **custom domain** safely. Two custom-domain tenants today share a cache namespace.
> **Owner:** Gerard + Claude.
> **Last updated:** 2026-05-29

---

## 1. Problem

BudStacks serves three routing modes (`middleware.ts`):
- **Subdomain** (`slug.budstacks.io/foo`) → rewritten to `/store/{subdomain}/foo` — the real slug is in the path (`:84-86`).
- **Custom domain** (`example.com/foo`) → rewritten to a **placeholder** path `/store/_cd/foo` (`:124`), with the real host carried only in the `x-tenant-custom-domain` request header (`:100`). The comment at `:90-92` is explicit: "The `_cd` placeholder slug is never used for DB lookups — `getCurrentTenant()` resolves via the `x-tenant-custom-domain` header."
- **Path-based** (localhost/dev) → `/store/{slug}` directly.

The storefront page is **ISR-cached**: `app/store/[slug]/page.tsx:9` declares `export const revalidate = 60`. The page resolves its tenant **entirely from the header**, not the route param — `getCurrentTenant()` (`page.tsx:32`) reads `x-tenant-custom-domain` and does `prisma.tenants.findFirst({ where: { customDomain, isActive: true } })` (`lib/tenant.ts:19,45-51`). The page function does not even accept `params.slug` for resolution.

**The collision:** Next.js ISR keys the full-route cache on the **resolved pathname**, not on request headers. Every custom domain rewrites to the *same* literal pathname — `/store/_cd/...`. So:

1. `tenant-a.com` is requested → rewrites to `/store/_cd` → `getCurrentTenant()` reads header `tenant-a.com` → renders Tenant A's storefront → **Next.js caches that HTML under the key `/store/_cd`** for 60s.
2. Within the window, `tenant-b.com` is requested → rewrites to the **same** `/store/_cd` → the ISR cache **hits** on that pathname and returns **Tenant A's already-rendered page** — Tenant B's customers see Tenant A's branding, products, and content on Tenant B's domain.

The header that distinguishes the tenants is read *inside* render, but the cache lookup happens *before* render and is keyed only on the path. The `_cd` placeholder — designed to make Next.js file-routing match `app/store/[slug]/` — collapses every custom domain into one cache bucket. The same flaw applies to any other `revalidate`-enabled route on this path: `the-wire/page.tsx:11` also sets `revalidate = 60`.

**Why it has not been widely noticed:** it only manifests for **custom-domain** tenants (subdomain tenants get distinct `/store/{subdomain}` paths, so their cache keys differ), and only when ≥2 custom domains receive traffic inside the same 60s window. But custom-domain tenants are precisely the white-label enterprise customers, and the failure is silent and cross-tenant.

This PRD makes the ISR cache key (or cache strategy) **include the real host/tenant** for the `_cd` path, so no two custom domains can ever share a cached render.

## 2. Users / personas

| Role | How they benefit |
|---|---|
| **Custom-domain tenant** | Their domain always serves *their* storefront — never another tenant's cached page |
| **Their customers** | See the correct brand/products/legal content for the domain they visited |
| **Gerard / ops** | Can onboard multiple custom-domain tenants without a cache-collision incident |
| **Enterprise prospect** | "Can two of your white-label domains ever serve each other's content?" → a clean, tested "no" |

## 3. User stories

- As a **custom-domain tenant**, when another tenant's custom domain is being hit at the same moment, my domain never serves their cached page, and vice-versa.
- As a **customer** on `tenant-b.com`, I always see Tenant B's storefront — the right products, branding, and terms — regardless of traffic to other custom domains.
- As a **developer**, the ISR cache key for a custom-domain render provably incorporates the host/tenant, verified by a test that fails on the current `_cd`-only keying.
- As an **auditor**, there is a regression test that hammers two custom domains concurrently and asserts zero cross-domain content bleed.

## 4. Acceptance criteria

**Per-host cache isolation for the `_cd` path:**

- [ ] **AC-1** Two distinct custom domains (`a.com`, `b.com`) requested within the same `revalidate` window each receive **their own** tenant's rendered storefront. No request to `b.com` is ever served a cache entry produced for `a.com`. This is the core invariant.
- [ ] **AC-1a** The fix makes the cache key for the custom-domain render a function of the **real host** (`x-tenant-custom-domain`) or the **resolved tenantId** — not the shared `_cd` placeholder path. Chosen mechanism recorded in §13 OQ-1 (options: (a) rewrite to a per-tenant/per-host path segment instead of the constant `_cd`; (b) switch the route to `dynamic = "force-dynamic"` for the custom-domain case; (c) per-tenant cache tags via `unstable_cache`/`revalidateTag`).

**Apply to every cached route on the path:**

- [ ] **AC-2** The fix covers **all** `revalidate`-enabled routes under `app/store/[slug]/` reachable via the `_cd` rewrite — at minimum `page.tsx:9` and `the-wire/page.tsx:11`. A grep gate enumerates `export const revalidate` under `app/store/[slug]/` and confirms each is either dynamic for custom domains or keyed per host.

**Subdomain + path modes unaffected:**

- [ ] **AC-3** Subdomain tenants (distinct `/store/{subdomain}` paths) and dev path-based routing keep their existing ISR behaviour and caching benefit — the fix must **not** force everything to `force-dynamic` and lose ISR for subdomain tenants (which are correctly isolated by path today). If a blanket dynamic approach is chosen, it is scoped to the custom-domain (`_cd`) case only.

**Placeholder reservation (cross-PRD):**

- [ ] **AC-4** `_cd` is reserved so no tenant can register it as a subdomain and collide with the rewrite. This is delivered by **PRD-201** (`RESERVED_SUBDOMAINS` addition); this PRD verifies the reservation is present and adds a test asserting `_cd` is rejected at subdomain registration.

**No stale cross-host bleed on revalidate:**

- [ ] **AC-5** When a custom-domain page revalidates in the background, the regenerated entry is stored under the **same host-scoped key** it was served from — a background revalidation triggered by `a.com` traffic never overwrites/serves into `b.com`'s entry.

## 4.1 Design framework conformance

No UI surface. Pure cache-key / routing correctness. Storefront visual output is unchanged per tenant — the fix ensures the *correct* tenant's output is served.

- [x] No new UI / tokens — N/A
- [x] No template-specific values introduced
- [x] Data-driven render path unchanged — only the cache key/strategy changes
- [x] Per-tenant render parity verified on 2 custom domains (manual + E2E)

## 5. Scope

**In scope:** isolate the ISR cache for the custom-domain (`_cd`) render by host/tenant; apply to every `revalidate` route under `app/store/[slug]/`; preserve ISR for subdomain/path modes; verify `_cd` reservation (PRD-201); regression test for concurrent custom-domain isolation.

**Out of scope:**
- The `_cd` reservation in `RESERVED_SUBDOMAINS` itself → **PRD-201** (this PRD only verifies + tests it).
- Tenant-context concurrency / ALS binding → PRD-202 (separate isolation layer; this is the cache layer).
- General CDN/edge-cache header strategy beyond the storefront ISR routes → PRD-215 (ops).
- Custom-domain DNS/Railway provisioning flow → unrelated (current `fix/super-admin-domain-dns-recovery` work).

## 6. Non-functional requirements

| NFR | Requirement |
|---|---|
| Correctness | No two custom domains ever share a cached render (the core invariant, AC-1) |
| Performance | Subdomain/path ISR caching is preserved; custom-domain rendering stays performant — prefer host-scoped caching over fully-dynamic where feasible to retain cache benefit |
| Backward compatibility | Existing subdomain tenants see no behaviour change; existing single custom-domain tenants see no regression |
| Isolation | The cache key is a function of host/tenant, not the `_cd` placeholder |
| Observability | A cache-key dimension (host/tenant) is logged/inspectable to confirm isolation in staging |

## 7. Success metrics

- Regression test: concurrent requests to ≥2 custom domains within one `revalidate` window → **0** cross-domain content observations (must fail on current `_cd`-only keying, pass after fix — red→green proof).
- Grep gate: every `export const revalidate` under `app/store/[slug]/` is covered by the host-scoped/dynamic strategy.
- Staging soak: two real custom domains under load show their own content 100% of the time.
- `_cd` rejected at subdomain registration (test, backed by PRD-201).

## 8. API surface

No external API change. Internal routing/caching change only: the custom-domain rewrite target and/or the storefront route's caching directives change. Tenant resolution (`getCurrentTenant`) contract is unchanged.

| Surface | Change |
|---|---|
| `middleware.ts` custom-domain rewrite (`:124`) | May rewrite to a host-scoped path segment instead of the constant `/store/_cd` (if OQ-1 option (a) is chosen) |
| `app/store/[slug]/page.tsx`, `the-wire/page.tsx` | Caching directive scoped per host/tenant (if option (b)/(c) chosen) |

## 9. Data model changes

None.

## 10. Events emitted / consumed

| Event | Direction | Payload | Subscribers |
|---|---|---|---|
| `cache.custom_domain_render` | emit (log, staging) | `{ host, tenantId, cacheKeyDimension }` | logs (PRD-215) — to confirm per-host keying in soak |

(Diagnostic log line; removed or demoted after the soak confirms isolation.)

## 11. UI / UX

No visible UI change. Each custom domain reliably serves its own storefront. No customer-facing behaviour change beyond correctness.

## 12. Test plan

**Unit (Vitest — stood up in PRD-207):**
- `custom-domain-cache-key.test.ts` — the function that derives the render/cache key for a custom-domain request returns **distinct** keys for distinct hosts and a stable key for the same host (asserts the key is not the constant `_cd`).

**Integration (PRD-207):**
- `custom-domain-isolation.integration.test.ts` — **the proof test.** Seed Tenant A (`a.com`) and Tenant B (`b.com`) with visibly different content. Issue a request to `a.com` (populating cache), then immediately to `b.com` within the `revalidate` window; assert `b.com` renders Tenant B's content, not A's. Also fire interleaved/concurrent requests to both and assert each always gets its own. **Must be demonstrated red against the current `_cd`-only keying and green after the fix.**
- `revalidate-no-cross-host.integration.test.ts` — a background revalidation triggered by `a.com` traffic does not alter what `b.com` is served (AC-5).

**E2E (Playwright):**
- `custom-domain-no-bleed.spec.ts` — two browser contexts on two custom-domain hosts (host header / hosts-file mapping in CI) hammer the storefront simultaneously; assert no context ever sees the other tenant's brand/products.

**Grep gate (wired into PRD-216 CI):**
- Every `export const revalidate` under `app/store/[slug]/` is covered by the host-scoped/dynamic strategy (AC-2).

**Coverage target:** **95%** on the cache-key derivation / custom-domain rewrite path (security-critical — it is a tenant-isolation control).

## 13. Open questions

- [ ] **OQ-1** Which mechanism best isolates the custom-domain cache while preserving ISR where possible? Owner: Gerard + Claude. Options:
  - **(a) Host-scoped path segment** — rewrite `example.com/foo` to `/store/cd_<hash(host)>/foo` (or the resolved tenant slug) instead of the constant `/store/_cd/foo`, so the ISR key differs per host. Keeps ISR benefit; needs the `[slug]` segment to tolerate the encoded value and `getCurrentTenant` to keep using the header (or decode the segment).
  - **(b) `dynamic = "force-dynamic"` for the custom-domain case only** — simplest and provably safe, but drops ISR caching for custom-domain tenants (acceptable if their traffic is modest; subdomain tenants keep ISR).
  - **(c) Per-tenant cache tags** — wrap data loads in `unstable_cache` keyed by tenantId + `revalidateTag(tenant:<id>)`, moving caching below the full-route layer.
  Resolution: prefer (a) for cache retention; fall back to (b) if (a) complicates routing; evaluate (c) for the data layer regardless.
- [ ] **OQ-2** Does rewriting to a non-`_cd` segment (option a) break the `getCurrentTenant()` header-based resolution or the `params.slug`-derived `CartProvider storeSlug` (`layout.tsx:319`) / `getTenantBasePath` links anywhere? Owner: Claude. Resolution: audit all `params.slug` consumers under `app/store/[slug]/`; ensure they tolerate or ignore the placeholder/encoded slug.
- [ ] **OQ-3** Are there **other** cached surfaces keyed on the `_cd` path beyond `page.tsx` and `the-wire/page.tsx` (e.g. route handlers, `generateMetadata`, OG images)? Owner: Gerard. Resolution: grep `revalidate`/`unstable_cache`/`generateMetadata` under `app/store/[slug]/` and cover each.
- [ ] **OQ-4** Confirm Next.js 14.2.35 full-route-cache keying does not already incorporate the rewrite source host (it does not — it keys on the resolved pathname). Re-verify after the PRD-200 Next.js bump (15.x caching defaults differ). Owner: Claude. Resolution: re-run the proof test after the bump; caching semantics changed in 15.x and may alter the chosen mechanism.

## 14. Dependencies

**Strict:** None to start.

**Soft / cross-PRD:**
- **PRD-201** — reserves `_cd` in `RESERVED_SUBDOMAINS`; AC-4 verifies it.
- **PRD-200** — the Next.js 15.x bump changes caching defaults; re-verify the proof test after it lands (OQ-4).
- PRD-207 (test foundation) — the proof/regression tests need the Vitest + Playwright harness.
- PRD-202 (tenant context) — a *different* isolation layer (ALS/DB); this PRD is the cache layer. They are complementary, not dependent.

## 15. Estimated effort

- **Choose + implement cache-key isolation (OQ-1 mechanism) in `middleware.ts` / storefront routes:** 3 hours
- **Apply to all `revalidate` routes under `app/store/[slug]/` + audit `params.slug` consumers:** 2 hours
- **Proof + regression tests (integration concurrent + E2E) at 95%:** 4 hours
- **Verify `_cd` reservation (PRD-201) + staging soak:** 1 hour
- **Total:** ≈ 10 hours (≈ 1 day for 1 dev + Claude pair)

## 16. References

- Existing code: `middleware.ts:84-86,90-92,100,124` (custom-domain rewrite to `/store/_cd`); `app/store/[slug]/page.tsx:9,32` (`revalidate = 60`, `getCurrentTenant()`); `app/store/[slug]/the-wire/page.tsx:11` (`revalidate = 60`); `app/store/[slug]/layout.tsx:84,319`; `lib/tenant.ts:16-61` (`getCurrentTenant` resolves `customDomain` from header at `:19,45-51`)
- API error helper (for any new error responses): `lib/api-error.ts`
- Next.js docs: [Route Segment Config `revalidate`](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#revalidate), [Full Route Cache](https://nextjs.org/docs/app/building-your-application/caching#full-route-cache), [`revalidateTag`](https://nextjs.org/docs/app/api-reference/functions/revalidateTag)
- Memory: `MEMORY.md` "Store URL Pattern" (subdomain rewrite vs path-based; `getTenantBasePath`); Railway persistent-process note
- 2026-05-29 review: custom-domain ISR cache collision via `/store/_cd/...` rewrite finding (cross-ref `_cd` reservation in PRD-201)

## 17. Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-05-29 | Claude (with Gerard) | Initial draft from 2026-05-29 review. |
| 0.2 | 2026-05-29 | Claude (Opus 4.8) | Verified against code: confirmed `revalidate = 60` on `page.tsx:9` (+ `the-wire/page.tsx:11`); confirmed `middleware.ts:124` rewrites every custom domain to the constant `/store/_cd`; confirmed `getCurrentTenant` resolves the tenant from the `x-tenant-custom-domain` header (`lib/tenant.ts:19,45-51`), not the route param — so ISR full-route cache keyed on the shared `_cd` pathname serves one tenant's page on another's domain. Added background-revalidation case (AC-5) and Next.js-15-caching re-verify (OQ-4). |
