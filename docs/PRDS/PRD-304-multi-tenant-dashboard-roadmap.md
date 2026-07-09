# PRD-304: Multi-Tenant Dashboard & Global Account Management (Roadmap)

**Status:** Strategic Roadmap (Phase 2)  
**Priority:** P0 (blocks WordPress migration story)  
**Effort:** 12–16 sprint weeks (2 major phases)  
**Owner:** Opus  

---

## Executive Summary

Enable Pro/Enterprise customers to manage multiple storefronts (across countries/regions) from a single dashboard. One account → 3–50+ sites, each with independent customers/orders but shared team/billing.

**Why:** WordPress customers have multiple sites (SA, UK, PT with different compliance/languages). Migration pitch: "Move all your sites to one dashboard, keep them running independently, add teams to manage them all."

---

## Vision Statement

> **From:** "BudStacks = one storefront per account (Clerk Org)"  
> **To:** "BudStacks Account = 1 organization + multiple Sites, each site is independent but managed together"

This unblocks:
- Multi-country compliance (same team, different rules per site)
- Unified team management (one team member can access Site A + Site B)
- Consolidated reporting (one dashboard shows metrics across all sites)
- Unified billing (one invoice for all sites)

---

## Current Architecture

```
Clerk Org (1:1 with Tenant)
├── Auth: Memberships + Roles
├── Tenant (in DB)
│   ├── Customers
│   ├── Orders
│   ├── Products
│   └── Settings (business name, address, currency)
```

**Problem:** Tenant ≈ one storefront. If customer has 3 sites, they need 3 Clerk Orgs + 3 Tenants + 3 separate logins (or a hack).

---

## Phase 2a: Account Layer (Conceptual)

### The New Model

```
Clerk Org (1:1 with Account)
├── Auth: Memberships + Roles
├── Account (new DB table)
│   ├── Billing (one subscription covers all sites)
│   ├── Team (shared across all sites)
│   │   ├── Members (email + role, e.g., "Editor")
│   │   └── Role Permissions (what can they do on any site)
│   ├── Sites (1–50+, depending on plan)
│   │   ├── Site A (SA storefront)
│   │   │   ├── Currency: ZAR
│   │   │   ├── Compliance: POCA
│   │   │   ├── Customers
│   │   │   ├── Orders
│   │   │   └── Settings
│   │   ├── Site B (UK storefront)
│   │   │   ├── Currency: GBP
│   │   │   ├── Compliance: UK CHIS
│   │   │   ├── Customers
│   │   │   ├── Orders
│   │   │   └── Settings
│   │   └── Site C (PT storefront)
│   │       ├── Currency: EUR
│   │       ├── Compliance: PT DGPD
│   │       ├── Customers
│   │       ├── Orders
│   │       └── Settings
```

**Key Change:** "Tenant" → "Site" (local storefront), managed by "Account" (global entity).

### AC-1: Data Model (Phase 2a)

**New Tables:**

