# budstacks custom-domain proxy (Cloudflare Worker)

Reverse proxy that lets external tenant domains (e.g. `lekkerweed.co.za`) be
served as **Cloudflare-for-SaaS custom hostnames** on the `budstacks.io` zone
while Railway remains the compute origin.

## Why it exists

Railway routes by the HTTP `Host` header and only recognises hostnames
registered as Railway custom domains. We deliberately do **not** register tenant
domains in Railway (avoids Railway's flaky per-hostname certs + the apex-CNAME
limitation). This Worker rewrites `Host` → the Railway origin and forwards the
real visitor host in `X-Original-Host` (shared-secret gated). The Next.js
middleware trusts that header to resolve the tenant.

Platform traffic (`budstacks.io` / `*.budstacks.io`) is **not** routed through
this Worker — it is DNS-proxied straight to Railway.

## Config

| Name | Type | Value |
|---|---|---|
| `RAILWAY_ORIGIN` | var | canonical Railway service domain (⚠️ confirm env before go-live) |
| `BASE_DOMAIN` | var | `budstacks.io` |
| `CF_PROXY_SECRET` | secret | random string; **must equal** the Next.js app's `CF_PROXY_SECRET` env |

## Deploy

```sh
cd cloudflare/custom-domain-proxy
npx wrangler deploy
npx wrangler secret put CF_PROXY_SECRET   # paste the shared secret
```

## Per-tenant route

For each external tenant domain, add routes on the `budstacks.io` zone (apex +
`www`) either in `wrangler.toml` or the dashboard:

```
lekkerweed.co.za/*
www.lekkerweed.co.za/*
```

The provisioning code adds these automatically when `USE_CLOUDFLARE_DOMAINS` is on.
