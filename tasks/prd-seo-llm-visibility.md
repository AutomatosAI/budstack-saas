# PRD: LLM Visibility (GEO) — SEO Pro addendum

**Status:** Approved direction · **Date:** 2026-08-14 · **Owner:** Gerard
**Parent:** `tasks/prd-seo-supercharge.md` (shipped #242/#243). All features here are **Pro-tier, gated on the existing `FEATURES.SEO_PRO`** — no new plan keys, no matrix change.
**Evidence base (2026):** training and search crawlers are separate bots per provider (GPTBot vs OAI-SearchBot; ClaudeBot vs Claude-SearchBot); allowing the *search* class is what yields AI-answer citations. `llms.txt` is ~10% adopted with **no measured citation lift** (300k-domain SE Ranking study) — ship it as near-free insurance, never sell it as a lever. The evidenced levers are crawlable HTML, question-shaped content, schema, freshness, classic search strength — all shipped by the parent PRD. Honest cannabis framing: answer engines resist recommending dispensaries; the wedge is condition/education content becoming the cited authority with the store attached.

## Goals

- A Pro tenant controls exactly which AI crawlers (search vs training class) may read their store, with a maximum-visibility default.
- Products carry visible, schema-backed Q&A content — the format answer engines cite — draftable via the tenant's Automatos credentials.
- The audit panel tells a tenant precisely how LLM-ready their store is, including content invisible to crawlers.
- A tenant can see whether AI engines actually cite them, trended over time.

## User Stories

### US-001: AI crawler policy manager
**Description:** As a Pro tenant, I control which AI bots read my store — search crawlers for visibility, training crawlers by choice.

**Acceptance Criteria:**
- [ ] Bot registry (`lib/seo/ai-crawlers.ts`): the two classes as data — search (OAI-SearchBot, Claude-SearchBot, PerplexityBot, xAI's search UA, Google-Extended's search-relevant peers) and training (GPTBot, ClaudeBot, anthropic-ai, Google-Extended, CCBot, meta-externalagent) — names + class + owner, one source for robots rendering and the audit
- [ ] Tenant setting `aiCrawlerPolicy` (`open` | `search-only` | `blocked`, default `open` = maximum visibility); Pro-gated UI card in the SEO Manager with per-class explanation copy (what each choice costs)
- [ ] `app/store/[slug]/robots.txt` renders per-bot directives from the policy; Basic tenants render today's output unchanged (asserted)
- [ ] Typecheck passes; tests pass (robots output matrix per policy)
- [ ] Verify in browser using dev-browser skill (fallback per PROMPT)

### US-002: Product Q&A blocks
**Description:** As a Pro tenant, my products answer the questions buyers ask — visibly, and in the schema answer engines read.

**Acceptance Criteria:**
- [ ] Q&A stored in `products.seo.qa` (`{question, answer}[]`, Zod-validated, ≤10 pairs, lengths capped) — no migration; extends the SEO PUT routes' schema
- [ ] Editor in the SEO Manager product modal (add/remove/reorder pairs); "Draft Q&A with Automatos AI" button reusing `lib/seo/ai-assist.ts` with a new output contract (array of pairs, validated, refused on violation, never auto-saved)
- [ ] Product detail renders the Q&A visibly (accordion consistent with bs-* kit) AND as `FAQPage` JSON-LD via the existing builders — Pro-gated both
- [ ] Typecheck passes; tests pass
- [ ] Verify in browser using dev-browser skill (fallback per PROMPT)

### US-003: llms.txt generator
**Description:** As a Pro tenant, my store publishes a clean machine-readable inventory — cheap insurance, honestly framed.

**Acceptance Criteria:**
- [ ] `app/store/[slug]/llms.txt` route: generated markdown — business identity/address, condition guides (titles + summaries + URLs), top products, recent Wire posts; primary-host URLs; respects `sitemapExclude`/noindex from the parent PRD; cached like the sitemap; reachable on custom domains via the middleware rewrite
- [ ] Basic tenants: 404 (Pro-gated); UI card copy states plainly: standards-track, no proven citation lift, zero cost
- [ ] Typecheck passes; tests pass (content shape, exclusion honoring, gating)

### US-004: LLM-readiness audit section
**Description:** As a Pro tenant, the audit tells me what an LLM can and cannot see of my store.

**Acceptance Criteria:**
- [ ] New audit category in `lib/seo/audit.ts`: search-crawler access per policy (blocked search bots = the No.1 finding), Q&A coverage across products/conditions, llms.txt presence/freshness, heading-structure quality on content pages, and **crawler-invisible content detection**: a tenant whose blog surface is the Automatos Shadow-DOM widget (`wireMode` column) rather than native Wire posts gets a finding explaining their blog is invisible to every crawler and LLM, with the fix (native/assisted Wire mode)
- [ ] Findings carry deep links per the parent pattern; weights documented
- [ ] Typecheck passes; tests pass (each check table-driven)

### US-005: AI citation monitor v1
**Description:** As a Pro tenant, I can see whether AI engines cite my store when my market asks relevant questions.

**Acceptance Criteria:**
- [ ] Model `llm_citation_checks` (tenantId, engine, prompt, cited boolean, citedUrl?, mentionText?, checkedAt; tenant-scoped, hand-authored migration) + weekly repeatable job on its **own queue** following the reorder-reminders pattern (scheduler upsert idempotent; per-tenant fault isolation; sweep cap)
- [ ] Engine adapters behind one interface, **env-key-gated**: engines whose platform key is absent are skipped and surfaced as "not configured" in the UI (OpenAI + Perplexity first; others as keys appear). Adapter calls use web-search-enabled endpoints; responses scanned for the tenant's domains (primary host + custom domain) in citations/URLs
- [ ] Prompts generated from tenant market data (country, conditions content, product categories) with **medical-information framing** (documented rationale: engine content policies around cannabis commerce); prompt set capped per tenant per run
- [ ] Dashboard tab: per-engine cited/not-cited over time, latest mention text; empty states for unconfigured engines
- [ ] Worker-side code follows every worker lesson: own queue (expiry guard incompatibility), `bypassTenantScope` with tenantId in queries, Docker runner COPY check journaled, throwaway-tsconfig typecheck of touched worker files
- [ ] Typecheck passes; tests pass (adapter contract with mocked engines, domain-match extraction, scheduling idempotency, key-gating)

### US-006: Entity grounding
**Description:** As a Pro tenant, engines connect my brand entity across the web.

**Acceptance Criteria:**
- [ ] `socialLinks` in tenant settings (validated https URLs, capped list) → `sameAs` on the Organization JSON-LD; settings UI field
- [ ] Typecheck passes; tests pass

## Non-Goals
No guarantees of citation/ranking (the UI never promises it); no scraping of engine UIs (API adapters only); no per-tenant engine API keys in v1 (platform keys, env-gated); no llms-full.txt; no changes to Basic tier; no chatbot work.

## Technical Considerations
Everything gates on `FEATURES.SEO_PRO`. Reuse: robots route, audit engine, JSON-LD builders + escaper, ai-assist provider interface, reorder-reminders scheduler pattern, durable public URLs. **Process rule (from #242/#243): if origin/main moves during the run, merge it into the branch and re-verify the union before the final story completes.** The Automatos entitlement keys now live in `features.ts` — do not touch their entries. Citation-monitor API spend: cap prompts/engines per run; log per-run token cost.

## Success Metrics
Policy flips change robots output without deploy; a seeded product's Q&A renders visibly + validates as FAQPage; audit flags a Shadow-DOM-blog tenant; citation monitor produces a dashboard row for a configured engine against a live prompt; zero regressions in the parent PRD's suites.

## Open Questions
1. OpenRouter key provisioning + which web-search model routes to default (monitor ships env-gated regardless).
2. Citation-check cadence and prompt cap per tenant (cost control) — defaults: weekly, 6 prompts, 2 engines.
