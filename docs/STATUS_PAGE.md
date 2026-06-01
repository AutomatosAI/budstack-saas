# BudStacks — Status Page

> **Status:** v1 (PRD-215, AC-4). Owner: Gerard.
> **Architecture reference:** [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md).
> **Backed by:** the health/status surface `GET /api/health` (`nextjs_space/app/api/health/route.ts`).

This document defines the externally-consumable status surface an enterprise customer's vendor-risk team can point at: where uptime/incidents are shown and how the underlying health signal works.

---

## 1. The health/status surface

`GET /api/health` returns two views, gated by the `HEALTH_DETAIL_TOKEN` bearer token (PRD-200 hardening — internal detail must stay behind the token).

### 1.1 Public summary (anonymous callers)

Drives the status page's dependency pills. No internals (no version, memory, latency, or hostnames):

```jsonc
// 200 OK (healthy) or 503 (degraded)
{
  "status": "ok",            // "ok" | "degraded"
  "dependencies": {
    "app":      "ok",        // "ok" | "degraded" | "unknown"
    "database": "ok",
    "redis":    "ok",
    "drgreen":  "ok"
  }
}
```

- **app** — always `ok` if the handler runs (the process is up).
- **database** — Postgres `SELECT 1` round-trip succeeds.
- **redis** — a short-lived `PING` succeeds. `unknown` when `REDIS_URL` is unset (Redis is optional for some deploys); `degraded` on failure.
- **drgreen** — `ok` when platform Dr Green credentials are configured. We do **not** call the live Dr Green API on a health probe (it would cost a request and could trip their rate-limiting); upstream liveness is covered by [`runbooks/drgreen-api-down.md`](./runbooks/drgreen-api-down.md) + synthetic checks.

### 1.2 Authenticated detail (uptime monitoring backend)

With a valid `Authorization: Bearer $HEALTH_DETAIL_TOKEN`, the endpoint returns version, environment, per-service status + DB latency, memory, and uptime. Fails closed: if `HEALTH_DETAIL_TOKEN` is unset, **no** caller can obtain detail.

```bash
curl -H "Authorization: Bearer $HEALTH_DETAIL_TOKEN" https://<host>/api/health
```

---

## 2. Public status page (hosting)

Per OQ-2 the decision is **hosted provider for the public SLA surface, optional in-app `/status` for internal detail**.

**Recommended:** a hosted provider (e.g. Better Uptime / Instatus / Statuspage) configured to:

1. Poll `GET /api/health` (public summary) on a 60s interval from multiple regions.
2. Map the four `dependencies.*` pills to components: **App**, **Database**, **Redis**, **Dr Green**.
3. Treat `503` or any `dependencies.* == "degraded"` as a component incident.
4. Publish a public page (e.g. `status.budstacks.com`) linked from the marketing footer.
5. Maintain an incident timeline + subscriber notifications against the [`SLO.md`](./SLO.md) targets.

`RALPH_BLOCKED:` standing up the hosted status page (provider account, public DNS `status.budstacks.com`, polling config, incident workflow) needs live infra and a provider account — it cannot be delivered in code. The application side (the health/status surface + this spec) is complete; the hosting step is the deferred operational task.

### 2.1 Optional in-app `/status` (AC-9)

If an in-app page is wanted for internal detail, it should:

- Live at `app/status/page.tsx`, fetch the **public summary** (never expose the token client-side), and render the four dependencies as status pills using existing UI primitives — **no new design tokens** (AC-9).
- Be additive: the hosted provider remains the authoritative public SLA surface.

This PRD ships the data surface; the in-app page is optional and not required for AC-4 (the hosted route satisfies it).

---

## 3. Token management

- `HEALTH_DETAIL_TOKEN` is set in the Railway environment (Production + Staging). Rotate it like any other secret (see `runbooks/SECURITY_PHASE_0_RUNBOOK.md`).
- The uptime provider stores it as a secret header on the monitor; the **public** status page never sees it.

---

## 4. Verification

```bash
# Public summary — pills only, no internals:
curl -s https://<host>/api/health | jq

# Authenticated detail:
curl -s -H "Authorization: Bearer $HEALTH_DETAIL_TOKEN" https://<host>/api/health | jq

# Negative: detail must be denied without the token (should return the summary shape):
curl -s https://<host>/api/health | jq 'has("services")'   # → false
```
