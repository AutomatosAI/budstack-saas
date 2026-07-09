# BudStacks Teams & Multi-Site Roadmap — Summary

**Status:** Strategy Complete, Ready for Implementation  
**Decision Date:** 2026-07-09  
**Owner:** Gerard (Product), Opus (Engineering)  

---

## What We're Building

**Vision:** Enable small cannabis retailers to build teams, manage multiple storefronts across countries, and upgrade their subscription as they grow.

**Phases:**
1. **Phase 1 (8–10 weeks):** Team management + Super-admin support access + Subscription plans
2. **Phase 2 (16 weeks, Q4 2026):** Multi-site dashboard + Account layer + WordPress migration

---

## Phase 1 Features (Immediate)

### 1. **Team Management** (PRD-301)
- Admin invites teammates via email
- Assign roles: Editor, Customer Support, Web Designer, Manager, Admin, + custom
- Granular permissions per role (can view customers, can edit products, etc.)
- Permission matrix configurable by admin (customize what each role can do)
- Clerk integration for GDPR-compliant auth
- Audit logs of all team actions

**Timeline:** 5–6 weeks  
**Impact:** Enables Pro plan ("unlimited team members")

### 2. **Super-Admin Impersonation** (PRD-302)
- Support team can temporarily log in as a customer tenant
- Red banner shows "You are logged in as [Tenant Name]" (can't forget)
- All actions logged with super-admin ID (GDPR-compliant audit)
- 4-hour auto-expiry for security
- "View Audit Log" to see everything support did

**Timeline:** 2–3 weeks  
**Impact:** Support team can actually help customers without asking them to do things

### 3. **Subscription Plans & Feature Gating** (PRD-303)
- **Starter:** $169/month, 1 site, 1 user (owner only), no teams
- **Pro:** TBD price, 3 sites, unlimited team members, custom roles (roadmap: multi-site)
- **Enterprise:** Custom, unlimited sites, API, priority support
- Feature gating: "Teams" button hidden on Starter, unlocked on Pro
- Stripe integration for billing + webhooks
- Existing 200 customers backfilled to Starter

**Timeline:** 4–5 weeks  
**Impact:** Revenue model + clear GTM story

---

## Phase 2 Features (Roadmap, Q4 2026)

### 4. **Multi-Site Dashboard** (PRD-304)
- One account → manage 3–50+ storefronts
- Each site: independent customers/orders, but shared team/billing
- Per-site compliance rules (POCA for SA, different for UK/PT)
- Per-site currency/language
- Unified reporting (total revenue across sites)
- Custom domain support (keep existing WordPress domain)

**Timeline:** 16 weeks  
**Impact:** Unlocks migration of 200 WordPress sites, biggest seller feature

---

## Architecture Decisions

### Clerk Integration (BEST FOR GDPR)
- **Why:** Clerk manages all org membership + auth
  - GDPR delete → cascade deletes our audit logs
  - Clerk handles user data lifecycle
  - Better compliance story
- **Implementation:** Clerk Orgs = 1:1 with Account (Phase 2) / Tenant (Phase 1)
- **Roles:** Stored in Clerk; our DB stores permission matrix (role → features)

### Permissions Model (Flexible, Future-Proof)
- **Admin defines:** What each role can do (via UI)
- **Stored:** `role_permissions` table (tenantId, role, canViewCustomers, canEditProducts, ...)
- **Enforced:** Middleware checks permission on every request
- **Feature-based:** Not page-based (e.g., "can edit customer" not "can see /customers page")

### Upgrade Path (WordPress Migration Story)
- Existing WordPress site → create BudStacks site in Pro plan
- Preserve domain via CNAME
- Migrate customers/orders (manual or ETL in Phase 2c)
- No 404s, no broken links, transparent to end-users

---

## Business Model

| Plan | Price | Sites | Users | Teams | Ideal For |
|------|-------|-------|-------|-------|-----------|
| **Starter** | $169/mo | 1 | 1 | ❌ | Solo operators |
| **Pro** | TBD | 3 | Unlimited | ✅ | Growing teams |
| **Enterprise** | Custom | Unlimited | Unlimited | ✅ | Multi-country operators (your 200 WordPress sites!) |

**Founding-100 Discount:** First 100 signups get 20% off Starter/Pro for 1 year (locks in customer for life)

---

## Implementation Plan for Opus

**Order of Implementation:**

1. **Week 1–2:** Setup Clerk Orgs + permission matrix model
2. **Week 3–4:** Team invite + role assignment flows
3. **Week 5–6:** Route protection + feature gating
4. **Week 7–8:** Super-admin impersonation + session management
5. **Week 9–10:** Stripe integration + subscription plans
6. **Week 11–12:** Testing, edge cases, documentation

**Dependencies:**
- PRD-301 (Teams) blocks PRD-303 (Feature Gating)
- PRD-303 (Plans) should be done before public launch
- PRD-302 (Impersonation) is independent, can run in parallel

---

## GTM / Messaging

**For Your 200 WordPress Customers:**
> "Migrate to BudStacks. Keep your domain. Manage all your sites from one dashboard. Add your team. Pay one invoice. Comply with local rules in each country."

**For New Customers:**
> "Start with 1 site. Grow to 3+. Add your team for $169/month. When you're ready for multi-country, we've got you."

**For Enterprise:**
> "Unlimited sites, unlimited team members, dedicated support, API access. Custom pricing based on your needs."

---

## Decisions Confirmed (2026-07-09)

All decisions finalized with user input. PRDs updated to reflect:

✅ **Pro Plan Pricing:** TBD — confirm later  
✅ **Team Roles:** Preset only (5 roles: Admin, Editor, Customer Support, Web Designer, Manager), but fully **configurable permissions** per role  
✅ **Team Invites:** Email from **our app** (follow Automatos pattern, not Clerk native)  
  - Reuse Automatos `invite-modal` component
  - Invitations table + email + accept link (7-day expiry)  
✅ **Audit Log Retention:** Plan-based + configurable by tenant
  - Starter: 90 days
  - Pro: 180 days
  - Enterprise: 1 year
  - Impersonation logs: 1 year minimum (even on Starter)  
✅ **Impersonation Duration:** 4 hours max, with **full audit trail** (super-admin ID logged on every action)  
✅ **WordPress Migration:** Phase 2 (multi-site dashboard unlocks it)  

**All PRDs updated. Ready for Opus to start Week 1.**

---

## Success Metrics (Phase 1 Completion)

- [ ] 100% of existing tenants have subscription record + plan assigned
- [ ] 50+ new signups use "Invite Team" feature in first month
- [ ] 0 complaints about "I can't see my customer data"
- [ ] Support team successfully uses impersonation to resolve 100+ tickets
- [ ] Stripe webhooks have <0.1% failure rate
- [ ] No GDPR issues (audit logs are clean, deletions cascade)

---

## Files Created

All PRDs are in `/Users/gkavanagh/Development/HealingBuds/budstack-saas/`:

- `PRD-301-team-management-roles.md` — Team invites, roles, permissions
- `PRD-302-super-admin-impersonation.md` — Support access + audit trail
- `PRD-303-subscription-plans-feature-gating.md` — Starter/Pro/Enterprise pricing + limits
- `PRD-304-multi-tenant-dashboard-roadmap.md` — Multi-site dashboard (Phase 2)
- `BUDSTACKS-TEAMS-ROADMAP-SUMMARY.md` — This file

---

## Next Steps

1. **Review these PRDs with your team**
2. **Confirm pricing + answers to questions above**
3. **Hand to Opus for implementation**
4. **Launch Phase 1 in 10 weeks**
5. **Plan Phase 2 (multi-site) for Q4 2026**

---

## Related Work

- **GTM Campaign:** `budstacks-campaign/BudStacks-14-Day-Launch-Campaign.pdf`
- **WordPress Migration Plan:** `WORDPRESS-DIRECT-PAY-ROLLOUT-PLAN.md`
- **Subscription Model Memory:** `[[project-budstacks-gtm-campaign]]`
