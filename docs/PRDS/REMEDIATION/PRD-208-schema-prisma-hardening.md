# PRD-208 — Schema & Prisma Hardening (soft-delete, indexes, typed `tenant.settings`, audit immutability)

> **Status:** Proposed
> **Phase:** R3 — Code Quality & Testing
> **Severity:** **HIGH** _(no soft-delete means deletes are irrecoverable on a platform that already had a destructive-delete incident — see [the template-delete cascade incident](./REMEDIATION-INDEX.md); `tenant.settings as any` × 34 is an unvalidated blob feeding tenant config; the audit table is mutable with no integrity guarantee.)_
> **Module(s) touched:** `prisma/schema.prisma`, new `prisma/migrations/*` (additive + trigger migrations), `lib/types.ts` (the `TenantSettings` interface → Zod schema), new `lib/tenant-settings.ts` (parse helper), `lib/tenant.ts` / `app/api/tenant-admin/branding/route.ts` / `app/api/super-admin/tenants/[id]/route.ts` (the `settings as any` read sites), `lib/audit-log.ts`
> **Depends on:** **PRD-207** (test foundation — every migration here needs an integration test against a real Postgres container before it touches a live table). Soft-coupled to **PRD-204** (input-validation sweep — the write-side Zod for `settings`).
> **Blocks:** Nothing hard, but the soft-delete columns are the substrate PRD-213 (GDPR erasure) marks rows against, and the immutable audit table is where **PRD-201's destructive-action audit rows graduate to**.
> **Owner:** Gerard + Claude. Schema sign-off: Gerard (he runs the prod migrations).
> **Last updated:** 2026-05-29

---

## 1. Problem

The Prisma schema (`prisma/schema.prisma`, 612 lines, **25 models**) is functionally complete but lacks four hardening properties an enterprise data layer needs. Each is verified against the file:

1. **No soft-delete anywhere (data-loss risk).** A repo-wide search for `deletedAt`/`deleted_at`/`isDeleted`/`softDelete` across `schema.prisma` returns **nothing**. Every delete is a hard `DELETE`, and the relations cascade — `tenants` has `onDelete: Cascade` fanning out to `orders`, `products`, `consultations`, `posts`, `email_logs`, `tenant_branding`, `tenant_templates`, and more (`schema.prisma:443-460`). This is not theoretical: the **template-delete cascade incident (2026-04-29)** wiped three LekkerWeed clones and was only recovered via S3 versioning + a manual SQL rebuild (see `MEMORY.md`). Hard cascade + no recovery column = the next mis-click is unrecoverable from the DB alone.
2. **`tenant.settings` is an untyped blob, cast `as any` on read (34 occurrences).** `tenants.settings` is `Json?` (`schema.prisma:425`). A grep for `settings as any` across `app lib components` returns **34 hits** (the first pass estimated ~27; the real count is higher). There is an `export interface TenantSettings` at `lib/types.ts:35`, but it is a **plain TypeScript interface with no runtime validation** — `as any` bypasses it entirely, so malformed settings (from an older onboarding write, a manual DB edit, or a future schema change) flow into tenant config, branding, and storefront rendering with no guard. The global rule mandates Zod at boundaries; reading `settings` is a boundary.
3. **Missing indexes on the hottest tenant-scoped tables.**
   - **`users` has no `@@index` block at all** (`schema.prisma:489-512`). `tenantId` is a nullable FK (`:495`) with a relation but no index — every tenant-scoped user lookup (and the Prisma `$use` middleware auto-scopes *all* of them by `tenantId`) is unindexed.
   - **`orders` lacks a `(tenantId, createdAt)` composite** (`schema.prisma:230-255`). It indexes `drGreenOrderId` and `nonce` (`:253-254`) but not the tenant + time-range pattern that every admin orders list and analytics query uses. (By contrast `email_logs`, `audit_logs`, and `webhook_deliveries` *do* carry `(tenantId/…, createdAt)` composites — orders and users are the gap.)
