# Runbook — Incident Response

> **Scope:** master incident process — severity levels, comms, and the correlation-id lookup that ties a client error to a server log.
> **Architecture reference:** [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) (Next.js 14 on Railway, Postgres 17, Redis, Dr Green, Clerk).
> **Measured against:** [`docs/SLO.md`](../SLO.md).
> **Owner / on-call:** Gerard.

---

## 1. Severity levels

| Sev | Definition | Examples | Response |
|---|---|---|---|
| **Sev-1** | Customer-facing outage or data-protection breach in progress | Storefront down (health `503` > 2 min, Postgres unreachable); confirmed PHI exfiltration | Page on-call immediately; all-hands; start incident doc |
| **Sev-2** | Major degradation or a control silently failing | Rate-limiting failing open (Redis down); Dr Green errors > 25%; a confirmed PII/PHI line in logs | Page on-call; mitigate within the hour |
| **Sev-3** | Minor / contained, no customer impact | Single non-critical job failing; elevated but in-budget latency | Next business day |

Targets and error-budget policy: [`docs/SLO.md`](../SLO.md).

---

## 2. First 15 minutes

1. **Acknowledge** the alert (alert channel → `lib/alert.ts`).
2. **Classify** severity (table above).
3. **Check the status surface:**
   ```bash
   curl -s https://<host>/api/health | jq                       # public pills
   curl -s -H "Authorization: Bearer $HEALTH_DETAIL_TOKEN" \
        https://<host>/api/health | jq                          # detail
   ```
   Which dependency is `degraded`? → jump to that runbook:
   - Redis → [`redis-down.md`](./redis-down.md)
   - Dr Green → [`drgreen-api-down.md`](./drgreen-api-down.md)
   - Database → [`postgres-failover-and-restore.md`](./postgres-failover-and-restore.md)
   - Rate-limit fail-open alert → [`rate-limit-fail-open.md`](./rate-limit-fail-open.md)
4. **Communicate** (Section 4).

---

## 3. Correlation-id lookup (PRD-215)

Every 5xx API response carries a `correlationId` (see `lib/api-error.ts`), and the server log line for that error is emitted via the structured logger (`lib/logger.ts`) with the **same** id.

- A customer/support reports an error → grab the `correlationId` from the JSON body:
  ```json
  { "error": "An internal error occurred", "correlationId": "b1c2…" }
  ```
- Find the matching server log in the Railway log store:
  ```bash
  # Railway dashboard → service → Logs → filter:
  correlationId=b1c2…
  ```
- The log line is **redacted** (no PII/PHI — `lib/redact.ts`), so it is safe to paste into an incident doc. It carries route, status, message, and stack — enough to triage without leaking subject data.

---

## 4. Communications

| Audience | When | Channel |
|---|---|---|
| On-call / eng | Immediately (Sev-1/2) | Alert channel + incident doc |
| Affected tenants | Sev-1, or Sev-2 > 30 min | Status page incident (see [`STATUS_PAGE.md`](../STATUS_PAGE.md)) |
| DPO | Any confirmed PII/PHI exposure | Direct, within breach-notification window |

`RALPH_BLOCKED:` the live alert transport (Slack/PagerDuty) and the hosted status page are infra-provisioned (`lib/alert.ts` ships the interface; delivery is stubbed behind `ALERT_WEBHOOK_URL`). Until wired, the alert breadcrumb lands in the redacted log stream.

---

## 5. After the incident

1. Restore service; confirm the relevant dependency pill returns to `ok`.
2. Write a short post-incident note: timeline, root cause, correlation ids, error-budget burn.
3. If a runbook gap was hit, fix the runbook in the same PR as any code fix.
4. If PII/PHI reached a log, treat as Sev-2 minimum: redact/rotate, confirm `lib/redact.ts` covers the field, add a test.
