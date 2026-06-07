# Runbook — Rate-Limit Fail-Open

> **Severity:** Sev-2 (a control is silently degraded — but now it pages).
> **Trigger:** alert `ops.rate_limit_fail_open` (emitted by `lib/rate-limit.ts` → `lib/alert.ts`).
> **Architecture reference:** [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md).
> **Related:** [`redis-down.md`](./redis-down.md), [`incident-response.md`](./incident-response.md).

---

## 1. What happened

The Redis-backed rate limiter (`lib/rate-limit.ts`) could not reach Redis. Per config it either:

- **failed open** (`failMode: "open"`, default for public reads) — requests passed through **unmetered**; or
- **failed closed** (`failMode: "closed"`, write-adjacent endpoints) — requests got `503`.

Either way it fired `ops.rate_limit_fail_open` to the alert channel so the lapse is **not silent** (PRD-215 AC-7). The alert payload carries a **hashed** identifier (SHA-256, truncated) + `failMode` + `reason: "redis_unavailable"` — never a raw IP/user id.

> **Note:** the *fix* to the fail-open behaviour and the webhook limiter hardening is **PRD-211**. This runbook + the alert channel are PRD-215's contribution — making the event a paged incident.

## 2. Immediate actions

1. **Confirm Redis** is the root cause → run [`redis-down.md`](./redis-down.md) diagnose/recover. The rate-limit fail-open is almost always a symptom of Redis being unreachable.
2. **Assess exposure window:** while failing open, public read endpoints were unmetered. Check for an abuse spike in that window (traffic graphs, unusual I that endpoint).
3. **Restore Redis** → the limiter resumes metering automatically; alerts stop.

## 3. If you see abuse during the open window

- Public read endpoints failing open is the accepted trade-off (availability > metering for reads). If abuse is observed:
  - Temporarily move the affected route(s) to `failMode: "closed"` (a code change — coordinate with PRD-211), or
  - Apply an upstream block (WAF/Railway edge) for the offending source.

## 4. Verify the alert path (induced-failure test)

The fail-open → alert wiring is covered by `tests/unit/rate-limit-fail-open.alert.test.ts`:

```bash
cd nextjs_space && pnpm vitest run tests/unit/rate-limit-fail-open.alert.test.ts
```

It asserts that with Redis unavailable the limiter (a) fails open / closed per config and (b) calls `sendAlert` with `event: "ops.rate_limit_fail_open"` and a hashed identifier. 100% of induced-failure runs must produce the alert (success metric).

## 5. Exit criteria

- Redis healthy (`dependencies.redis == "ok"`).
- `ops.rate_limit_fail_open` alerts stop.
- Abuse window reviewed; no follow-on incident.

`RALPH_BLOCKED:` live paging delivery (Slack/PagerDuty) depends on `ALERT_WEBHOOK_URL` + on-call routing being provisioned; until then the alert lands as a redacted breadcrumb in the log stream (`lib/alert.ts`).