```sql
-- Global account (corresponds to Clerk Org)
CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  clerkOrgId TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL, -- e.g., "Herb Co"
  email TEXT,
  
  -- Billing (one subscription per account)
  stripeCustomerId TEXT UNIQUE,
  stripeSubscriptionId TEXT UNIQUE,
  plan TEXT DEFAULT 'starter', -- affects max sites
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- Rename existing 'tenants' → 'sites'
-- ALTER TABLE tenants RENAME TO sites;
-- Add accountId foreign key
ALTER TABLE sites ADD COLUMN accountId UUID REFERENCES accounts(id) ON DELETE CASCADE;

-- Unique constraint: siteName must be unique per account, not globally
ALTER TABLE sites ADD CONSTRAINT unique_site_per_account UNIQUE(accountId, slug);

-- Site-specific settings (moved from account level)
CREATE TABLE site_settings (
  id UUID PRIMARY KEY,
  siteId UUID NOT NULL UNIQUE REFERENCES sites(id) ON DELETE CASCADE,
  
  -- Compliance
  complianceRegion TEXT, -- 'za', 'uk', 'pt', etc.
  complianceChecklistStatus JSONB, -- which rules apply to this site
  
  -- Currency & Regional
  currency TEXT DEFAULT 'ZAR',
  timezone TEXT DEFAULT 'Africa/Johannesburg',
  language TEXT DEFAULT 'en',
  
  -- Taxes
  taxRate DECIMAL(5, 2) DEFAULT 15.00, -- VAT%, etc.
  taxIdNumber TEXT, -- per-country tax ID
  
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- Account-level team (shared across all sites)
CREATE TABLE account_teams (
  id UUID PRIMARY KEY,
  accountId UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  clerkUserId TEXT,
  name TEXT,
  role TEXT NOT NULL, -- 'admin', 'editor', 'customer_support', 'web_designer', 'manager'
  status TEXT DEFAULT 'active', -- 'active', 'pending_invite', 'removed'
  invitedAt TIMESTAMP,
  acceptedAt TIMESTAMP,
  removedAt TIMESTAMP,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(accountId, email)
);

-- Per-team member, per-site overrides (optional)
-- E.g., "Jane can edit Site A but only view Site B"
CREATE TABLE site_member_overrides (
  id UUID PRIMARY KEY,
  accountTeamMemberId UUID NOT NULL REFERENCES account_teams(id) ON DELETE CASCADE,
  siteId UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  permissionOverride JSONB, -- { canEditProducts: false } to override account-level role
  createdAt TIMESTAMP DEFAULT NOW(),
  UNIQUE(accountTeamMemberId, siteId)
);
```

### AC-2: Account-Level Dashboard

**New Landing Page: `/dashboard` (replaces `/tenant-admin`)**

When user logs in (via Clerk Org):
1. Resolve Clerk Org → Account
2. If account has 1 site → redirect to `/sites/[siteId]/dashboard` (keep current UX)
3. If account has 3+ sites → show account dashboard:

**Layout:**
```
┌─────────────────────────────────┐
│  Herb Co (Account)              │ [Settings] [Billing] [Team]
├─────────────────────────────────┤
│  🌐 Sites                        │
├─────────────────────────────────┤
│  [+ Add Site]                   │
│                                 │
│  📍 Site A (SA)                 │
│     🔗 site-a.budstacks.io      │
│     📊 100 customers, $5.2k MRR │
│     [Manage]                    │
│                                 │
│  📍 Site B (UK)                 │
│     🔗 site-b.budstacks.io      │
│     📊 45 customers, $2.1k MRR  │
│     [Manage]                    │
│                                 │
│  📍 Site C (PT)                 │
│     🔗 site-c.budstacks.io      │
│     📊 23 customers, $800 MRR   │
│     [Manage]                    │
├─────────────────────────────────┤
│  📊 Account Metrics             │
│  Total Customers: 168           │
│  Total MRR: $8.1k               │
│  Total Orders (30d): 420        │
│                                 │
│  [Export Report] [Analytics]    │
└─────────────────────────────────┘
```

**Clicking [Manage] on a Site:**
- Redirects to `/sites/[siteId]/dashboard` (current tenant-admin structure)
- URL changes to show which site you're in: `/sites/sa-store/dashboard`
- Sidebar shows: "← Back to Account"

### AC-3: Unified Team Management

**New Page: `/account/team` (account-level, not site-level)**

**Flow:**
1. Account owner can invite teammates
2. Assign role: Admin, Editor, Customer Support, Web Designer, Manager
3. (Optional) Override permissions per site:
   - "Jane can Edit on Site A, but View-Only on Site B"
4. Team member logs in, sees all sites they have access to
5. Can switch between sites in left sidebar

**Permission Model:**