4. **The audit-log table is mutable, with no integrity guarantee.** `audit_logs` (`schema.prisma:11-27`) is an ordinary table: `id String @id` (externally supplied, no DB default), `action`, `entityType`, `metadata Json?`, `createdAt`. There is **no append-only enforcement** — anyone with a DB connection or a stray Prisma `update`/`delete` can rewrite or erase audit history. For a platform whose audit log is supposed to be the record of who did what (and which receives **PRD-201's destructive-action rows**), a tamperable audit table undermines the entire control.

This PRD hardens all four: a soft-delete pattern where deletion must be recoverable; a Zod-validated `TenantSettings` parsed on read; the two missing indexes; and append-only enforcement (DB trigger) plus an optional hash-chain on `audit_logs`.

**Live-table safety is a first-class concern here.** Every change must be a safe online migration on a populated Railway Postgres: additive nullable columns (no rewrite), `CREATE INDEX CONCURRENTLY` (no long `ACCESS EXCLUSIVE` lock), and triggers added without blocking writes. No destructive or full-table-rewrite migration ships without an integration test (PRD-207) and a Gerard-run staging dry-run first.

## 2. Users / personas

| Role | How they benefit |
|---|---|
| **Gerard / ops** | A mis-clicked delete is recoverable from the DB (soft-delete) instead of an S3-versioning archaeology dig |
| **Every tenant** | Their `settings` blob is validated on read — a malformed value can't silently corrupt their storefront/branding |
| **Tenant admin** | Orders list + analytics queries stay fast as their order count grows (composite index) |
| **Auditor / enterprise prospect** | The audit log is provably append-only (and optionally hash-chained) — "can your audit trail be tampered with?" answers "no, the DB rejects it" |
| **PRD-213 (GDPR)** | Has a `deletedAt` to mark erasure against, and an immutable audit row to record it |

## 3. User stories

- As **Gerard**, when a tenant template or product is deleted in error, I restore it by clearing `deletedAt`, not by reconstructing rows from S3 versions and hand-written SQL.
- As a **developer**, when I read `tenant.settings`, I get a typed, Zod-validated `TenantSettings` object or a clear error — never an `any` that explodes three layers down in the storefront renderer.
- As a **tenant admin** with thousands of orders, my orders table and analytics load against an index, not a sequential scan.
- As an **auditor**, I cannot `UPDATE` or `DELETE` a row in `audit_logs` — the database itself refuses it, and (optionally) each row's hash chains to the previous so a gap is detectable.

## 4. Acceptance criteria

**Soft-delete pattern:**

- [ ] **AC-1** A `deletedAt DateTime?` column is added to the models where recoverable deletion matters: **`tenants`, `tenant_templates`, `products`, `templates`, `marketplace_submissions`** (and any model whose loss the 2026-04-29 incident showed is catastrophic). Leaf/log tables that should hard-delete (e.g. `email_logs`, `drgreen_webhook_logs`, `webhook_deliveries`) are explicitly **excluded** and the exclusion is documented in §13.
- [ ] **AC-1a** Each soft-deletable model gets `@@index([deletedAt])` (or a composite with `tenantId`) so "not-deleted" filters stay fast.
- [ ] **AC-2** The Prisma `$use` middleware (`lib/db.ts`) is extended so that, for soft-deletable models, default `find*` queries inject `deletedAt: null` and `delete`/`deleteMany` are rewritten to `update … set deletedAt = now()` — with an explicit `withDeleted()` / `hardDelete()` escape hatch for admin/GDPR paths. This composes with the tenant-scope middleware from PRD-202 (both run in the same `$use`).
- [ ] **AC-2a** A documented hard-delete path remains for **GDPR erasure (PRD-213)** — soft-delete is the default, true erasure is explicit and audited.

**Typed `tenant.settings` (Zod on read):**

- [ ] **AC-3** The `TenantSettings` shape at `lib/types.ts:35` is promoted to a **Zod schema** (`tenantSettingsSchema`) in a new `lib/tenant-settings.ts`, with the TS type derived via `z.infer`. Unknown keys are preserved or stripped per a documented policy (default: `.passthrough()` initially to avoid dropping live data, tightened later).
- [ ] **AC-3a** A single `parseTenantSettings(raw: unknown): TenantSettings` helper parses-on-read with `.safeParse`, logs (server-side, redacted) on failure, and returns a typed default rather than throwing into a render path. **All 34 `settings as any` sites** route through it.
- [ ] **AC-3b** A grep gate (CI, PRD-216) asserts **zero** `settings as any` (and no direct `tenant.settings.` property access bypassing the parser) across `app lib components`.
- [ ] **AC-3c** Write-side strict Zod validation of the `settings` blob on `PATCH` is owned by **PRD-204**; this PRD guarantees the **read** side. They share `tenantSettingsSchema`.

**Missing indexes (online, non-blocking):**

- [ ] **AC-4** `users` gains `@@index([tenantId])` (`schema.prisma:489-512` currently has no index block). `orders` gains `@@index([tenantId, createdAt])` (`schema.prisma:230-255`). Both ship as `CREATE INDEX CONCURRENTLY` so no `ACCESS EXCLUSIVE` lock is taken on the live table.
- [ ] **AC-4a** Because Prisma's generated migration uses a plain `CREATE INDEX` (which locks), the migration SQL is **hand-edited to `CONCURRENTLY`** and the migration is marked so Prisma does not wrap it in a transaction (concurrent index builds cannot run in a txn). The procedure is recorded in §13 and validated on staging first.

**Audit-log immutability:**

- [ ] **AC-5** `audit_logs` is made **append-only at the database level**: a `BEFORE UPDATE OR DELETE` trigger on `audit_logs` `RAISE EXCEPTION`s, so no `UPDATE`/`DELETE` can mutate audit history (INSERT remains allowed). Application code (`lib/audit-log.ts`) only ever inserts.
- [ ] **AC-5a** A documented, role-gated **retention/erasure exception** exists for GDPR (PRD-213) — e.g. a `SECURITY DEFINER` purge function or a partition-drop strategy — so legal erasure is possible without leaving the table casually mutable.
- [ ] **AC-6** _(optional, behind OQ-2)_ A **hash chain**: `audit_logs` gains `prevHash`/`rowHash` columns; each insert computes `rowHash = sha256(prevHash || canonical(row))` so a deleted/edited row (if the trigger were ever bypassed at the DB layer) is detectable by a chain-verify job. This is where **PRD-201's destructive-action audit rows** gain tamper-evidence.

## 4.1 Design framework conformance

No UI surface. All changes are schema, migration, middleware, and a parse helper.

- [x] No new tokens / primitives — N/A
- [x] No template-specific values introduced — `tenantSettingsSchema` is generic; it does not hardcode any tenant/template name or value (S3 remains source of truth for template content)
- [x] No storefront render change — `parseTenantSettings` returns the same shape consumers already expect, just validated

## 5. Scope

**In scope:** `deletedAt` soft-delete columns + middleware behaviour + escape hatches; `tenantSettingsSchema` Zod + `parseTenantSettings` read helper routed through all 34 `as any` sites; `users.tenantId` and `orders.(tenantId, createdAt)` indexes via `CONCURRENTLY`; `audit_logs` append-only trigger; optional audit hash chain.

**Out of scope:**
- **Write-side** `settings` Zod on `PATCH` endpoints → **PRD-204** (shares the schema).
- GDPR erasure flows that *use* `deletedAt` / the audit purge exception → **PRD-213**.
- Broader index tuning beyond the two named gaps → follow-up (this PRD fixes the verified hot-path misses only).
- Schema documentation reconciliation (the Jan docs describe a `slug`/`TenantStatus` not in Prisma) → **PRD-214**.

## 6. Non-functional requirements

| NFR | Requirement |
|---|---|
| Live-table safety | All migrations additive/nullable or `CREATE INDEX CONCURRENTLY`; no full-table rewrite; no long exclusive lock |
| Backfill | No backfill needed for nullable `deletedAt`; existing rows are implicitly "not deleted" (`NULL`) |
| Backward compatibility | Soft-delete middleware default-hides `deletedAt` rows, so existing read paths behave identically (they never saw deleted rows anyway) |
| Performance | New indexes reduce orders/users scan cost; trigger adds negligible per-insert overhead; `parseTenantSettings` adds < 1 ms per read |
| Integrity | `audit_logs` cannot be `UPDATE`d/`DELETE`d via the app or a stray query (DB rejects) |
| Reversibility | Every migration has a tested down-path or a documented forward-fix; staging dry-run before prod |

## 7. Success metrics

- Zero `settings as any` across `app lib components` (CI grep gate) — down from 34.
- `EXPLAIN` on the tenant orders-list query uses `Index Scan` on `(tenantId, createdAt)`, not `Seq Scan`.
- `EXPLAIN` on tenant user lookups uses the `users.tenantId` index.
- An `UPDATE`/`DELETE` against `audit_logs` raises an exception (integration test).
- A soft-deleted tenant/template/product is invisible to default queries and recoverable by clearing `deletedAt` (integration test).
- All migrations applied to staging then prod with **no lock-induced downtime**.

## 8. API surface

No external API change. Internal contracts: `parseTenantSettings()` is the only sanctioned reader of `tenant.settings`; `withDeleted()`/`hardDelete()` escape hatches added to the data layer. Audit writes remain insert-only via `lib/audit-log.ts`.

## 9. Data model changes

| Model | Change | Migration safety |
|---|---|---|
| `tenants`, `tenant_templates`, `products`, `templates`, `marketplace_submissions` | + `deletedAt DateTime?` + `@@index([deletedAt])` | Additive nullable column — no rewrite, no backfill |
| `users` | + `@@index([tenantId])` | `CREATE INDEX CONCURRENTLY` — no lock |
| `orders` | + `@@index([tenantId, createdAt])` | `CREATE INDEX CONCURRENTLY` — no lock |
| `audit_logs` | + `BEFORE UPDATE OR DELETE` trigger (append-only); _(optional)_ + `prevHash`/`rowHash` | Trigger creation does not block writes; columns additive nullable |

Generated Prisma migrations for the index steps are **hand-edited to `CONCURRENTLY`** and de-transactioned (AC-4a). Trigger + (optional) hash-chain functions live in a raw-SQL migration (Prisma does not model triggers), consistent with the existing raw `.sql` migrations already in `prisma/migrations/` (`init_complete_schema.sql`, `add_platform_config.sql`, `drgreen_integration.sql`).

## 10. Events emitted / consumed

| Event | Direction | Payload | Subscribers |
|---|---|---|---|
| `data.soft_deleted` | emit (audit) | `{ model, id, tenantId, deletedAt }` | `audit_logs` (this PRD's immutable table) |
| `data.restored` | emit (audit) | `{ model, id, tenantId }` | `audit_logs` |
| `security.tenant_settings_parse_failed` | emit (log) | `{ tenantId, zodIssueCount }` | logs (PRD-215) — should be **zero** in steady state |
| `security.audit_mutation_rejected` | emit (log) | `{ attemptedAction, by }` | alert (PRD-215) — DB trigger fired |

## 11. UI / UX

None directly. Downstream: PRD-213 may surface a "restore deleted" affordance in super-admin using `deletedAt`; out of scope here.

## 12. Test plan

**Unit (Vitest — PRD-207):**
- `tenant-settings.test.ts` — `tenantSettingsSchema` accepts a known-good blob, `safeParse` surfaces issues on a malformed one, `parseTenantSettings` returns a typed default (not a throw) on failure.

**Integration (testcontainers Postgres — PRD-207):**
- `soft-delete.integration.test.ts` — `delete` on a soft-deletable model sets `deletedAt` and hides the row from default `find*`; `withDeleted()` reveals it; `hardDelete()` actually removes it.
- `audit-immutability.integration.test.ts` — `INSERT` into `audit_logs` succeeds; `UPDATE`/`DELETE` raises the trigger exception; (optional) hash-chain verify detects a forced gap.
- `index-presence.integration.test.ts` — after migrate, `EXPLAIN` for the orders-by-tenant-and-date query and the users-by-tenant query show index usage, not `Seq Scan`.
- `migration-online-safety.integration.test.ts` — applies the index migrations to a seeded container and asserts `CONCURRENTLY` (no transaction wrap, no exclusive lock).

**Grep gate (CI, PRD-216):**
- Zero `settings as any` across `app lib components` (AC-3b).

**Coverage target:** 95% on `lib/tenant-settings.ts` and the soft-delete/audit middleware additions (security-/integrity-critical).

## 13. Open questions

- [ ] **OQ-1** Exact soft-delete model set — is `orders` soft-deletable (finance/audit may *require* hard retention rules instead) or always retained? Owner: Gerard. Resolution: start with `tenants`/`tenant_templates`/`products`/`templates`/`marketplace_submissions`; treat `orders` retention as a finance-policy decision, default to never-hard-delete.
- [ ] **OQ-2** Ship the audit **hash chain** (AC-6) now or defer? Owner: Gerard. Resolution: ship the append-only **trigger** now (cheap, high value); gate the hash chain behind this OQ — add it when PRD-201's destructive-action rows make tamper-evidence worth the insert cost.
- [ ] **OQ-3** `CONCURRENTLY` index builds can't run inside Prisma's migration transaction. Use Prisma's "migration without transaction" marker, or apply the two index migrations **manually on staging/prod** via `psql` and `prisma migrate resolve`? Owner: Gerard. Resolution: prefer the in-Prisma de-transactioned migration; fall back to manual `psql` + `resolve` if Prisma's wrapper fights it.
- [ ] **OQ-4** `tenantSettingsSchema` strictness — `.passthrough()` (keep unknown keys, safe for live data) vs `.strict()` (reject unknowns, cleaner but may break older blobs)? Owner: Gerard + Claude. Resolution: `.passthrough()` first to avoid dropping live settings; tighten to `.strip()`/`.strict()` after a staging audit of real blobs.
- [ ] **OQ-5** GDPR vs append-only audit — how does legal erasure coexist with an immutable audit table (PRD-213)? Owner: Gerard + DPO. Resolution: a role-gated `SECURITY DEFINER` purge function or time-partition drop, documented as the *only* sanctioned mutation path.

## 14. Dependencies

**Strict:**
- **PRD-207** — every migration here needs an integration test against a real Postgres container before it touches a live table (the whole point of the test foundation).

**Soft:**
- **PRD-204** — owns the **write-side** `settings` Zod validation; shares `tenantSettingsSchema` with this PRD's read side.
- **PRD-202** — the soft-delete `$use` behaviour composes with the tenant-scope `$use` from PRD-202; cleaner if 202 has landed so both middlewares are reasoned about together.

**Feeds:**
- **PRD-213** (GDPR) consumes `deletedAt` + the audit purge exception.
- **PRD-201** destructive-action audit rows land in this PRD's immutable `audit_logs`.

## 15. Estimated effort

- **Soft-delete columns + middleware behaviour + escape hatches:** 8 hours
- **`tenantSettingsSchema` + `parseTenantSettings` + route the 34 `as any` sites:** 8 hours
- **Index migrations (hand-edited `CONCURRENTLY`) + staging dry-run:** 4 hours
- **`audit_logs` append-only trigger (+ optional hash chain):** 5 hours
- **Integration tests (soft-delete, immutability, index presence, online safety):** 6 hours
- **Docs (migration runbook, settings schema, escape hatches):** 2 hours
- **Total:** ≈ 33 hours (≈ 4 days for 1 dev + Claude pair)

## 16. References

- Existing code: `prisma/schema.prisma` — `audit_logs` (`:11-27`, mutable), `orders` (`:230-255`, indexes `drGreenOrderId`/`nonce` but no `(tenantId, createdAt)`), `tenants.settings Json?` (`:425`), `users` (`:489-512`, no `@@index` block), `tenants` cascade fan-out (`:443-460`)
- `lib/types.ts:35` (`export interface TenantSettings` — plain TS, not Zod), `lib/db.ts` (Prisma `$use` middleware to extend), `lib/audit-log.ts` (insert-only audit writer), `lib/tenant.ts` / `app/api/tenant-admin/branding/route.ts` / `app/api/super-admin/tenants/[id]/route.ts` (`settings as any` read sites — 34 across `app lib components`)
- Existing raw-SQL migrations (precedent for the trigger migration): `prisma/migrations/init_complete_schema.sql`, `add_platform_config.sql`, `drgreen_integration.sql`
- Postgres docs: [`CREATE INDEX CONCURRENTLY`](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY), [trigger functions](https://www.postgresql.org/docs/current/plpgsql-trigger.html)
- Memory: `project_template_delete_incident_2026_04_29.md` (the destructive cascade that soft-delete prevents), `reference_s3_versioning_recovery.md`, `MEMORY.md` (Postgres v17)
- 2026-05-29 review: findings "no soft-delete columns anywhere in Prisma schema", "tenant.settings as any × 27" (actual 35 occurrences across 34 lines), "missing indexes: users.tenantId; orders lacks (tenantId, createdAt)", "audit log table has no immutability trigger / hash chain"

## 17. Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-05-29 | Claude (with Gerard) | Initial draft from 2026-05-29 review. |
| 0.2 | 2026-05-29 | Claude (Opus 4.8) | Verified against `schema.prisma`: 25 models, **no** soft-delete columns, `users` has **no `@@index` block** (confirms missing `tenantId` index), `orders` indexes `drGreenOrderId`/`nonce` but **not** `(tenantId, createdAt)`, `audit_logs` mutable. Corrected `settings as any` count **27 → 34** (measured). Noted `TenantSettings` already exists as a **plain interface** (`lib/types.ts:35`) → promote to Zod. Added online-migration safety (`CONCURRENTLY`, de-transactioned) and the GDPR-vs-append-only reconciliation. |
