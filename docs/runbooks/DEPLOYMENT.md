# Deployment Runbook (Railway)

> **Status:** Code-verified 2026-05-29 against `nextjs_space/Dockerfile` and `nextjs_space/entrypoint.sh`.

BudStacks deploys to **Railway** as a Docker standalone build. There is no self-hosted Docker/NGINX topology and no Abacus.AI hosting (a vestigial `.abacusai.app` dev string remains in `middleware.ts` but is not the deploy target).

Railway project ID: `10d943ff-8d5c-4ed5-ad0b-6a2671d8e098`.

---

## 1. Environments

| Env | Deploys from | Public DNS | Notes |
|---|---|---|---|
| **Production** | `main` | `budstack.to`, `*.budstacks.io` | Live tenants |
| **Staging** | feature branches | `budstack-saas-staging.up.railway.app` | Pre-prod testing |
| **Dev** | local only | — | No Railway env (cost saving) |

Each env contains three services: `budstack-saas` (the app), `Redis`, and `Postgres-BudStack`. Auto-deploy fires on git push; builds take ~5 min.

> **DB cloning:** Railway environment clone does **not** copy Postgres data — use `pg_dump`/`pg_restore`. Railway Postgres is v17, so use a v17 dump tool: `/opt/homebrew/opt/postgresql@17/bin/pg_dump`.

---

## 2. Build pipeline (`Dockerfile`)

3-stage build on `node:20-slim`, pnpm `10.30.2` via corepack:

1. **deps** — `pnpm install --frozen-lockfile` (copies `package.json`, `pnpm-lock.yaml`, `prisma/`).
2. **builder** — `prisma generate`, then `pnpm build` (Next.js standalone output). A dummy `DATABASE_URL` is set for build-time Prisma init.
3. **runner** — non-root user `nextjs:nodejs` (uid/gid 1001), copies standalone output + `prisma/`, `scripts/`, `lib/`. Exposes port 3000. Healthcheck hits `/api/health` every 30s.

---

## 3. Boot sequence (`entrypoint.sh`)

```
wait-for-db  →  prisma migrate deploy  →  apply-marketplace-migrations (idempotent)
            →  sync-templates-from-s3 (best-effort)  →  node app/server.js
```

If `sync-templates-from-s3` fails it logs a warning and continues (git-based templates fallback). A failed migration aborts boot (`set -e`).

---

## 4. Environment variables

Use Railway **reference variables**, never hardcoded connection strings:

- `DATABASE_URL` = `${{Postgres-BudStack.DATABASE_URL}}`
- `REDIS_URL` = `${{Redis.REDIS_URL}}`

Other required vars: Clerk keys, AWS S3 creds (`budstack-uploads` bucket, `development/` prefix), `NEXT_PUBLIC_BASE_DOMAIN`, Namecheap (`NAMECHEAP_*`) and Railway (`RAILWAY_*`) API creds for domains. See [../guides/DOMAINS.md](../guides/DOMAINS.md).

> Postgres/Redis live on Railway's **private network** (`postgres.railway.internal`) and are not reachable from a local machine. For local access use a temporary public TCP proxy (see [PRDS/REMEDIATION](../PRDS/REMEDIATION/REMEDIATION-INDEX.md) and incident notes).

---

## 5. Operating via Railway MCP

1. Link first: `link-service` with `serviceName=budstack-saas`, `workspacePath=/Users/gkavanagh/Development/HealingBuds/budstack-saas`.
2. `list-deployments` (`json=true`) to check status.
3. `get-logs` with `logType: "deploy"` (runtime) or `"build"`; `filter` searches log text (e.g. `filter: "error"`).

---

## 6. Software Bill of Materials (SBOM)

CI generates a **CycloneDX JSON** SBOM for the `nextjs_space/` dependency tree on every push to `main` and on demand (`workflow_dispatch`). The workflow is `.github/workflows/sbom.yml` (generator: syft via `anchore/sbom-action`, which reads `pnpm-lock.yaml`).

To obtain the SBOM for procurement / vendor security review:

1. Open the repo's **Actions** tab → the **SBOM** workflow.
2. Pick the run for the commit/release you need (or trigger one via **Run workflow** → `workflow_dispatch`).
3. Download the **`sbom-cyclonedx-json`** artifact from that run's **Artifacts** section; it contains `sbom.cdx.json`.