```typescript
// Account-level role + site-level overrides
interface TeamMember {
  email: string
  role: "admin" | "editor" | "customer_support" | "web_designer" | "manager"
  
  // Optional per-site overrides
  siteOverrides?: {
    [siteId: string]: {
      canViewCustomers?: boolean
      canEditCustomers?: boolean
      // ... etc
    }
  }
}

// Team member logs in → resolve their permissions:
function getPermissionsForTeamMember(member: TeamMember, siteId: string) {
  const baseRole = ROLE_PERMISSIONS[member.role]
  const siteOverride = member.siteOverrides?.[siteId] || {}
  
  return {
    ...baseRole,
    ...siteOverride // siteOverride wins
  }
}
```

### AC-4: Unified Reporting

**New Page: `/account/analytics` (account-level)**

**Metrics:**
- Total customers (sum across all sites)
- Total revenue (MRR, LTM)
- Total orders (30-day, all-time)
- Customer breakdown by site
- Revenue breakdown by site (chart: pie chart of MRR by site)
- Growth trend (customers + revenue over 12 months)

**Drill-down:**
- Click on Site A in pie chart → drill into Site A analytics

---

## Phase 2b: Migration & URL Rewriting (Implementation)

### AC-5: Backward Compatibility (Critical)

**Problem:** Existing URLs are `/tenant-admin/customers`, but new model uses `/sites/[siteId]/customers`.

**Solution: URL Rewriting in Middleware**

```typescript
// middleware.ts
export default clerkMiddleware(async (auth, req) => {
  const user = await currentUser()
  
  // 1. Resolve which site user is accessing
  const siteId = resolveSiteContext(req, user) // subdomain | custom domain | cookie
  
  // 2. OLD URLs (for backward compatibility)
  if (req.pathname.startsWith('/tenant-admin')) {
    // Redirect to new URL
    const newPath = `/sites/${siteId}/dashboard${req.pathname.replace('/tenant-admin', '')}`
    return NextResponse.redirect(newUrl)
  }
  
  // 3. NEW URLs
  if (req.pathname.startsWith('/sites')) {
    // Continue to new routes
    req.headers.set('x-site-id', siteId)
  }
  
  // 4. Account-level routes
  if (req.pathname.startsWith('/account')) {
    // No site context needed
    req.headers.set('x-account-id', accountId)
  }
})
```

### AC-6: Route Structure (Post-Refactor)

```
OLD → NEW

/tenant-admin/dashboard             → /sites/[siteId]/dashboard
/tenant-admin/products              → /sites/[siteId]/products
/tenant-admin/customers             → /sites/[siteId]/customers
/tenant-admin/orders                → /sites/[siteId]/orders
/tenant-admin/team                  → /account/team (account-level)
/tenant-admin/billing               → /account/billing (account-level)
/tenant-admin/settings              → /sites/[siteId]/settings + /account/settings

/account/dashboard                  → /account/dashboard (account overview)
/account/analytics                  → /account/analytics (rollup metrics)
/account/team                       → /account/team (invite, manage)
/account/billing                    → /account/billing (subscription)
/account/settings                   → /account/settings (org-level)
```

### AC-7: "Add Site" Flow

**For Pro/Enterprise customers only:**

**UI: `/account/sites/add-site`**

**Form:**
1. Site name (e.g., "UK Store")
2. Business name (optional, defaults to account name)
3. Custom domain (optional, e.g., herbs-uk.co.uk)
4. Region: [Select: SA, UK, PT, US, CA...]
5. Currency: [Auto-populated based on region]
6. Language: [Select: English, Afrikaans, Portuguese...]
7. Compliance checklist (show applicable rules for region)

**Post-Submit:**
1. Create new Site (in DB)
2. Create site_settings with region/currency/language
3. Seed default products/templates (copy from Site A? Or blank?)
4. If custom domain: set up CNAME record (auto-email instructions)
5. Redirect to `/sites/[newSiteId]/dashboard`

### AC-8: Migration from Old Tenants to Accounts

