# Runbook — Redis Down

> **Severity:** Sev-2 (degradation; rate-limiting fails open per config).
> **Architecture reference:** [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) — Redis (ioredis `^5.9.1`) backs rate-limiting and BullMQ queues; `REDIS_URL = ${{Redis.REDIS_URL}}` on Railway's private network.
> **Related:** [`rate-limit-fail-open.md`](./rate-limit-fail-open.md), [`incident-response.md`](./incident-response.md).

---

## 1. Symptoms

- Status pill `dependencies.redis == "degraded"` (`GET /api/health`).
- Alert `ops.rate_limit_fail_open` firing (rate-limiter lost its backend → `lib/rate-limit.ts`).
- BullMQ jobs (email worker etc.) stalling.

## 2. Blast radius

- **Rate limiting:** public read endpoints **fail open** (requests pass through unmetered) — availability preserved, metering lost. Auth/write-adjacent call sites configured `failMode: "closed"` return `503`.
- **Queues:** background jobs (email) pause until Redis returns; they resume — BullMQ persists to Redis, so a Redis **data loss** (not just unavailability) drops queued jobs.

## 3. Diagnose

```bash
# Health detail — confirm it is Redis, not the app:
curl -s -H "Authorization: Bearer $HEALTH_DETAIL_TOKEN" https://<host>/api/health | jq '.services.redis'

# Railway: is the Redis service up?
#   Dashboard → Redis service → Deployments / Metrics / Logs
```

Common causes: Redis service crashed/redeploying on Railway; `REDIS_URL` wrong after an env change; private-network hiccup; Redis OOM.

## 4. Mitigate / recover

1. **Restart Redis** on Railway (Dashboard → Redis → Restart). Watch it come healthy.
2. **Verify connectivity** — the health pill should flip back to `ok` within ~60s.
3. If `REDIS_URL` drifted, restore it to `${{Redis.REDIS_URL}}` and redeploy the app.
4. If Redis was OOM, raise the plan/memory; review key TTLs (rate-limit keys are short-lived `pexpire`).

## 5. Why fail-open is safe-by-design

`lib/rate-limit.ts` chooses **availability over enforcement** for public reads (blocking real patients is worse than a brief metering lapse) and **enforcement over availability** for write-adjacent endpoints (`failMode: "closed"` → `503`). Either way the failure **pages on-call** via `lib/alert.ts` so the gap is never silent. See [`rate-limit-fail-open.md`](./rate-limit-fail-open.md).

## 6. Exit criteria

- `dependencies.redis == "ok"`.
- `ops.rate_limit_fail_open` alerts stop.
- Queue depth draining; email worker healthy.
