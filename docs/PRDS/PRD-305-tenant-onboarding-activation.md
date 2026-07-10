# PRD-305: Tenant Onboarding & Activation Experience

**Status:** Draft — scope reconstructed from the 2026-07-10 CX review; ⚠️ needs Gerard confirmation before build
**Priority:** P0 (growth — every new tenant hits this path first)
**Effort:** 1–2 sprint weeks
**Owner:** Gerard + Claude

---

## Executive Summary

Give a new tenant a **guided, observable path from "tenant created" to "store live and verified working"** — an activation checklist with per-step verification, instead of today's single onboarding form that drops the operator into an empty admin.

**Why now:** the 2026-07-10 new-tenant setup (done by hand, by us) surfaced the gap: after `app/onboarding`'s one-shot form, the operator lands in tenant-admin with no notion of what remains (branding, domain, Dr Green keys, products, test order) or whether any of it *actually works*. The failures that bit us that day were all silent (PRD-219/220). BudStacks' pitch is "launch without a web team" — activation is the product.

**Relationship to the GTM plan:** time-to-first-live-store is the metric the $1,500 90-day launch offer and the Founding-100 campaign implicitly promise. This PRD makes it self-serve instead of Gerard-serve.

---

## Current State (verified in repo)

- `app/onboarding/` — a single-page form (template pick + basics) posting to `app/api/onboarding/route.ts`. No progress persistence, no return path, no post-submit guidance.
- `app/super-admin/onboarding/` — super-admin-side tenant provisioning actions (us-facing).
- `components/shop/onboarding/*` — the **customer** (patient) KYC step flow; unrelated to tenant activation but shares the word — naming kept distinct below ("activation" = tenant-side).
- Tenant-admin dashboard: no checklist, no setup-health, generic empty states.
- No activation analytics: we cannot answer "how many tenants created in June are live?" without manual queries.

## Proposed: Activation Checklist + Setup Health

### 1. Activation checklist (tenant-admin home)

A persistent card listing the steps to go live, each with **status computed from real state** (not self-reported), a deep link, and where possible a "verify" action:

| Step | Computed from | Verify action |
|---|---|---|
| Branding & logo set | template config has non-default logo/colors | preview link |
| Domain live | subdomain reachable / custom-domain DNS + cert state | automated check (existing domain machinery) |
| Dr Green API keys valid | keys stored + a cheap authenticated ping | "Test connection" |
| Products synced | ≥1 product row for tenant | trigger sync |
| Test checkout passed | a completed sandbox/test order exists | guided test-order flow |
| Email sending verified | PRD-220 AC-A2 signal green + test email received | "Send me a test email" |

Checklist state persists (per-tenant), collapses when 100%, and reappears if a step regresses (e.g. keys start failing).

### 2. Setup-health panel

Surface the PRD-220 signals (email worker liveness, oldest QUEUED age, failed ID-upload count) plus Dr Green key status in one strip. Red items link to the runbook/fix.

### 3. Guided empty states

The 4–5 highest-traffic admin pages (products, orders, customers, webhooks) get empty states that say what feeds them and link the relevant checklist step — replacing bare tables.

### 4. Activation instrumentation

Emit events per checklist-step transition; a super-admin funnel view: tenants by furthest-step-reached, time-to-live-store. This is also the GTM campaign's conversion telemetry.

---

## Acceptance Criteria

1. **AC-1:** New tenant's admin home shows the checklist with all steps in computed (not stored-only) status; each deep link lands on the right page.
2. **AC-2:** "Test connection" for Dr Green keys and "Send me a test email" work and update step status without a page reload.
3. **AC-3:** Checklist state survives sessions and recomputes on load; a regressed step (e.g. key revoked) reopens the card.
4. **AC-4:** Super-admin funnel view lists tenants × furthest step + timestamps; exportable.
5. **AC-5:** Empty states on products/orders/customers/webhooks link their checklist step.
6. **AC-6:** Instrumentation events fire per step transition (named, documented).

## Out of Scope

- Patient/customer KYC onboarding flow (`components/shop/onboarding/*`) — different track.
- Multi-site/agency onboarding (PRD-304 territory).
- Plan gating of steps (PRD-303).
- In-app tours/tooltips beyond empty states (fast-follow candidate).

## Dependencies

- **PRD-219 + PRD-220 first** — the checklist's "verified working" claims are only honest once the silent failures are fixed and signalled; the setup-health panel consumes PRD-220's AC-A2 signal directly.
- Existing domain/DNS machinery for the domain check; existing Dr Green client for the key ping.

## Success Metrics

- Median time from tenant-created → all-steps-green, measurable from AC-6 events (baseline: unknown today; target < 1 day self-serve).
- ≥ 80% of new tenants reach "test checkout passed" without a support touch.
- Zero "is my store working?" support threads from Founding-100 cohort tenants who completed the checklist.

---

## ⚠️ Reconstruction note (read before sign-off)

The 2026-07-10 CX review's 10-PRD list was delivered in chat and only its P0 selection (219, 220, 305) and numbering scheme survived into the handoff note. This document reconstructs PRD-305's intent from the review's onboarding deep-dive and the session's driving incident (manual new-tenant setup). If the original chat framing scoped 305 differently (e.g. more toward the public signup/self-serve-signup funnel than post-signup activation), adjust §Proposed before build — the ACs are modular enough to survive re-scoping.

---

## Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-07-10 | Claude (with Gerard) | Drafted from the 2026-07-10 CX review; scope-reconstruction caveat flagged. |
