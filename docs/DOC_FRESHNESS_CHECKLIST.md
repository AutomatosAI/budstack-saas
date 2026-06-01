# Doc Freshness Checklist

> **Purpose (AC-10, PRD-214):** Track when each architecture/ops doc was last verified against the running code.
> When you change auth, hosting config, the Prisma schema, the template system, or any named service, update the relevant row(s) and bump the "Last verified" date.
> Triggered by: new Clerk version, Railway config change, `prisma/schema.prisma` migration, template-system refactor, major dependency bump.

---

## Architecture & ops docs

| Doc | Describes | Last verified against code | Verified against git ref | Notes |
|---|---|---|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Full system: Clerk auth, Railway hosting, Prisma/PG schema, BullMQ/Redis queue, AWS S3 templates, Dr Green API, subdomain + custom-domain routing | 2026-05-29 | `d1a392d` (main) | Authoritative source of truth; update first when any named system changes |
| [`guides/DOMAINS.md`](guides/DOMAINS.md) | Subdomain provisioning (Namecheap API), custom-domain provisioning (Railway Domains API), DNS troubleshooting | 2026-05-29 | `d1a392d` (main) | Supersedes old `DOMAIN_SETUP_INSTRUCTIONS.md` (Abacus.AI, now archived) |
| [`guides/SUPER_ADMIN_MANUAL.md`](guides/SUPER_ADMIN_MANUAL.md) | Super-admin operations: tenant management, Railway hosting, domain management, Clerk user management | 2026-05-29 | `d1a392d` (main) | Supersedes old `SUPER_ADMIN_MANUAL.md` (Namecheap-only DNS section, now archived) |
| [`guides/DEV_WORKFLOW.md`](guides/DEV_WORKFLOW.md) | Local dev loop: pnpm, Docker infra services, Next.js HMR | 2026-05-29 | `d1a392d` (main) | Verify when Docker or pnpm setup changes |
| [`runbooks/DEPLOYMENT.md`](runbooks/DEPLOYMENT.md) | Railway deployment: Docker standalone build, environments (prod/staging), env vars, boot sequence | 2026-05-29 | `d1a392d` (main) | Verify when Railway project config, Dockerfile, or entrypoint.sh changes |
| [`runbooks/SECURITY_PHASE_0_RUNBOOK.md`](runbooks/SECURITY_PHASE_0_RUNBOOK.md) | Secrets rotation (ENCRYPTION_KEY, Clerk, DrGreen, AWS), Railway env var propagation | 2026-05-29 | `d1a392d` (main) | Verify after any secret rotation or when encryption scheme changes (PRD-211) |
| [`integrations/DR_GREEN_API_GUIDE.md`](integrations/DR_GREEN_API_GUIDE.md) | Dr Green dApp API: base URL, authentication, endpoints, webhooks, signature verification | 2026-05-29 | `d1a392d` (main) | Verify when Dr Green API version changes or webhook format changes |
| [`integrations/BUDSTACKS_DRGREEN_FLOW.md`](integrations/BUDSTACKS_DRGREEN_FLOW.md) | End-to-end consultation → order → payment flow (our application logic, not raw API) | 2026-05-29 | `d1a392d` (main) | Verify when consultation or order flow changes |
| [`templates/TEMPLATE_ARCHITECTURE.md`](templates/TEMPLATE_ARCHITECTURE.md) | Data-driven template system, 50-component registry, S3 as source of truth, validation checklist | 2026-05-29 | `d1a392d` (main) | Verify when template-registry.ts, lib/template-utils.ts, or S3 layout changes; note PRD-210 (kill TEMPLATE_PRESETS) is open |
| [`templates/PRD_LIVE_EDITOR_AND_FEATURES.md`](templates/PRD_LIVE_EDITOR_AND_FEATURES.md) | Live editor features and enhancement proposals | 2026-05-29 | `d1a392d` (main) | Feature PRD — verify against live editor implementation when shipped |

---

## Archive (point-in-time — do NOT update these; annotate instead)

| Doc | Original date | Why archived |
|---|---|---|
| [`archive/SAAS_ARCHITECTURE_PLAN.md`](archive/SAAS_ARCHITECTURE_PLAN.md) | 2026-01 | Described NFT-membership model never built; archived 2026-05-29 |
| [`archive/SUBDOMAIN_DEPLOYMENT_STATUS.md`](archive/SUBDOMAIN_DEPLOYMENT_STATUS.md) | 2026-01 | Snapshot of Abacus.AI-era topology; superseded by ARCHITECTURE.md + DEPLOYMENT.md |
| [`archive/SECURITY_AUDIT_2026-05-01.md`](archive/SECURITY_AUDIT_2026-05-01.md) | 2026-05-01 | Third-party-style audit; findings annotated with PRD status inline; REMEDIATION-INDEX.md is the live tracker |

---

## How to use this checklist

1. **When you change auth (Clerk version, middleware logic):** update `ARCHITECTURE.md` §3 + bump its "Last verified" date and this table.
2. **When you change hosting (Railway service config, Dockerfile, env vars):** update `runbooks/DEPLOYMENT.md` + this table.
3. **When you run a `prisma migrate`:** update `ARCHITECTURE.md` §4 (ERD) + `templates/TEMPLATE_ARCHITECTURE.md` if schema affects templates + this table.
4. **When the template system changes (new components, new S3 structure):** update `templates/TEMPLATE_ARCHITECTURE.md` + this table.
5. **When Dr Green API changes:** update both integrations docs + this table.
6. **In PRs:** add a checkbox: `- [ ] Updated relevant doc(s) and DOC_FRESHNESS_CHECKLIST.md if this PR touches auth/hosting/schema/templates`.

> See also: [`PRDS/REMEDIATION/REMEDIATION-INDEX.md`](PRDS/REMEDIATION/REMEDIATION-INDEX.md) for the live security/remediation tracker.
> PRD-216 (CI/CD security gates) will wire a doc-lint advisory check for banned stale-claim strings.
