# BudStacks — Service Level Objectives (SLO)

> **Status:** v1 (PRD-215). Owner: Gerard. Compliance/ops sign-off: Gerard + DPO advisor.
> **Architecture reference:** [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) — Next.js 14 on Railway, Postgres 17, Redis (ioredis), Dr Green external API, Clerk auth.
> **Measured by:** the health/status surface (`/api/health`, see [`STATUS_PAGE.md`](./STATUS_PAGE.md)) + the alerting channel (`lib/alert.ts`).

This document defines what "healthy" means for BudStacks, the error budget that follows from it, and how a breach becomes an incident. It is the yardstick the status page and alerting measure against.

---

## 1. Service tiers

| Tier | Surface | Why it matters |
|---|---|---|
| **Tier 1 — Storefront** | Public tenant storefronts (browse, consultation submit, checkout) | Revenue + patient access. An outage here is customer-visible and reportable. |
| **Tier 2 — Tenant admin** | `/tenant-admin/*` console | Operators manage their store; degraded ≠ customer-facing but blocks fulfilment ops. |
| **Tier 3 — Platform admin** | `/super-admin/*`, internal jobs | Internal; highest tolerance. |

---

## 2. Objectives

### 2.1 Availability

| Tier | Monthly availability target | Allowed downtime / 30 days |
|---|---|---|
| Tier 1 — Storefront | **99.9%** | ≈ 43m 49s |
| Tier 2 — Tenant admin | 99.5% | ≈ 3h 39m |
| Tier 3 — Platform admin | 99.0% | ≈ 7h 18m |

**"Available"** = the health endpoint returns `200` AND the storefront root returns a non-5xx within the latency target below. A dependency being `degraded` (e.g. Redis down with rate-limiting failing open) does **not** by itself count as unavailable if requests still succeed — but it consumes error budget via the alerting path and must be tracked.

### 2.2 Latency

| Surface | Target |
|---|---|
| Storefront page (p95, server response) | **< 800 ms** |
| Storefront page (p99) | < 2000 ms |
| `/api/health` (p95) | < 300 ms |
| Consultation submit (p95, excludes Dr Green upstream) | < 1500 ms |

Dr Green API latency is **upstream** and excluded from our latency SLO; its availability is tracked separately and has its own runbook ([`runbooks/drgreen-api-down.md`](./runbooks/drgreen-api-down.md)).

### 2.3 Correctness / data protection

- **0** PII/PHI fields in log lines (enforced by `lib/logger.ts` + `lib/redact.ts` redaction and the PRD-216 grep gate). A single confirmed leak is a **Sev-2** incident regardless of availability.

---

## 3. Error budget

Error budget = `1 − availability target`, measured monthly.

| Tier | Error budget / 30 days |
|---|---|
| Tier 1 | 0.1% ≈ 43m 49s |
| Tier 2 | 0.5% ≈ 3h 39m |
| Tier 3 | 1.0% ≈ 7h 18m |

**Policy when the budget is burned:**

- **> 50% consumed in a month** → freeze risky storefront changes; prioritise reliability work (runbook gaps, alert coverage).
- **100% consumed** → Sev-2 review; no non-critical storefront deploys until budget recovers the following window.
- Budget **resets monthly** (calendar UTC).

---

## 4. How a breach maps to an incident

| Signal | Severity | Action |
|---|---|---|
| Health endpoint `503` (DB down) sustained > 2 min | **Sev-1** | Page on-call; [`postgres-failover-and-restore.md`](./runbooks/postgres-failover-and-restore.md) |
| Storefront p95 > 2× target for 10 min | Sev-2 | Page on-call; investigate (DB, Dr Green, deploy) |
| `ops.rate_limit_fail_open` alert (Redis down) | Sev-2 | [`redis-down.md`](./runbooks/redis-down.md) + [`rate-limit-fail-open.md`](./runbooks/rate-limit-fail-open.md) |
| Dr Green API errors > 25% for 10 min | Sev-2 | [`drgreen-api-down.md`](./runbooks/drgreen-api-down.md) |
| Any confirmed PII/PHI in a log line | Sev-2 | Incident-response runbook; rotate/redact; DPO notified |
| `security.tenant_context_missing` alert (should be 0) | Sev-2 | Incident-response runbook |

Severity definitions live in [`runbooks/incident-response.md`](./runbooks/incident-response.md).

---

## 5. Log retention (OQ-5)

> Bounded retention supports PRD-213 (GDPR erasure completeness): PII must not persist in logs beyond the window, and because logs are redacted at the boundary they should contain **no** subject PII in the first place.

- **Application logs (Railway log store):** retained **30 days**, then aged out. Logs are redacted at the boundary (`lib/logger.ts`), so no special-category data should be present; the 30-day bound is a defence-in-depth backstop.
- **Audit logs (`audit_logs` table):** retained per the compliance schedule (separate from app logs; metadata already redacted via `lib/audit-log.ts`).
- **Alert history (transport-side, e.g. Slack/PagerDuty):** governed by the transport's retention; alert payloads carry only hashed identifiers (see `lib/rate-limit.ts`).

`RALPH_BLOCKED:` enforcing the 30-day Railway log retention window requires a Railway log-drain / retention setting that is configured in the Railway console, not in code. Track under the alerting/aggregation follow-up.

---

## 6. Out of scope (follow-ups)

- Centralised log **aggregation / SIEM** beyond Railway's store → follow-up.
- **APM / distributed tracing** (OpenTelemetry) → follow-up; correlation ids (`lib/logger.ts` child loggers) are the minimum today.
- Automated SLO **burn-rate alerting** → depends on a metrics backend; manual review until then.
