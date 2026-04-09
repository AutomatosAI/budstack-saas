# Custom Domain Setup Guide

## Overview

Tenants on BudStacks get a free subdomain automatically: `onetree.budstacks.io`. If they buy their own domain (e.g. `onetree.com`), they can connect it with **two DNS records** — a CNAME (or ALIAS for root domains) and a TXT verification record. No technical knowledge needed beyond copy-pasting values at their registrar.

---

## Step-by-Step Walkthrough

### Step 1 — Tenant buys a domain

The tenant purchases a domain from any registrar (Namecheap, GoDaddy, Cloudflare, etc.).

> **Example:** OneTree Cannabis buys `onetree.com`

Their existing `onetree.budstacks.io` subdomain continues to work throughout this process.

---

### Step 2 — Tenant requests custom domain

The tenant contacts you (or submits a request through the platform) saying they want `onetree.com` connected to their store.

---

### Step 3 — Super Admin adds the domain

1. Go to **Super Admin → Tenants**
2. Select the tenant → click **Edit**
3. Enter the domain in the **Custom Domain** field: `onetree.com`
4. Click **Save**

**What BudStacks does automatically:**
- Registers `onetree.com` on Railway (SSL certificate begins provisioning)
- Stores the Railway domain ID in tenant settings
- Displays DNS instructions with the **exact records** the tenant needs (unique per domain)

---

### Step 4 — Copy DNS instructions

A DNS instructions panel appears after saving. It shows **two records** that Railway requires:

**Record 1 — CNAME (points traffic to Railway)**
```
Type:  CNAME (or ALIAS/ANAME for root domains like onetree.com)
Host:  @ (or the subdomain, e.g. "shop")
Value: ie4frajc.up.railway.app   ← unique per domain, from Railway
```

**Record 2 — TXT (Railway verification)**
```
Type:  TXT
Host:  _railway-verify
Value: railway-verify=5f328250442a25b865eb...   ← unique per domain
```

Click the **Copy** button next to each value, or use **"Copy full instructions"** to get both records formatted for sharing.

> **Important:** Each domain gets a UNIQUE CNAME target and TXT value from Railway. Always use the values shown in the panel — they are NOT the same for every tenant.

---

### Step 5 — Send instructions to tenant

Send the copied DNS records to the tenant. Example message:

> "To connect onetree.com to your store, log into your domain registrar's DNS settings and add these two records:
>
> **Record 1:**
> Type: ALIAS/ANAME (or CNAME if your registrar doesn't support ALIAS)
> Host: @
> Value: ie4frajc.up.railway.app
>
> **Record 2:**
> Type: TXT
> Host: _railway-verify
> Value: railway-verify=5f328250442a25b865eb8f0a260956490a4f77a...
>
> Both records are needed — the first one routes traffic and the second verifies domain ownership for SSL. Let me know once they're added."

---

### Step 6 — Tenant adds the DNS records

The tenant logs into their registrar's DNS management panel and adds **both** records.

Common registrar locations:
- **Namecheap:** Dashboard → Domain List → Manage → Advanced DNS
- **GoDaddy:** My Products → DNS → DNS Records
- **Cloudflare:** Select domain → DNS → Records → Add Record

**Root domain note:** Some registrars don't support CNAME on root domains (`@`). In that case:
- Use ALIAS or ANAME if available (Namecheap, DNS Made Easy, Cloudflare)
- Or resolve the CNAME target to an IP and use an A record (less ideal — IP may change)

---

### Step 7 — Verify DNS

Once the tenant confirms they've added both records:

1. Go back to **Super Admin → Tenants → select tenant → Edit**
2. Click the **Verify DNS** button

| Status | Meaning | Action |
|--------|---------|--------|
| **Verified** (green) | DNS is pointing correctly, SSL is active | Done — domain is live |
| **Pending** (yellow) | DNS hasn't propagated yet | Wait 5–30 minutes, click Verify again |
| **Misconfigured** (red) | Record points to wrong target | Shows expected vs found — ask tenant to fix |

> DNS propagation usually takes minutes but can take up to 48 hours with some registrars. Low TTL (300) speeds this up.

---

### Step 8 — Confirm it works

Visit `https://onetree.com` in the browser and verify:

- [ ] SSL padlock shows (valid certificate)
- [ ] Homepage loads with correct template/theme
- [ ] Navigate to `/products` — products display
- [ ] Navigate to `/about`, `/contact` — pages load
- [ ] Login/signup works on the custom domain
- [ ] URL bar stays on `onetree.com` throughout (no redirect to budstacks.io)

The tenant's `onetree.budstacks.io` subdomain continues to work in parallel.

---

## Changing or Removing a Custom Domain

### Change to a different domain

1. Super Admin → tenant edit → update the Custom Domain field → Save
2. BudStacks removes the old domain from Railway and provisions the new one
3. Send **new** DNS instructions to the tenant (values will be different)

### Remove custom domain entirely

1. Super Admin → tenant edit → clear the Custom Domain field → Save
2. BudStacks removes the domain from Railway
3. Tenant's store reverts to `{slug}.budstacks.io` only

---

## Quick Reference

| Who | Does What |
|-----|-----------|
| **Tenant** | Buys domain, adds 2 DNS records at their registrar |
| **Super Admin** | Enters domain in tenant settings, sends DNS instructions, verifies |
| **BudStacks** | Provisions SSL via Railway, verifies DNS, routes traffic, handles auth |

### What tenants DON'T need to do

- No Clerk/auth setup
- No SSL certificate purchase
- No server configuration
- No code changes

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Save fails with "Failed to provision" | `RAILWAY_API_TOKEN` missing or expired | Check Railway env vars |
| DNS stuck on Pending | Propagation delay or missing TXT record | Ensure BOTH records are added. Check with `dig onetree.com` |
| SSL not valid | DNS just propagated | Railway provisions SSL after both records verify — wait 1–5 min |
| Login doesn't work | `NEXT_PUBLIC_CLERK_FRONTEND_API` not set | Add env var on Railway |
| Store shows 404 | `customDomain` in DB doesn't match exactly | Check for typos, trailing dots, www prefix |
| Tenant sees old site | Browser/DNS cache | Try incognito window or `dig @8.8.8.8 onetree.com` |
| Railway shows "Waiting for DNS update" | TXT record not added or not propagated | Ensure `_railway-verify` TXT record is present |
