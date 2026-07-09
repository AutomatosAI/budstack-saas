# PRD-303: Subscription Plans & Feature Gating

**Status:** Spec Complete  
**Priority:** P0 (blocks GTM)  
**Effort:** 4-5 sprint weeks  
**Owner:** Opus  

---

## Executive Summary

Introduce 3-tier subscription model (Starter / Pro / Enterprise) with plan-based feature gating. Controls team size, site limits, and feature access. Integrates with Stripe for billing.

**Why:** Users need to upgrade from single-site / single-user to teams + multi-site. Clear pricing tiers make the seller pitch work.

---

## Current State

- All tenants are on "free" tier (no subscription data)
- No limits on features
- No billing integration
- 200 existing WordPress customers need clear upgrade path

---

## Pricing Tiers

| Feature | Starter | Pro | Enterprise |
|---------|---------|-----|------------|
| **Price** | $169/month | TBD | Custom |
| **Sites** | 1 | 3 | Unlimited |
| **Team Members** | 1 (owner only) | Unlimited | Unlimited |
| **Roles/Permissions** | N/A (solo) | ✅ Custom roles | ✅ Custom roles |
| **Multi-Tenant Dashboard** | ❌ | Roadmap (Phase 2) | ✅ |
| **Chatbot** | ❌ | Planned | ✅ |
| **API Access** | ❌ | ❌ | ✅ |
| **Custom Domain** | ❌ | ✅ | ✅ |
| **Email/SMS** | Email only | Email only | Email + SMS |
| **Priority Support** | ❌ | ❌ | ✅ |
| **SLA** | Best effort | Standard (24h) | Premium (4h) |
| **Founding-100 Price** | $149/mo | TBD | Custom |

**Notes:**
- Starter: 1 owner, no invites, no roles (keep it simple for solo operators)
- Pro: Teams enabled, unlimited members but they must be invited
- Enterprise: Custom everything, direct support
- Founding-100: Early adopter discount, first 100 signups

---

## Phase 1: Feature Gating & Limits

### AC-1: Subscription Data Model

**New Table: `subscriptions`**

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  tenantId UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Plan
  plan TEXT NOT NULL DEFAULT 'starter', -- 'starter', 'pro', 'enterprise'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'cancelled', 'suspended', 'past_due'
  
  -- Billing
  stripeCustomerId TEXT UNIQUE,
  stripeSubscriptionId TEXT UNIQUE,
  stripeCurrentPeriodStart TIMESTAMP,
  stripeCurrentPeriodEnd TIMESTAMP,
  
  -- Pricing
  monthlyPrice DECIMAL(10, 2),
  billingCycle TEXT DEFAULT 'monthly', -- 'monthly', 'annual'
  discountPercent INT DEFAULT 0, -- for Founding-100
  
  -- Features (cache of enabled features at signup, for audit)
  enabledFeatures TEXT[] DEFAULT '{}'::text[],
  
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  nextBillingDate TIMESTAMP,
  cancelledAt TIMESTAMP
);
```

**Plan Configuration (cached in app or Stripe):**

```typescript
type PlanConfig = {
  id: "starter" | "pro" | "enterprise"
  name: string
  monthlyPrice: number
  yearlyPrice: number
  features: {
    maxSites: number
    maxTeamMembers: number
    customRoles: boolean
    multiTenantDashboard: boolean
    chatbot: boolean
    apiAccess: boolean
    customDomain: boolean
    emailOnly: boolean
    prioritySupport: boolean
    slaHours: number | null
  }
}
```

### AC-2: Feature Gating Middleware

**New Utility: `checkPlanFeature(tenantId, feature)`**

Add to lib layer:

```typescript
export async function checkPlanFeature(tenantId: string, feature: 'teams' | 'multiSite' | 'chatbot' | 'api' | 'customDomain'): Promise<boolean> {
  const subscription = await prisma.subscriptions.findUnique({
    where: { tenantId }
  })
  
  const plan = PLAN_CONFIG[subscription?.plan || 'starter']
  return plan.features[feature] === true
}

export async function getPlanLimits(tenantId: string) {
  const subscription = await prisma.subscriptions.findUnique({
    where: { tenantId }
  })
  
  const plan = PLAN_CONFIG[subscription?.plan || 'starter']
  return {
    maxSites: plan.features.maxSites,
    maxTeamMembers: plan.features.maxTeamMembers,
    ...
  }
}
```

**Usage in Routes:**

```typescript
// /tenant-admin/team/invite
if (!await checkPlanFeature(tenantId, 'teams')) {
  return { error: "Teams feature requires Pro plan or higher" }
}

