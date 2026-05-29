# PRD-211 — Encryption Fallback + Webhook Hardening (`decrypt` contract, inbound HMAC, outbound SSRF, rate-limit alert, deadline shrink)

> **Status:** Proposed
> **Phase:** R4 — Template & Data Discipline
> **Severity:** HIGH _(two of these — the outbound webhook SSRF and the silent decrypt-as-plaintext fallback — are real attacker-reachable defects; the outbound SSRF was **elevated to HIGH** by the verification pass. See [Pre-flight verification](./REMEDIATION-INDEX.md#pre-flight-verification--2026-05-29). Blocks PRD-213, which runs GDPR erasure over the same encrypted columns.)_
> **Module(s) touched:** `lib/encryption.ts`, `lib/drgreen-webhook-verify.ts`, `lib/webhook.ts`, `lib/rate-limit.ts`, `app/api/webhooks/drgreen/status/route.ts`, `app/api/webhooks/drgreen/fiat/route.ts`, `app/api/webhooks/drgreen/crypto/route.ts`
> **Depends on:** None to start. Shares the versioned-key concept consumed by PRD-200 (`ENCRYPTION_KEY` rotation) — coordinate the key-version flow with it.
> **Blocks:** PRD-213 (GDPR erasure touches encrypted Dr Green keys — `decrypt` must fail closed first). PRD-200's `ENCRYPTION_KEY` rotation should use the versioned-key flow defined here.
> **Owner:** Gerard + Claude. Security sign-off: Gerard.
> **Last updated:** 2026-05-29

---

## 1. Problem

Five distinct defects across the encryption helper and the two **different** webhook subsystems. They are grouped here because they share the same crypto/edge surface and the same secret material (`ENCRYPTION_KEY` → tenant `drGreenSecretKey`). **There are two unrelated webhooks; do not conflate them:** one is the **inbound** Dr Green callback verifier, the other is the **outbound** BudStacks-to-tenant notifier. They have opposite trust directions and opposite fixes.

1. **Encryption fallback silently returns ciphertext *as plaintext* (HIGH).** `lib/encryption.ts:98` `decrypt(text, options)` has an `allowUnencryptedMigration` escape hatch (`:43,48`). When set and within `migrationDeadline`, `decrypt` **returns the raw input `text` unchanged** in two places — `:109-110` (when the value is not in the expected `:`-delimited shape) and `:135` (when legacy decryption throws). The function's contract — "decrypt this" — is violated: on the failure path it hands the **ciphertext back as if it were plaintext**. The three Dr Green webhook routes call it exactly this way: `status/route.ts:78-81`, `fiat/route.ts:131-134`, `crypto/route.ts:150-154` all pass `{ allowUnencryptedMigration: true, migrationDeadline: "2026-12-31" }`. The downstream consumer then uses that "secret" to verify a webhook signature — meaning a **raw ciphertext blob is fed in as the signing secret**, which will never match a legitimate signature and, worse, papers over a genuine decryption/key fault as a silent "secret = ciphertext" state. Related landmine (project memory, v2-prefix): `encrypt()` writes a **4-part** `v2:iv:authTag:ciphertext` (`:77-89`); `decrypt` detects v2 by `parts[0] === "v2"` (`:101-106`). Any *other* `isEncryptedValue`-style check elsewhere that only matches the **3-part** legacy shape will misclassify v2 values and skip decryption — piping raw ciphertext downstream. `decrypt` must **fail closed**: never return its input as plaintext.

2. **Inbound Dr Green webhook verify is a plain hash, NOT HMAC (HIGH).** `lib/drgreen-webhook-verify.ts:36-65` `verifyDrGreenWebhookSignature()` computes `crypto.createHash("sha256").update(rawPayload + secret)` (`:44-47`) — the file's own comment at `:33` states "plain hash, NOT HMAC". A naive `H(message ‖ secret)` construction is weaker than HMAC-SHA256 (length-extension/structural weaknesses; HMAC exists precisely to key a hash correctly). The verifier *does* already do the right surrounding hygiene — length check + `crypto.timingSafeEqual` (`:53-62`) and a 5-minute replay window via `MAX_TIMESTAMP_DRIFT_MS` + `validateWebhookTimestamp()` (`:29,71-96`). Those must be **kept**. The hash construction itself must move to true **HMAC-SHA256** (`crypto.createHmac("sha256", secret).update(rawPayload)`), coordinated with Dr Green's signing side.

3. **Outbound BudStacks webhook has no SSRF egress filter (HIGH — elevated).** `lib/webhook.ts:77-104` `deliverWebhook()` POSTs to `webhook.url` (`:95`) — a **tenant-supplied** URL — with an HMAC signature (`generateWebhookSignature`, `:92,162-169`, which *is* correct HMAC-SHA256). The signature authenticates BudStacks to the recipient but does **nothing** to stop the request targeting an internal address. There is no allowlist, no DNS resolution check, and `fetch` follows redirects by default. Reachable targets include `169.254.169.254` (cloud-metadata IMDS), `127.0.0.1`/loopback, RFC-1918 ranges, and `*.railway.internal` (the private service network — Postgres/Redis live there). A tenant can register a webhook URL pointing at internal infra and use BudStacks as an SSRF pivot. Deliverable: resolve the URL, block private/link-local/loopback/metadata/internal ranges **before** fetching, enforce `https:`, and cap redirects (re-validating each hop).

4. **Encryption migration deadline `2026-12-31` is too far out (MEDIUM).** The fail-open window is governed by `migrationDeadline`. It is hardcoded as the literal `"2026-12-31"` in all three webhook routes (`status:80`, `fiat:133`, `crypto:152`) and defaults from `ENCRYPTION_MIGRATION_DEADLINE` (`lib/encryption.ts:5,52`). Seven-plus months of "accept anything" is an unnecessarily long exposure. Once §1 makes `decrypt` fail-closed, the deadline window should be **shrunk** to a short, explicit migration window (days, not months) and ideally retired entirely.

5. **Rate limiter fails open silently when Redis is down (MEDIUM).** `lib/rate-limit.ts:92-97` catches Redis errors and returns `{ success: true }` with only a `console.warn` — every rate limit silently disappears the moment Redis is unreachable, with **no alert**. On a payment/KYC platform that turns a Redis blip into an unthrottled-abuse window nobody is paged about. Deliverable: emit an alert (hook to PRD-215 alerting) on fail-open, and make the fail-open-vs-fail-closed choice **explicit and per-call-site** (auth/payment-adjacent limiters should consider fail-closed; public read paths may stay fail-open-with-alarm).

6. **Inbound webhook resolves tenant from attacker input *before* verifying the signature (MEDIUM).** `status/route.ts` calls `resolveTenant(event, { clientId, orderId, strainId })` at `:68` — which runs DB queries on **unauthenticated, attacker-controlled** identifiers (`consultation_questionnaires.findFirst`/`users.findFirst` at `:150,166`) — and only **then** verifies the signature at `:82`. `fiat/route.ts:100,135` and `crypto/route.ts:117,154` do the same (resolve `orders.findFirst` before verify). This is a pre-auth DB-query surface (enumeration / DB-load amplification on forged payloads). The signature must be verified **before** any tenant-resolution DB work — which requires a way to obtain the verifying secret without a per-payload DB lookup (see §13 OQ-3).

This PRD: makes `decrypt` fail closed; upgrades the inbound verifier to true HMAC-SHA256 (keeping timing-safe compare + replay window); adds an SSRF egress filter to the outbound webhook; shrinks/retires the migration deadline; alerts on rate-limit fail-open; and reorders the inbound webhook to verify-then-resolve.

## 2. Users / personas

| Role | How they benefit |
|---|---|
| **Every tenant** | Their Dr Green signing key can never be silently mis-handled as ciphertext-plaintext; their webhook config can't be used to attack internal infra |
| **Storefront customer** | Payment/KYC webhooks are authenticated with real HMAC before any processing |
| **Gerard / ops** | A Redis outage pages someone instead of silently disabling all rate limits; cloud-metadata/internal egress is blocked |
| **Incident responder** | `decrypt` failures surface loudly instead of masquerading as a working-but-wrong secret |
| **Enterprise prospect** | "How do you prevent SSRF / how is webhook auth done?" has a concrete answer |

## 3. User stories

- As an **attacker** who forges a Dr Green webhook, my payload is rejected at signature verification **before** any database query runs on my chosen `clientId`/`orderId`.
- As an **attacker** who controls a tenant's outbound webhook URL, I cannot point it at `169.254.169.254` or `*.railway.internal` — the egress filter blocks the request before `fetch`.
- As an **operator**, when Redis goes down, I get an alert and a documented decision about whether limits fail open or closed — not a silent gap.
- As a **developer**, `decrypt()` either returns real plaintext or throws — it never returns the ciphertext I gave it.
- As a **security reviewer**, the inbound verifier is true HMAC-SHA256, timing-safe, with a 5-minute replay window — describable as such without caveat.

## 4. Acceptance criteria

**`decrypt` fails closed:**

- [ ] **AC-1** `lib/encryption.ts` `decrypt()` **never returns its input `text`**. The two `return text` branches (`:110` malformed-shape and `:135` legacy-decrypt-catch under `isMigrationAllowed`) are removed. On any failure it throws `DecryptionError`.
- [ ] **AC-1a** The `allowUnencryptedMigration` semantics, if retained at all, are redefined to mean **"a value already known to be stored unencrypted may be read as-is only when it does not look encrypted"** — gated by a positive `isEncryptedValue()` check that correctly recognises **both** the 4-part `v2:` shape and the 3-part legacy shape (so a v2 value is never misread as legacy and skipped). It must never return ciphertext as plaintext.
- [ ] **AC-1b** A shared `isEncryptedValue(text)` helper is exported from `lib/encryption.ts` and is the single source of truth for "is this encrypted?", matching `v2:iv:authTag:ciphertext` (4 parts, `parts[0]==="v2"`) **and** legacy `iv:authTag:ciphertext` (3 parts, hex). Any caller doing ad-hoc part-count checks is migrated to it.

**Inbound verifier → true HMAC-SHA256:**

- [ ] **AC-2** `verifyDrGreenWebhookSignature()` (`lib/drgreen-webhook-verify.ts:36-65`) computes `crypto.createHmac("sha256", secret).update(rawPayload).digest(...)` instead of `createHash("sha256").update(rawPayload + secret)`. The misleading `:33` "plain hash, NOT HMAC" comment is replaced.
- [ ] **AC-2a** The existing length-check + `crypto.timingSafeEqual` comparison (`:53-62`) and both hex/base64 acceptance are **preserved**; the 5-minute replay window (`MAX_TIMESTAMP_DRIFT_MS`, `validateWebhookTimestamp`) is **unchanged**.
- [ ] **AC-2b** The HMAC cutover is coordinated with Dr Green's signing side (config flag / dual-accept window if needed — see §13 OQ-1) so live webhooks are not dropped during rollout.

**Outbound SSRF egress filter:**

- [ ] **AC-3** Before `fetch(webhook.url, …)` in `lib/webhook.ts:95`, the URL is validated by a new `assertSafeWebhookUrl(url)`: scheme must be `https:`; the host is DNS-resolved and the resolved IP(s) are rejected if in loopback (`127.0.0.0/8`, `::1`), link-local (`169.254.0.0/16`, `fe80::/10`, incl. `169.254.169.254`), RFC-1918 private (`10/8`, `172.16/12`, `192.168/16`), unique-local IPv6 (`fc00::/7`), `0.0.0.0`, or any host ending in `.railway.internal` / `.internal` / resolving to the Railway private range.
- [ ] **AC-3a** Redirects are capped and **each hop re-validated** (use `redirect: "manual"` and re-run `assertSafeWebhookUrl` on the `Location`, max 2 hops) so a public URL cannot 302 to an internal one. A blocked URL fails the delivery with a logged `webhook.delivery_blocked_ssrf` reason and does **not** retry into the same target.
- [ ] **AC-3b** Webhook URL is also validated at **registration** time (wherever tenants create/update a webhook) with the same `assertSafeWebhookUrl`, so bad URLs are rejected up front, not just at delivery.

**Shrink the migration deadline:**

- [ ] **AC-4** The hardcoded `"2026-12-31"` literal is removed from `status/route.ts:80`, `fiat/route.ts:133`, `crypto/route.ts:152`. The migration window (if still needed after AC-1) is driven solely by `ENCRYPTION_MIGRATION_DEADLINE` and set to a **short** value (≤ 30 days from deploy, recorded in §13 OQ-2); the goal is to retire the flag entirely once all `drGreenSecretKey` values are confirmed v2-encrypted.
- [ ] **AC-4a** A one-off audit confirms every persisted `tenants.drGreenSecretKey` is v2-encrypted (`isEncryptedValue` + decrypts cleanly); the count is recorded, after which `allowUnencryptedMigration: true` is removed from the three routes.

**Rate-limit fail-open alerting:**

- [ ] **AC-5** `lib/rate-limit.ts` fail-open path (`:92-97`) emits an alert event (`ops.rate_limit_failopen`) in addition to the log, wired to PRD-215 alerting. The Redis error is no longer only a `console.warn`.
- [ ] **AC-5a** `checkRateLimit` accepts an explicit `failMode: "open" | "closed"` (default `"open"` to preserve current behaviour), and auth/payment-adjacent call sites (onboarding, account-delete/export) are reviewed and set per §13 OQ-4. Fail-closed returns a 503 with `Retry-After`, not a silent pass.

**Verify before resolve:**

- [ ] **AC-6** In `status/route.ts`, signature verification happens **before** `resolveTenant()` runs any DB query on attacker-supplied ids. `fiat/route.ts` and `crypto/route.ts` are reordered the same way. No `prisma.*.findFirst/findUnique` on request-body identifiers executes prior to a passing signature check.
- [ ] **AC-6a** Because the per-tenant secret is currently fetched *during* resolution, the reorder uses the strategy chosen in OQ-3 (e.g. a platform-level shared inbound secret for signature verification, or a non-DB key lookup) so verification no longer depends on a pre-verification DB read.

## 4.1 Design framework conformance

No UI surface. All changes are server-side crypto/edge hardening.

- [x] No UI — N/A
- [x] No template-specific values introduced
- [x] `apiError()` envelope (`lib/api-error.ts`) used for any new client-facing error responses (e.g. 503 on fail-closed) — no raw error text leaked (cross-ref PRD-200 AC-5)

## 5. Scope

**In scope:** `decrypt` fail-closed + `isEncryptedValue` helper; inbound verifier → HMAC-SHA256 (keeping timing-safe + replay window); outbound webhook SSRF egress filter (delivery + registration + redirect re-validation); migration-deadline shrink/retire; rate-limit fail-open alerting + explicit failMode; inbound webhook verify-before-resolve reordering.

**Out of scope:**
- `ENCRYPTION_KEY` rotation itself → PRD-200 (this PRD defines the versioned-key flow it uses).
- PHI/PII redaction in webhook logs → PRD-215 (this PRD keeps the existing `sanitizeForLogging`).
- The alerting transport (PagerDuty/Slack/email) → PRD-215 (this PRD emits the event).
- GDPR erasure over encrypted columns → PRD-213 (depends on AC-1 landing first).
- Broad input-validation sweep → PRD-204 (this PRD only touches the webhook/encryption boundaries).

## 6. Non-functional requirements

| NFR | Requirement |
|---|---|
| Security | `decrypt` never returns ciphertext as plaintext; inbound verify is HMAC-SHA256 + timing-safe + 5-min replay; outbound egress blocks private/metadata/internal IPs; signature verified before any DB query |
| Backward compatibility | HMAC cutover coordinated with Dr Green (dual-accept window if needed) so no live webhook is dropped; existing valid signatures over the migration window keep working |
| Performance | SSRF DNS resolution adds < 20 ms per outbound delivery (cached where safe); HMAC vs hash is negligible |
| Observability | Rate-limit fail-open and SSRF blocks emit alert-able events; decrypt failures throw and are logged with correlation id |
| Reversibility | Migration deadline is config-driven; HMAC rollout flag allows rollback to dual-accept if Dr Green coordination slips |

## 7. Success metrics

- `decrypt()` `return text` branches = **0** (grep/AST gate); decrypt failures throw `DecryptionError`.
- Inbound verifier uses `createHmac` (not `createHash`) — grep gate; unit test proves HMAC equivalence with Dr Green's reference vector.
- Outbound delivery to `169.254.169.254`, `127.0.0.1`, a `10.x` host, and a `*.railway.internal` host is **blocked** (integration test); redirect-to-internal is blocked.
- `migrationDeadline` literal `"2026-12-31"` occurrences = **0**; `ENCRYPTION_MIGRATION_DEADLINE` ≤ 30 days or unset.
- Rate-limit fail-open emits `ops.rate_limit_failopen` (test asserts the alert fires on a Redis-down mock).
- Zero `findFirst/findUnique` on body identifiers before signature verify across the three webhook routes (code review + test).

## 8. API surface

| Method | Path | Change |
|---|---|---|
| POST | `/api/webhooks/drgreen/status` | Verify-before-resolve; HMAC verification; fail-closed decrypt |
| POST | `/api/webhooks/drgreen/fiat` | Verify-before-resolve; HMAC verification; fail-closed decrypt |
| POST | `/api/webhooks/drgreen/crypto` | Verify-before-resolve; HMAC verification; fail-closed decrypt |
| POST/PUT | tenant webhook registration route | URL validated by `assertSafeWebhookUrl` (https + non-internal) |

No new public endpoints. Internal contract changes: `decrypt` throws instead of returning input; `checkRateLimit` gains `failMode`.

## 9. Data model changes

None to the schema. A one-off audit/migration confirms all `tenants.drGreenSecretKey` values are v2-encrypted (AC-4a); no column change.

## 10. Events emitted / consumed

| Event | Direction | Payload | Subscribers |
|---|---|---|---|
| `ops.rate_limit_failopen` | emit | `{ identifier, error }` | alerting (PRD-215) |
| `webhook.delivery_blocked_ssrf` | emit | `{ tenantId, webhookId, host, reason }` | logs / alerting (PRD-215) |
| `security.decrypt_failed` | emit (log) | `{ context, correlationId }` | logs / audit (PRD-215) |
| `webhook.signature_rejected` | emit (log) | `{ route, event }` | logs (PRD-215) |

(Log lines today; PRD-215 formalises the event bus + alert transport.)

## 11. UI / UX

No visible UI change for storefront/admin. Tenants registering a webhook with an internal/non-https URL now get a validation error at save time (handled via the standard `apiError()` envelope).

## 12. Test plan

**Unit (Vitest — stood up in PRD-207):**
- `encryption.test.ts` — `decrypt` throws `DecryptionError` on malformed input and on decrypt failure (never returns input); round-trips v2 ciphertext; `isEncryptedValue` correctly classifies v2 (4-part), legacy (3-part), and plaintext.
- `drgreen-webhook-verify.test.ts` — `verifyDrGreenWebhookSignature` matches an HMAC-SHA256 reference vector; rejects a plain-`H(payload+secret)` value; timing-safe path; replay window still rejects > 5-min-old timestamps.
- `webhook-ssrf.test.ts` — `assertSafeWebhookUrl` rejects loopback, `169.254.169.254`, RFC-1918, `fc00::/7`, `*.railway.internal`, http (non-TLS); accepts a normal public https URL.
- `rate-limit.test.ts` — Redis-down → `failMode:"open"` returns success **and** emits `ops.rate_limit_failopen`; `failMode:"closed"` returns 503.

**Integration (testcontainers — PRD-207):**
- `webhook-delivery-ssrf.integration.test.ts` — `deliverWebhook` against a server that 302-redirects to an internal IP is blocked at the hop re-validation; no request reaches the internal target.
- `drgreen-status-verify-order.integration.test.ts` — a forged payload (no/invalid signature) returns 401 **without** any tenant-resolution DB query running (assert via Prisma spy / query log).

**E2E (Playwright):**
- `webhook-registration-ssrf.spec.ts` — a tenant admin attempting to save a webhook URL of `http://169.254.169.254/` gets a validation error.

**Coverage target:** **95%** on `lib/encryption.ts`, `lib/drgreen-webhook-verify.ts`, the new `assertSafeWebhookUrl` in `lib/webhook.ts`, and the `lib/rate-limit.ts` fail path (all security-critical).

## 13. Open questions

- [ ] **OQ-1** HMAC cutover coordination with Dr Green — do they support a config flag / dual-accept (HMAC **and** legacy hash) window, or is it a hard switch? Owner: Gerard (Dr Green liaison). Resolution: prefer a short dual-accept window behind a flag; fall back to a scheduled hard cutover if Dr Green can't dual-sign.
- [ ] **OQ-2** Target value for `ENCRYPTION_MIGRATION_DEADLINE` once `decrypt` fails closed — a fixed short window (e.g. 14 days) or retire the flag immediately after the AC-4a audit confirms all keys are v2? Owner: Gerard. Resolution: run the audit; if 100% v2, remove the flag in this PRD; else set ≤ 30 days and ticket the cleanup.
- [ ] **OQ-3** Verify-before-resolve needs the verifying secret **without** a per-payload DB read. Options: (a) a single platform-level inbound Dr Green secret (`DRGREEN_WEBHOOK_SECRET`) used for signature verification, with per-tenant `drGreenSecretKey` reserved for outbound calls; (b) a cached/keyed lookup that is not attacker-influenced. Owner: Gerard + Claude. Resolution: confirm with Dr Green whether they sign with a single platform secret or per-tenant; if single, adopt (a) — simplest and removes the pre-verify DB dependency entirely.
- [ ] **OQ-4** Which rate-limit call sites should fail **closed**? Onboarding (org/user creation), account delete/export are candidates; public storefront reads should stay fail-open-with-alarm. Owner: Gerard. Resolution: enumerate call sites; default closed for write/auth-adjacent, open-with-alarm for public reads.
- [ ] **OQ-5** DNS-rebinding hardening for `assertSafeWebhookUrl` — resolve-then-pin the IP and connect to the pinned IP (not re-resolve) to avoid TOCTOU between check and `fetch`? Owner: Claude. Resolution: pin resolved IP via a custom lookup/agent where feasible; at minimum re-validate on redirect.

## 14. Dependencies

**Strict:** None to start.

**Blocks:**
- **PRD-213 (GDPR)** — erasure flows read/rewrite the same encrypted `drGreenSecretKey`; `decrypt` must fail closed (AC-1) before erasure logic depends on it.

**Soft:**
- PRD-200 (`ENCRYPTION_KEY` rotation) — uses the versioned-key flow; coordinate so rotation + this hardening land in the same window.
- PRD-215 (alerting + structured logger) — consumes the events in §10; until it lands, they are log lines.
- PRD-207 (test foundation) — the 95%-coverage suite needs Vitest + testcontainers.
- PRD-204 (input validation) — webhook registration URL validation dovetails with the Zod sweep.

## 15. Estimated effort

- **`decrypt` fail-closed + `isEncryptedValue` helper + caller migration:** 3 hours
- **Inbound verifier → HMAC-SHA256 + Dr Green dual-accept flag:** 3 hours
- **Outbound `assertSafeWebhookUrl` (IP-range checks, redirect re-validation, registration-time validation):** 5 hours
- **Migration-deadline shrink + key audit (AC-4a):** 2 hours
- **Rate-limit alert + `failMode`:** 2 hours
- **Verify-before-resolve reorder across 3 routes (incl. OQ-3 secret-source change):** 3 hours
- **Tests (unit + integration + E2E) at 95% on crypto/edge:** 6 hours
- **Total:** ≈ 24 hours (≈ 2 days for 1 dev + Claude pair; +0.5 day if Dr Green HMAC coordination is slow)

## 16. References

- Existing code: `lib/encryption.ts:5,43,48,52,77-89,98,101-106,109-110,115,130-138` (fail-open `return text` at `:110,135`); `lib/drgreen-webhook-verify.ts:29,33,36-65,71-96` (plain-hash at `:44-47`, comment at `:33`); `lib/webhook.ts:77-104,92,95,162-169` (tenant-URL `fetch` at `:95`, correct outbound HMAC at `:162-169`); `lib/rate-limit.ts:50-100` (fail-open at `:92-97`); `app/api/webhooks/drgreen/status/route.ts:68,78-81,82,150,166`; `app/api/webhooks/drgreen/fiat/route.ts:100,131-134,135`; `app/api/webhooks/drgreen/crypto/route.ts:117,150-154,154`
- API error helper: `lib/api-error.ts` (`apiError`, `apiValidationError`, `ApiError`)
- Memory: `project_encryption_v2_prefix.md` — `encrypt()` writes 4-part `v2:iv:authTag:ciphertext`; a 3-part-only `isEncryptedValue` check skips decrypt and pipes raw ciphertext downstream (AC-1b); `drgreen_api_flow.md`
- Standards: [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [RFC 2104 (HMAC)](https://www.rfc-editor.org/rfc/rfc2104), [Node `crypto.createHmac`](https://nodejs.org/api/crypto.html#cryptocreatehmacalgorithm-key-options)
- 2026-05-29 review: encryption-fallback finding; rate-limit fail-open finding; webhook verify-before-resolve finding; **[ELEVATED → HIGH]** outbound webhook SSRF (`lib/webhook.ts:95`); **retracted "textbook HMAC" praise** — the inbound verifier is a plain SHA-256 hash, corrected here to true HMAC

## 17. Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-05-29 | Claude (with Gerard) | Initial draft from 2026-05-29 review. |
| 0.2 | 2026-05-29 | Claude (Opus 4.8) | Verified against code: separated the two webhooks (inbound verifier `drgreen-webhook-verify.ts` is **plain hash, NOT HMAC** per its own `:33` comment → harden to HMAC-SHA256 keeping timing-safe + 5-min replay; outbound `webhook.ts:95` fetches tenant URLs with **no SSRF filter** → elevated HIGH). Confirmed `decrypt` `return text` fail-open at `:110,135`; `migrationDeadline:"2026-12-31"` hardcoded in all 3 webhook routes; rate-limit fail-open at `rate-limit.ts:92-97`; resolve-before-verify ordering in status/fiat/crypto routes. Added `isEncryptedValue` 4-part-vs-3-part landmine from memory. |
