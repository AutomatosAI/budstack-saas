# Runbook — Transactional Email Worker (PRD-220 Part A)

> **Last updated:** 2026-07-10
> **Owner:** Gerard + Claude
> **Related:** [PRD-220](../PRDS/REMEDIATION/PRD-220-silent-failure-cluster.md) · [redis-down.md](./redis-down.md)

## How email works

`MailerService.send()` (`lib/email/mailer.ts`) **enqueues** every email into the BullMQ queue `email-sending` (Redis) and writes an `email_logs` row with `status: QUEUED`. The **worker** (`scripts/email-worker.ts`) consumes the queue, resolves per-tenant SMTP (tenant settings → platform config → `EMAIL_SERVER` env), sends, and flips the log row to `SENT`/`FAILED`.

**Topology:** the worker runs as a **sidecar inside the web container** — `entrypoint.sh` starts it in a restart loop before `exec node app/server.js`. There is deliberately **no separate Railway service** (2026-07-10 finding: none ever existed, which is why all mail sat QUEUED — see PRD-220 §1A). If email volume ever justifies isolation, promote the same `pnpm email:worker` start command to its own Railway service and delete the entrypoint block.

## Health signals

| Signal | Where | Meaning |
|---|---|---|
| Heartbeat | Redis key `email-worker:heartbeat` (ISO timestamp, TTL 90s) | Key present = worker alive within ~90s |
| Health endpoint | `GET /api/super-admin/ops/email-health` (super-admin session) | Worker liveness + BullMQ counts + QUEUED backlog + `stuck` boolean |
| Stuck-queue alert | Log line starting `[EmailWorker][ALERT] oldest actionable QUEUED email` | Oldest send-eligible QUEUED row breached the threshold (default 15 min). **Configure a Railway log alert matching that exact prefix.** |
| Sidecar restart | Log line `[EmailWorker] exited with code N — restarting in 5s` | Worker crashed; loop revived it. Frequent occurrences = investigate |

## Tunables (env, all optional)

| Var | Default | Effect |
|---|---|---|
| `EMAIL_MAX_JOB_AGE_MS` | 172800000 (48 h) | Jobs older than this are **expired, not sent** (log row → `FAILED`, message starts `Expired unsent (PRD-220)`) |
| `EMAIL_QUEUED_ALERT_AGE_MS` | 900000 (15 min) | Age of oldest send-eligible QUEUED row that triggers the alert line |

## Common situations

### "Emails aren't arriving"
1. `GET /api/super-admin/ops/email-health` → `worker.alive`?
   - **false** → check deploy logs for the sidecar start line (`📧 Starting email worker sidecar...`) or the `REDIS_URL not set` warning. Redis down? → [redis-down.md](./redis-down.md).
   - **true** → check `logs.queuedTotal` and `queue.failed`. Rising `failed` = SMTP problem: look for `[EmailWorker] Job … failed` lines (bad tenant SMTP creds, missing platform config). Test with super-admin **test-smtp** endpoint.
2. Check the recipient's `email_logs` row: `QUEUED` = never picked up (worker/Redis); `FAILED` = see `errorMessage`; `SENT` = delivery problem downstream of us (spam folder, provider).

### First deploy after this feature / after a long worker outage
A backlog of stale jobs will be waiting in Redis. The worker **expires** anything older than `EMAIL_MAX_JOB_AGE_MS` instead of sending it (no blast of weeks-old invites). `email_logs` rows whose Redis job vanished entirely stay `QUEUED` forever — drain them once:

```bash
# dry-run (counts only)
npx tsx scripts/expire-stale-queued-email-logs.ts
# actually mark them FAILED
npx tsx scripts/expire-stale-queued-email-logs.ts --apply
```

Run as a Railway one-off against Production, or locally with the prod `DATABASE_URL`.

### Verify end-to-end after a deploy
1. Health endpoint shows `worker.alive: true`.
2. Trigger any real email (e.g. team invite to yourself).
3. Its `email_logs` row goes `QUEUED → SENT` within ~30 s and the mail arrives.
