# BudStacks Documentation

Multi-tenant SaaS for branded medical-cannabis storefronts. Start with **[ARCHITECTURE.md](ARCHITECTURE.md)** — it's the code-verified source of truth (system diagrams, data model, request flow, Dr Green, deployment).

> **Doc accuracy policy:** every architectural claim is verified against `nextjs_space/`. When code and a doc disagree, **the code wins** — fix the doc. Dated/point-in-time docs live in `archive/`.

## Map

| Area | Doc | What it covers |
|---|---|---|
| **Architecture** | [ARCHITECTURE.md](ARCHITECTURE.md) | System overview, tenant routing, ERD, templates, Dr Green, deploy — with Mermaid diagrams |
| **Guides** | [guides/DEV_WORKFLOW.md](guides/DEV_WORKFLOW.md) | Local dev loop (pnpm) |
| | [guides/DOMAINS.md](guides/DOMAINS.md) | Subdomains (Namecheap) + custom domains (Railway), troubleshooting |
| | [guides/SUPER_ADMIN_MANUAL.md](guides/SUPER_ADMIN_MANUAL.md) | Super-admin operations |
| | [guides/SUPER_ADMIN_DESIGN_STANDARDS.md](guides/SUPER_ADMIN_DESIGN_STANDARDS.md) | Super-admin UI design standards |
| | [guides/DESIGNER_README.md](guides/DESIGNER_README.md) | Designer notes (CSS variable conventions) |
| **Integrations** | [integrations/DR_GREEN_API_GUIDE.md](integrations/DR_GREEN_API_GUIDE.md) | Dr Green API: signing, order flow, endpoints, inbound webhooks + payments |
| | [integrations/BUDSTACKS_DRGREEN_FLOW.md](integrations/BUDSTACKS_DRGREEN_FLOW.md) | End-to-end consultation → order → payment flow |
| **Templates** | [templates/TEMPLATE_ARCHITECTURE.md](templates/TEMPLATE_ARCHITECTURE.md) | Data-driven template system, 50-component registry, validation checklist |
| | [templates/PRD_LIVE_EDITOR_AND_FEATURES.md](templates/PRD_LIVE_EDITOR_AND_FEATURES.md) | Live editor + enhancement proposals |
| **Runbooks** | [runbooks/DEPLOYMENT.md](runbooks/DEPLOYMENT.md) | Railway environments, Docker build, boot sequence, env vars |
| | [runbooks/SECURITY_PHASE_0_RUNBOOK.md](runbooks/SECURITY_PHASE_0_RUNBOOK.md) | Security hardening phase-0 procedures |
| **Product** | [BUDSTACK_FEATURES.md](BUDSTACK_FEATURES.md), [BUDSTACK_SALES_PITCH.md](BUDSTACK_SALES_PITCH.md) | Feature list + sales narrative |
| **PRDs** | [PRDS/REMEDIATION/REMEDIATION-INDEX.md](PRDS/REMEDIATION/REMEDIATION-INDEX.md) | Authoritative remediation suite (PRD-200–216) |
| | `PRDS/prd-*.md` | Feature PRDs (admin panel, AI editor, email, marketplace, SEO, etc.) |
| **Archive** | `archive/` | Dated/superseded point-in-time docs |

## Conventions

- **Templates are 100% data-driven** from S3 — never hardcode template names/logos/colors/slugs in platform code (see [ARCHITECTURE.md §5](ARCHITECTURE.md)).
- **CSS color variables are raw HSL channels** (`275 70% 55%`), consumed as `hsl(var(--tenant-color-x))`.
- **Auth is Clerk**, hosting is **Railway**, ORM is **Prisma/PostgreSQL** — references to NextAuth or Abacus.AI in any remaining doc are stale.