// /tenant-admin/settings
const limits = await getPlanLimits(tenantId)
if (teamMemberCount >= limits.maxTeamMembers) {
  return { error: `Your plan allows ${limits.maxTeamMembers} team members` }
}
```

### AC-3: Enforce Limits at Runtime

**Team Member Invites:**
- [ ] Starter: Hide "Invite" button, show "Upgrade to Pro to add team members"
- [ ] Pro: Allow invites, but enforce unlimited members
- [ ] Enterprise: Allow invites, unlimited members

**Multi-Site (Phase 2):**
- [ ] Starter: Hide "Add Site" button
- [ ] Pro: Allow 3 sites
- [ ] Enterprise: Unlimited sites

**Chatbot (Phase 2):**
- [ ] Starter/Pro: Disabled, show upgrade upsell
- [ ] Enterprise: Enabled

### AC-4: Startup Plan Assignment

**New Signup Flow:**

1. Customer signs up → create tenant
2. Ask "How many sites do you have?"
   - "Just 1" → assign Starter plan
   - "2–3" → recommend Pro, assign Pro plan
   - "4+" → recommend Enterprise
3. Stripe Checkout:
   - Starter: $169/month
   - Pro: TBD (e.g., $499/month?)
   - Enterprise: "Contact Sales"
4. On Stripe success webhook → create `subscriptions` record

**Existing Customers (200 WordPress sites):**
- [ ] Backfill: query all tenants WITHOUT subscription
- [ ] Assign to "Starter" plan by default
- [ ] Email: "You've been added to our new Starter plan (free for 30 days, then $169/month). [Manage your subscription]"
- [ ] Allow manual upgrade in settings

### AC-5: Upgrade Flow (In-App)

**UI: `/tenant-admin/settings/billing` (new page)**

**Current Plan Card:**
```
📦 Your Current Plan: Starter
💰 $169/month (renews: Jan 15, 2026)
👥 1 team member (out of 1 allowed)
🌐 1 site (out of 1 allowed)
[Upgrade Plan] [Manage Billing]
```

**Upgrade Modal:**
1. Click "Upgrade Plan"
2. Show Pro / Enterprise options with features comparison
3. Select Pro → redirect to Stripe Checkout
4. On success → update `subscriptions.plan = 'pro'`
5. Show success toast: "Plan upgraded! You can now invite team members."

**Downgrade (Pro → Starter):**
- Warn: "You'll lose team member access. [Continue]"
- Creates downgrade at end of current billing period (via Stripe)
- Show: "Downgrade scheduled for Jan 15, 2026"

### AC-6: Billing Page

**UI: `/tenant-admin/settings/billing`**

**Sections:**
1. **Current Plan**
   - Plan name, price, next billing date
   - [Change Plan] [Cancel Plan]
   
2. **Billing History**
   - Table of past invoices + PDF download
   
3. **Payment Method**
   - "Card ending in 4242"
   - [Update Payment Method]
   
4. **Subscription**
   - Status: Active / Cancelled / Past Due
   - Cancel subscription [link]

**Cancel Subscription:**
- Modal: "We're sorry to see you go. Why are you cancelling? [Feedback]"
- "Cancel at end of billing period" or "Cancel immediately"
- Confirm: "Your subscription will be cancelled on Jan 15, 2026"

### AC-7: API Endpoints

**GET `/api/tenant-admin/subscription`**
```typescript
{
  plan: "starter" | "pro" | "enterprise",
  status: "active" | "cancelled" | "suspended",
  monthlyPrice: number,
  nextBillingDate: timestamp,
  features: {
    maxSites: number,
    maxTeamMembers: number,
    customRoles: boolean,
    ...
  },
  limits: {
    sitesUsed: number,
    teamMembersUsed: number
  }
}
```

**POST `/api/tenant-admin/subscription/upgrade`**
```typescript
// Body
{ plan: "pro" | "enterprise" }

// Response
{ stripeCheckoutUrl: string }
```

**POST `/api/tenant-admin/subscription/cancel`**
```typescript
// Body
{ immediate: boolean }

// Response
{ success: boolean, cancelledAt: timestamp }
```

**POST `/api/webhooks/stripe` (existing, add handling)**
- `customer.subscription.updated` → update `subscriptions` table
- `customer.subscription.deleted` → set status = "cancelled"
- `invoice.payment_failed` → set status = "past_due"

---

## Phase 1 Database Changes

1. **New Table:** `subscriptions` (see AC-1)
2. **New Columns:** `tenants.plan` (nullable, for quick lookup)
3. **Indexes:**
   - `(plan, status)` for analytics
   - `(stripeSubscriptionId)` for webhook lookups

---

## Phase 1: GTM Messaging

**Pricing Page (budstacks.io/pricing):**
```
STARTER
$169/month
✅ 1 site
✅ Basic email
✅ Order management
❌ Team members

PRO
$[TBD]/month
✅ 3 sites
✅ Email + SMS
✅ Unlimited team members
✅ Custom roles
❌ API

ENTERPRISE
Custom pricing
✅ Unlimited sites
✅ Dedicated support
✅ API access
✅ Chatbot
✅ SLA
```

**WordPress Migration Messaging:**
```
Bring your existing sites to BudStacks
✅ 1:1 URL redirect
✅ Keep your customers
✅ Unified dashboard coming soon (Pro plan)
```

---

## Success Metrics

- [ ] All existing tenants have a subscription record
- [ ] Feature gating enforced on team invites
- [ ] Upgrade flow converts in <2 minutes
- [ ] Stripe webhooks update subscription status
- [ ] Billing page is GDPR-compliant (show processing logic)

---

## Out of Scope (Phase 2)

- Annual billing discounts
- Coupon codes / promo management
- Invoice PDF customization
- Dunning/retry for failed payments
- Multi-currency pricing
- Per-feature trial periods (e.g., "try chatbot free for 14 days")
- Freemium tier (all existing customers are now Starter, not free)

---

## Notes on Stripe Integration

- Use Stripe Checkout for clean onboarding (don't build billing UI from scratch)
- Store Stripe `customerId` + `subscriptionId` for lifecycle events
- Webhook signature validation required (see Stripe docs)
- Use Stripe's "billing portal" for self-serve (cancel, update payment, etc.)
- Consider Stripe Tax for VAT in EU (future)