**Data Migration Script:**

```typescript
// For each existing tenant, create an Account
for (const tenant of existingTenants) {
  const account = await prisma.accounts.create({
    data: {
      clerkOrgId: tenant.clerkOrgId,
      name: tenant.businessName,
      email: tenant.email,
      stripeCustomerId: tenant.stripeCustomerId, // carry over from old subscription
      plan: tenant.plan // carry over
    }
  })
  
  // Rename tenant → site
  await prisma.sites.update({
    where: { id: tenant.id },
    data: { accountId: account.id }
  })
  
  // Create site_settings
  await prisma.site_settings.create({
    data: {
      siteId: tenant.id,
      complianceRegion: 'za', // assume South Africa by default
      currency: 'ZAR',
      timezone: 'Africa/Johannesburg'
    }
  })
}
```

---

## Phase 2c: WordPress Migration (Marketing Angle)

### Strategy: 1:1 URL Preservation

**Pitch to WordPress Customers:**

> "Move your existing site to BudStacks without breaking links or losing SEO. We'll set up redirects so your customers stay happy."

**How it works:**
1. Existing WordPress: `herbs.co.za` (your domain)
2. BudStacks site: `herbs-budstacks.co.za` (auto-generated)
3. Set up CNAME: `herbs.co.za` → `herbs-budstacks.co.za`
4. All URLs `herbs.co.za/products` → `herbs-budstacks.co.za/products` (preserved)
5. No link breakage, no 404s

**In App:**
- Show setup instructions for DNS CNAME
- Check DNS propagation (poll every 5 seconds)
- Once live, show "✅ Custom domain active"

---

## Success Criteria (Phase 2)

- [ ] 50+ customers with 3+ sites each (by Q4 2026)
- [ ] Account dashboard shows accurate rollup metrics
- [ ] Team members can access multiple sites with correct permissions
- [ ] Site-level compliance checklists are independent
- [ ] URL rewriting is transparent (old URLs redirect smoothly)
- [ ] Migration from old tenants is 100% successful

---

## Out of Scope (Phase 3+)

- Per-site billing (today: one invoice for account)
- Shared customer base across sites (today: site-specific customers)
- Automated site cloning (copy Site A to Site B)
- Bulk import of WordPress data (manual for now)
- API for programmatic site creation
- Site usage analytics (per-site API calls, storage)
- Auto-scaling multi-region deployment

---

## Roadmap Timeline (Estimated)

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **2a** | 6–8 weeks | Account model, team management, unified billing |
| **2b** | 4–6 weeks | Route refactor, URL rewriting, backward compatibility |
| **2c** | 2–4 weeks | Custom domain, DNS setup UX, WordPress migration docs |
| **Testing** | 2–3 weeks | QA, performance, load testing |
| **Launch** | 1 week | Beta launch to Pro customers, marketing push |
| **Total** | ~16 weeks | ~4 months |

---

## GTM Messaging (Phase 2 Launch)

**Email to Existing Customers:**
```
Subject: Manage All Your Sites From One Dashboard

We heard from 100+ customers like you: managing multiple stores is a hassle.

Today we're launching Multi-Site Management (Pro & Enterprise plans).
✅ One account, 3–unlimited sites
✅ One team, shared across all stores
✅ One invoice, all your sites
✅ Keep your domains, move your data

[Learn More] [Upgrade to Pro]
```

**WordPress Migration Pitch:**
```
Moving from WordPress?
✅ Bring your existing domain
✅ Customers see no difference
✅ Setup in 10 minutes
✅ One dashboard for all sites

[Start Migration] [Pricing]
```

---

## Related PRDs

- PRD-301: Team Management (account-level roles)
- PRD-303: Subscription Plans (max sites per plan)
- PRD-XXX: Compliance & Regional Settings (POCA, UK CHIS, etc.)
- PRD-XXX: WordPress Data Migration (ETL pipeline)
