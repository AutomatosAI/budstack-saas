# Custom Domain E2E Test Plan

## Prerequisites

### 1. Railway API Token (you need to create this)

1. Go to [Railway Dashboard → Account → Tokens](https://railway.com/account/tokens)
2. Create a new token with **project-level access** to `budstack-saas`
3. Add to Railway env vars:

```
RAILWAY_API_TOKEN=rlw_...
```

### 2. Railway CNAME Target (you need to find this)

1. In Railway dashboard → budstack-saas service → Settings → Networking
2. Look for the generated domain (something like `budstack-saas-production-xxxx.up.railway.app`)
3. OR: temporarily add a test custom domain via Railway dashboard UI, note the CNAME target it shows, then remove it
4. Add to Railway env vars:

```
RAILWAY_CNAME_TARGET=budstack-saas-production-xxxx.up.railway.app
```

### 3. Environment Variables Summary

Already set on Railway (no action needed):
```
RAILWAY_SERVICE_ID=8d82fa11-1392-4514-9b05-d875518ceca6
RAILWAY_ENVIRONMENT_ID=7da36e7f-3943-40f1-8240-f0259e3de543
CLERK_SECRET_KEY=sk_test_...  (already set)
```

**Need to add to Railway:**
```
RAILWAY_API_TOKEN=rlw_...                              # Step 1 above
RAILWAY_CNAME_TARGET=budstack-saas-xxxx.up.railway.app # Step 2 above
NEXT_PUBLIC_BASE_DOMAIN=budstacks.io                   # Currently using fallback — make explicit
NEXT_PUBLIC_CLERK_FRONTEND_API=https://flying-jennet-34.clerk.accounts.dev  # Clerk proxy rewrite target
```

### 4. Test Domain

Pick a domain or subdomain you control. Examples:
- `test.yourdomain.com` (subdomain — easiest, CNAME works)
- `testdomain.com` (apex — needs ALIAS/ANAME or A record)

A subdomain is recommended for first test since CNAME setup is simpler.

### 5. DNS Records (at your registrar)

Only **one** DNS record is needed per custom domain. Auth is handled via Clerk proxy mode
(`/__clerk` path rewrite) — no separate `clerk.{domain}` CNAME required.

For a root/apex domain like `onetree.com`:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| ALIAS/ANAME | @ | `{RAILWAY_CNAME_TARGET}` | 300 |

> If the registrar doesn't support ALIAS/ANAME, use an A record pointing to Railway's IP (resolve the CNAME target to get it).

For a subdomain like `shop.yourdomain.com`:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| CNAME | shop | `{RAILWAY_CNAME_TARGET}` | 300 |

---

## Test Procedure

### Phase A: Setup & Provisioning

- [ ] **A1.** Set the 4 Railway env vars (token, CNAME target, base domain, Clerk frontend API) — already done
- [ ] **A2.** Push the `template-editor` branch and wait for deploy (~5 min) — already done

### Phase B: Domain Assignment (do this BEFORE DNS)

- [ ] **B1.** Go to super-admin → Tenants → pick a test tenant → Edit
- [ ] **B2.** Enter the test domain in Custom Domain field (e.g., `onetree.com`)
- [ ] **B3.** Click Save
- [ ] **B4.** Verify success toast — no Railway errors
- [ ] **B5.** Verify in tenant settings JSON: `railwayDomainId` is populated
- [ ] **B6.** Verify DNS instructions panel appears with single DNS record

### Phase C: DNS Setup (after domain is assigned)

- [ ] **C1.** Copy the DNS instructions from the panel (shows the exact record type, host, and CNAME target)
- [ ] **C2.** Add the DNS record at the registrar (single ALIAS/ANAME for apex, or CNAME for subdomain)
- [ ] **C3.** Wait for DNS propagation — check with `dig onetree.com A` or `dig shop.yourdomain.com CNAME`

### Phase D: DNS Verification

- [ ] **D1.** Click "Verify DNS" button in tenant edit form
- [ ] **D2.** If DNS has propagated: status should show **Verified** (green badge)
- [ ] **D3.** If DNS hasn't propagated yet: status shows **Pending** (yellow badge) — wait and retry
- [ ] **D4.** Test misconfigured state: temporarily point domain to wrong target, verify shows **Misconfigured** (red badge) with expected vs found values

### Phase E: Storefront Rendering

- [ ] **E1.** Visit `https://onetree.com` in browser
- [ ] **E2.** Verify SSL certificate is valid (padlock icon, no warnings)
- [ ] **E3.** Verify homepage renders identically to `{slug}.budstacks.io`
- [ ] **E4.** Verify template/theme loads correctly (correct colors, logo, sections)
- [ ] **E5.** Navigate to `/products` — page loads, products displayed
- [ ] **E6.** Navigate to `/about` — page loads
- [ ] **E7.** Navigate to `/contact` — page loads
- [ ] **E8.** Navigate to `/consultation` — form loads
- [ ] **E9.** Check browser URL bar — all navigation stays on `onetree.com`, no redirect to `budstacks.io`
- [ ] **E10.** View page source / inspect OG tags — URLs use `onetree.com`, not `budstacks.io`
- [ ] **E11.** Visit `https://onetree.com/robots.txt` — correct domain in content
- [ ] **E12.** Visit `https://onetree.com/sitemap.xml` — URLs use custom domain

### Phase F: Authentication on Custom Domain

- [ ] **F1.** Visit `https://onetree.com` and click Login/Sign In
- [ ] **F2.** Verify Clerk auth works on the custom domain via proxy (`/__clerk` rewrite)
- [ ] **F3.** Complete login — should stay on `onetree.com` (no redirect to budstacks.io)
- [ ] **F4.** Verify session is active — user name/avatar visible, protected routes accessible
- [ ] **F5.** Navigate to tenant-admin dashboard from custom domain — verify access
- [ ] **F6.** Click Logout — verify signed out on custom domain
- [ ] **F7.** Visit `https://budstacks.io` — verify also signed out (sign-out propagates)

### Phase G: Domain Change

- [ ] **G1.** Go back to super-admin → tenant edit form
- [ ] **G2.** Change custom domain to a different value (or clear it)
- [ ] **G3.** Click Save
- [ ] **G4.** Verify old domain no longer resolves to the storefront (may take time for SSL revocation)
- [ ] **G5.** Verify `railwayDomainId` updated in settings
- [ ] **G6.** If set to new domain: verify new domain works after DNS propagation

### Phase I: Domain Removal

- [ ] **I1.** Clear the Custom Domain field and Save
- [ ] **I2.** Verify Railway domain removed (check Railway dashboard → Networking)
- [ ] **I3.** Verify `railwayDomainId` is null in settings
- [ ] **I4.** Verify `domainVerification` is null in settings
- [ ] **I5.** Verify tenant still accessible via `{slug}.budstacks.io`

### Phase J: Tenant Deletion with Custom Domain

- [ ] **J1.** Re-assign custom domain to a test tenant
- [ ] **J2.** Delete the tenant via super-admin
- [ ] **J3.** Verify Railway domain cleaned up (check Railway dashboard)
- [ ] **J4.** Check audit log — deletion recorded with cleanup errors (if any)

---

## Troubleshooting

### "Failed to provision custom domain on Railway"
- Check `RAILWAY_API_TOKEN` is set and has project-level access
- Check token hasn't expired
- Check domain isn't already registered on another Railway service
- Check Railway dashboard → service logs for errors

### DNS Verification stuck on "Pending"
- DNS propagation can take up to 48 hours (usually minutes)
- Verify with CLI: `dig shop.yourdomain.com CNAME +short`
- Some registrars cache aggressively — try `dig @8.8.8.8 shop.yourdomain.com CNAME +short`

### SSL certificate not valid
- Railway auto-provisions SSL after DNS points to their servers
- Can take 1-5 minutes after DNS propagation
- Check Railway dashboard → service → Networking → custom domain status

### Login fails on custom domain
- Verify `NEXT_PUBLIC_CLERK_FRONTEND_API` is set on Railway
- Check browser Network tab: `/__clerk` requests should proxy to Clerk's frontend API
- Check that `ClerkProvider` in layout.tsx is receiving `proxyUrl` — inspect the `x-tenant-custom-domain` header
- Check browser console for Clerk-specific errors

### Storefront shows 404
- Middleware rewrite working? Check browser dev tools → Network tab for the initial request
- The `x-tenant-custom-domain` header should be set
- Check `getCurrentTenant()` finds the tenant — the `customDomain` field in DB must match exactly

---

## Environment Checklist

| Item | Status | Notes |
|------|--------|-------|
| `RAILWAY_API_TOKEN` on Railway | [ ] | Create at railway.com/account/tokens |
| `RAILWAY_CNAME_TARGET` on Railway | [ ] | From Railway dashboard networking |
| `NEXT_PUBLIC_BASE_DOMAIN` on Railway | [ ] | Set to `budstacks.io` |
| `NEXT_PUBLIC_CLERK_FRONTEND_API` on Railway | [ ] | `https://flying-jennet-34.clerk.accounts.dev` |
| Test domain DNS record (storefront) | [ ] | ALIAS/ANAME or CNAME → Railway target |
| Code pushed to `template-editor` | [ ] | All custom domain changes |
| Railway deploy successful | [ ] | Check deploy logs |
