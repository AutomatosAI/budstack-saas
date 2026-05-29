# Domains & Subdomains — Operator Guide

> **Status:** Code-verified 2026-05-29 against `lib/namecheap-api.ts` and `lib/railway-api.ts`.
> Supersedes the old `DOMAIN_SETUP_INSTRUCTIONS.md`, `SUBDOMAIN_SETUP_GUIDE.md`, and `SUBDOMAIN_TROUBLESHOOTING.md`, which described an Abacus.AI-managed-DNS setup that **no longer exists**.

Two domain mechanisms, both wired through `middleware.ts` (see [ARCHITECTURE.md §3](../ARCHITECTURE.md)):

- **Subdomains** `{slug}.budstacks.io` → CNAME managed via the **Namecheap API**.
- **Custom domains** (tenant's own domain) → provisioned via the **Railway Domains API** (GraphQL), which also issues SSL.

The base domain is `NEXT_PUBLIC_BASE_DOMAIN` (currently `budstacks.io`). **Never hardcode an apex domain** — the code derives it from this env var.

---

## 1. Add a tenant subdomain (`{slug}.budstacks.io`)

1. Confirm the slug: lowercase `a-z 0-9 -`, 3–50 chars, no leading/trailing hyphen, unique.
2. The platform calls `NamecheapAPI.createTenantSubdomain(slug)` (`lib/namecheap-api.ts`): it reads existing host records, appends one CNAME, and re-sends the full record set via `namecheap.domains.dns.setHosts`.
3. Required env: `NAMECHEAP_API_KEY`, `NAMECHEAP_CLIENT_IP`, `NEXT_PUBLIC_BASE_DOMAIN` (the Namecheap username is passed per call to `getNamecheapClient(username)`).
4. Ensure the server's public IP (`curl ifconfig.me`) is whitelisted in Namecheap API access.
5. Wait for propagation (TTL 1800s), then verify: `dig +short {slug}.budstacks.io`.

**Subdomain CNAME record**

| Field | Value |
|---|---|
| Type | `CNAME` |
| Host | `{slug}` |
| Target | value of `NEXT_PUBLIC_BASE_DOMAIN` |
| TTL | `1800` |

> The client derives `SLD`/`TLD` by splitting `NEXT_PUBLIC_BASE_DOMAIN` and uses that domain as the CNAME target. Do not hardcode `SLD: budstack` / `TLD: io` / a `budstack.to` target.

---

## 2. Add a custom domain (tenant's own domain)

1. The platform calls `addCustomDomain(domain)` (`lib/railway-api.ts`) → Railway `customDomainCreate` mutation; returns `{ id, domain, dnsRecords[] }`. The `id` is stored as the tenant's `railwayDomainId`.
2. Required env: `RAILWAY_API_TOKEN`, `RAILWAY_PROJECT_ID`, `RAILWAY_SERVICE_ID`, `RAILWAY_ENVIRONMENT_ID`.
3. Give the tenant the returned `dnsRecords` to add at their registrar. Each record has: `hostlabel`, `requiredValue`, `recordType` (`CNAME`/`A`/`AAAA`/`TXT`/`ALIAS`), `purpose` (`ACME_VALIDATION` or `TRAFFIC`), `zone`, `status`.
4. Railway auto-provisions SSL once the `ACME_VALIDATION` record resolves.
5. Inspect with `listCustomDomains()`; remove with `removeCustomDomain(domainId)`.

Routing for custom domains rewrites `example.com/foo → /store/_cd/foo`; the real tenant is resolved from the `x-tenant-custom-domain` header, not the `_cd` placeholder slug.

---

## 3. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `DNS_PROBE_FINISHED_NXDOMAIN` on subdomain | CNAME not propagated / never created | Confirm CNAME in Namecheap; `dig +short {slug}.budstacks.io`; `sudo dscacheutil -flushcache`; wait up to 30 min |
| `NET::ERR_CERT_COMMON_NAME_INVALID` on custom domain | SSL cert not issued yet | Ensure the Railway `ACME_VALIDATION` record resolves; wait for the ACME challenge |
| "Failed to create subdomain" / API auth error | Bad Namecheap creds or server IP not whitelisted | Verify `NAMECHEAP_API_KEY` / `NAMECHEAP_CLIENT_IP`; confirm public IP whitelisted + API access enabled |
| Custom domain shows wrong site / error page | Missing/wrong Railway records at registrar | Re-fetch via `listCustomDomains()`; add all `TRAFFIC` + `ACME_VALIDATION` records with the exact `requiredValue` |
| Railway call throws "RAILWAY_* is not set" | Missing env var | Set all four `RAILWAY_*` vars (token, project, service, environment) |

**DNS debug commands**

```bash
dig +short {slug}.budstacks.io
dig +trace {domain}
dig @8.8.8.8 {domain}
echo | openssl s_client -servername {domain} -connect {domain}:443 2>/dev/null | openssl x509 -noout -dates
```
