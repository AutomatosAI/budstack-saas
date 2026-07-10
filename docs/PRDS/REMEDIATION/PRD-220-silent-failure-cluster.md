# PRD-220 — Silent-Failure Cluster: Email Pipeline, ID-Upload, Image URLs

> **Status:** Proposed
> **Phase:** R6 — CX Review 2026-07-10 (see [index addendum](./REMEDIATION-INDEX.md#addendum--2026-07-10-cx-review-additions-r6))
> **Severity:** HIGH _(three independent failure modes that share one property: the customer or operator is never told anything went wrong. All three were observed or traced during the 2026-07-10 new-tenant setup review.)_
> **Module(s) touched:** `lib/email/mailer.ts`, `scripts/email-worker.ts`, `entrypoint.sh` + Railway service topology, `app/api/consultation/submit/route.ts`, `app/api/tenant-admin/branding/route.ts`, `lib/storage/s3.ts`
> **Depends on:** PRD-219 (the admin surfaces this PRD adds visibility to must load). Cross-refs: PRD-206 (S3 scoping), PRD-215 (ops alerting — the QUEUED-age signal belongs to its alerting family).
> **Blocks:** Confident self-serve tenant onboarding (PRD-305) — every activation step below relies on emails sending, ID uploads landing, and images staying up.
> **Owner:** Gerard + Claude.
> **Last updated:** 2026-07-10

---

## 1. Problem

Three separate subsystems fail silently. Each one, on its own, reads as "the platform is flaky"; together they define the new-tenant first-week experience.

### A. Transactional email may never send — and nothing would tell us

`MailerService.send()` (`lib/email/mailer.ts:36`) enqueues every email into BullMQ and writes an `email_logs` row with `status: "QUEUED"`. The **only** thing that ever sends the mail and flips that row to `SENT`/`FAILED` is the BullMQ worker (`scripts/email-worker.ts`, start script `pnpm email:worker`).

But the production start path (`entrypoint.sh`) runs migrations and then `exec node app/server.js` — **web process only**. Nothing in the repo starts the worker.

- **If** a separate Railway service runs `pnpm email:worker`, email works — but that service is invisible to the repo, undocumented, and unmonitored.
- **If not**, every transactional email (invite, order confirmation, verification notice) has been landing in Redis and staying `QUEUED` forever.

Either way the defect stands: there is **no signal** distinguishing "email is working" from "email is silently dead". `email_logs` full of aging `QUEUED` rows is precisely the observable symptom, and nothing looks at it.

> **Open question for Gerard (blocking AC-A1):** does the Railway project have a second service running the worker? Repo-unverifiable — needs a dashboard check. The rest of part A stands regardless of the answer.

### B. ID-document upload failures are swallowed

`app/api/consultation/submit/route.ts:371` catches `uploadIdentityDocument()` failures and only logs them — deliberately best-effort, so a Dr Green upload hiccup doesn't kill the whole registration (account + client are already created by then). That trade-off is right; what's missing is everything after the catch:

- The **customer** sees a normal "verification pending" state, believing their document was submitted.
- The **tenant admin** has no idea a document is missing — the client just never becomes verifiable.
- The failure exists only as a log line; no state, no badge, no re-upload prompt.

The Dr Green side (memory: SA-ID flow) can only Accept/verify a client whose document actually arrived — so this silent gap turns into "customer stuck unverified forever, nobody knows why."

### C. Storefront/branding images can break after save or after an hour

Two related weaknesses in the image pipeline:

1. **Strip-on-write is pattern-matching, not a contract.** `app/api/tenant-admin/branding/route.ts:~300–355` strips signed S3 URLs back to relative paths before persisting template config, by string-matching `.amazonaws.com/` across top-level keys, arrays of objects, and flat string arrays. Any config shape it doesn't anticipate (nested objects, new section fields) persists a **signed URL** into the config.
2. **Signed URLs expire in 1 hour.** `lib/storage/s3.ts:129` signs with `expiresIn: 3600`. Any persisted signed URL — or any signed URL rendered into a page cached/ISR-revalidated less often than hourly — becomes a broken image with an `X-Amz-Expires` 403.

Net effect: a tenant uploads branding, everything looks right, and images die later — the worst kind of CX bug because it detonates after the operator has walked away.

## 2. Users / personas

- **New tenant operator:** invites teammates (email never arrives), uploads branding (images break later), onboards customers (their IDs vanish).
- **Patient / customer:** submits ID, waits forever; never receives order/verification emails.
- **Us (platform):** learns about all of the above from support messages instead of signals.

## 3. User stories

1. As a platform operator, I can see at a glance whether the email pipeline is alive, and I am alerted when queued mail starts aging.
2. As a tenant admin, when a customer's ID upload failed, I see that customer flagged with a "document missing — upload failed" state and can prompt re-upload.
3. As a customer whose ID upload failed, my dashboard tells me and offers a one-click re-upload — instead of an eternal "pending".
4. As a tenant admin, no branding/template save can produce images that expire.

## 4. Acceptance criteria

### Part A — email pipeline

**AC-A1 — Worker deployment is explicit.** ~~The BullMQ worker runs as a declared Railway service~~ **Amended 0.2:** the 2026-07-10 Railway check found **no worker service exists** (project = Redis + web + Postgres only) → email was live-dead. v1 runs the worker as an **in-container sidecar** (`entrypoint.sh` restart-loop before the web `exec`) — ships via PR with zero dashboard dependency, auto-deploys with web, and warns loudly if `REDIS_URL` is absent. A separate Railway service (same `pnpm email:worker` start command) remains the documented scale-up path — see [runbook](../../runbooks/email-worker.md).
**AC-A2 — Liveness signal.** The worker heartbeats (updates a row/key on an interval). An admin-visible status (super-admin ops panel or `/api/health` extension) exposes: worker last-seen, queue depth, oldest `QUEUED` age.
**AC-A3 — Aging alert.** When oldest `QUEUED` exceeds a threshold (default 15 min), an alert fires (log-based Railway alert or webhook — align with PRD-215's alerting choices).
**AC-A4 — Backlog drain.** One-off runbook/script to drain or expire the existing stuck `QUEUED` backlog (if part A turns out to be live-dead), so counters start clean.

### Part B — ID-upload failure surfacing

**AC-B1 — Failure is persisted, not just logged.** A failed inline upload records state (e.g. `idUploadStatus: FAILED` on the relevant customer/consultation record, or a `document_uploads` row) with timestamp + error class. The registration still succeeds (unchanged trade-off).
**AC-B2 — Admin visibility.** Tenant-admin customer list/detail shows a "ID document missing (upload failed)" badge for such customers.
**AC-B3 — Customer re-upload path.** The customer dashboard shows the failure state and a re-upload CTA wired to the existing re-upload flow.
**AC-B4 — Test.** Integration test: force `uploadIdentityDocument` to throw → registration 200, state persisted, badge queryable.

### Part C — image URL integrity

**AC-C1 — Write contract.** No persisted template/branding config may contain a signed URL. Enforced structurally (recursive walk rejecting/stripping `X-Amz-`/query-signed URLs on **every** config write path), not by per-shape pattern lists.
**AC-C2 — Read-side signing everywhere.** All storefront/admin render paths obtain image URLs via sign-on-read (`getFileUrl`) or public paths — audit the `getFileUrl` caller list (12 files) for any that render a signed URL into content cached longer than the signature lifetime; align `expiresIn` vs `revalidate` where found.
**AC-C3 — Regression test.** Unit test: saving a config containing signed URLs (top-level, nested object, nested array, string array) persists zero `X-Amz` occurrences. Grep-gate optional.

## 5. Scope

**In scope:** the three parts above; documentation of the email service topology; runbook for the queue.

**Out of scope:** replacing BullMQ/Redis; per-tenant DKIM / white-label from-addresses (separate email-branding thread); Dr Green-side upload contract changes; CDN/public-bucket migration for images (candidate future PRD).

## 6. Success metrics

- 0 `email_logs` rows older than 15 min in `QUEUED` (steady state).
- 100% of failed ID uploads visible in admin within 1 min of occurrence.
- 0 image 403s with `X-Amz-Expires` in storefront logs over a 7-day window post-ship.

## 7. Test plan

Unit + integration per-AC above; manual smoke on the newest tenant: invite email arrives, forced upload failure surfaces, branding save + 90-minute-later image check (can be simulated by signing with `expiresIn: 60`).

## 8. Rollout

Three independently shippable parts (A, B, C) — land as separate PRs in that order (A unblocks the most customer pain fastest). Part A needs a Railway dashboard action (new/verified service) alongside the code PR.

**Effort:** ~2–3 days total (A: 1, B: 1, C: 0.5–1).

---

## Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 0.1 | 2026-07-10 | Claude (with Gerard) | Drafted from the 2026-07-10 CX review (new-tenant setup day). Email-worker deployment question flagged to Gerard. |
| 0.2 | 2026-07-10 | Claude (with Gerard) | **Part A question answered + shipped**: Railway project has NO worker service → email confirmed enqueue-only/dead. AC-A1 amended to in-container sidecar (rationale inline); AC-A2 heartbeat (Redis key + super-admin `ops/email-health` route), AC-A3 alert line (`[EmailWorker][ALERT]…`, Railway log-alert matchable), AC-A4 expiry guard (`EMAIL_MAX_JOB_AGE_MS`, default 48h — stale backlog expires instead of blasting customers) + drain script `scripts/expire-stale-queued-email-logs.ts`. Runbook `docs/runbooks/email-worker.md`. |
