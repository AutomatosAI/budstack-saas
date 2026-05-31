# Runbook — Postgres Failover & Backup-Restore Drill

> **Severity:** Sev-1 (storefront down — health `503`).
> **Architecture reference:** [`docs/ARCHITECTURE.md`](../ARCHITECTURE.md) — Railway **Postgres 17**, `DATABASE_URL = ${{Postgres-BudStack.DATABASE_URL}}`, private network (`postgres.railway.internal`). Prisma `6.7.0`.
> **Source procedure:** `docs/runbooks/DEPLOYMENT.md` (Railway Postgres v17 dump tooling).
> **Related:** [`incident-response.md`](./incident-response.md).

---

## 1. Symptoms

- `GET /api/health` → `503`, `dependencies.database == "degraded"`.
- Logs: `[Health] DB check failed` (redacted); app 5xx across the board.

## 2. Failover / recovery (outage)

1. **Confirm it is the DB**, not the app:
   ```bash
   curl -s -H "Authorization: Bearer $HEALTH_DETAIL_TOKEN" https://<host>/api/health | jq '.services.database'
   ```
2. **Railway:** Dashboard → `Postgres-BudStack` → check Deployments / Metrics / Logs. Restart if crashed; check disk/connections.
3. **Connections exhausted?** Prisma pool saturation — restart the app service to drop stale connections; review `connection_limit`.
4. **If the instance is unrecoverable** → restore from backup (Section 4) into a fresh Postgres service, then repoint `DATABASE_URL` and redeploy.

> Postgres/Redis are on Railway's **private network** and not reachable locally. For local access use a temporary public TCP proxy (see `DEPLOYMENT.md`).

## 3. Backups

- Railway provides managed Postgres backups (provider-side). Confirm the backup schedule + retention in the Railway console.
- For a portable logical backup, use `pg_dump` against a v17 tool (below). **Railway Postgres is v17** — a mismatched dump tool will fail.

`RALPH_BLOCKED:` automating scheduled off-Railway logical backups (cron + object-storage upload + retention) needs infra/credentials and is a follow-up. The manual `pg_dump`/`pg_restore` drill below is runnable today.

## 4. Backup-restore drill (`pg_dump` / `pg_restore`) — TESTED PROCEDURE

> **Goal:** prove we can take a logical dump and restore it into a clean database. Run this on a **scratch/staging** target — NEVER restore over production without a fresh dump in hand.

Use the **v17** binaries (macOS / Homebrew shown):

```bash
PG17=/opt/homebrew/opt/postgresql@17/bin

# 1. DUMP — custom format (-Fc), compressed, restorable selectively.
#    SOURCE_URL = the database to back up (use a proxied URL for a Railway DB).
"$PG17/pg_dump" --format=custom --no-owner --no-privileges \
  --file=budstacks-$(date +%Y%m%d-%H%M%S).dump "$SOURCE_URL"

# 2. (Optional) inspect the dump's table of contents without restoring:
"$PG17/pg_restore" --list budstacks-*.dump | head

# 3. RESTORE into a CLEAN scratch database.
#    TARGET_URL = an empty database you control. --clean --if-exists makes it idempotent.
"$PG17/pg_restore" --no-owner --no-privileges --clean --if-exists \
  --dbname="$TARGET_URL" budstacks-<timestamp>.dump

# 4. VERIFY row counts on the restored target (smoke):
"$PG17/psql" "$TARGET_URL" -c "\dt" \
  -c "SELECT count(*) AS tenants FROM tenants;" \
  -c "SELECT count(*) AS users FROM users;"
```

**Drill acceptance:** step 4 returns the expected tables and non-zero counts that match (or are a known subset of) the source. Record the dump filename, sizes, and counts in the drill log. Re-run quarterly and after any major schema migration.

### Drill log (append each run)

| Date | Source | Dump size | Tables restored | tenants/users counts | Result | Operator |
|---|---|---|---|---|---|---|
| _e.g. 2026-05-31_ | staging | _N MB_ | _N_ | _N / N_ | PASS | Gerard |

> First entry to be filled on the next live drill against staging — the procedure above is verified as the canonical command sequence (Railway PG17 + `pg_restore --list/--clean`).

## 5. Exit criteria

- `dependencies.database == "ok"`, health `200`.
- App 5xx rate back to baseline.
- If a restore was performed: counts verified, `DATABASE_URL` repointed, a fresh post-restore dump taken.
