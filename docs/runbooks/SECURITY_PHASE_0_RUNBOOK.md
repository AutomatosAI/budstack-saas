# Phase 0 Runbook — Secrets Rotation

**Goal:** rotate every secret from `env.windows-dev` and propagate new `ENCRYPTION_KEY` across the database.

**Owner:** Gerard (manual ops in Railway / AWS / Clerk / DrGreen consoles)

**Prereq:** Phase 0 branch (`security/phase-0-secrets`) merged to `main`. The `.gitignore` update and `scripts/rotate-encryption-key.ts` are deployed.

---

## Step 1 — Audit local file (DONE — info only)

```bash
git log --all -- env.windows-dev   # confirmed empty: never committed
git check-ignore -v env.windows-dev # now matches **/env.* in updated .gitignore
```

The file existed only in your local working tree. No upstream exposure. Rotation is defense-in-depth.

## Step 2 — Rotate non-encryption secrets in their consoles

Order doesn't matter for these (each is independent):

### 2a. AWS access key

1. AWS console → IAM → Users → the BudStack programmatic user
2. Create new access key, copy the new `AKIA…` and `Secret Access Key`
3. Push to Railway: project `10d943ff-8d5c-4ed5-ad0b-6a2671d8e098`
   - Set `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` on **Production** + **Staging** envs
4. Wait for redeploy
5. Smoke test: upload a file via tenant admin branding → confirm reaches `s3://budstack-uploads/development/...`
6. Disable the old key in IAM. After 24h with no errors, delete it.

### 2b. Clerk keys

1. Clerk dashboard → API Keys
2. Generate new secret key
3. Push to Railway: `CLERK_SECRET_KEY` on Production + Staging
4. Publishable key only changes if you rotate it; not required unless suspected exposure
5. Smoke test: signin / signout flow on staging

### 2c. DrGreen API + secret key

1. DrGreen merchant console → API credentials → rotate
2. **Per-tenant** keys are stored in DB encrypted. If DrGreen rotates the per-tenant credentials, each tenant admin needs to re-enter their key via `/admin/settings`. Coordinate with tenants before rotating.
3. Platform-level DrGreen creds (if any in `env.windows-dev`) → push new values to Railway

### 2d. NEXTAUTH_SECRET

1. Generate: `openssl rand -base64 64`
2. Push to Railway: `NEXTAUTH_SECRET` on Production + Staging
3. **Side effect:** existing NextAuth sessions invalidate. Users will need to re-login. Schedule for low-traffic window.

### 2e. DATABASE_URL / REDIS_URL

If your `env.windows-dev` had raw connection strings (vs Railway reference vars `${{Postgres-BudStack.DATABASE_URL}}`):
- Railway-managed: nothing to do; reference vars don't expose.
- Raw URLs: rotate Postgres password (Railway Postgres dashboard) + Redis password.

## Step 3 — Rotate ENCRYPTION_KEY (CRITICAL — do last, with care)

This is the only step that needs the migration script. **Test on staging clone first.**

### 3a. Generate new key

```bash
openssl rand -base64 48 | tr -d '\n='
# Copy the output — this is NEW_ENCRYPTION_KEY (must be ≥32 chars)
```

### 3b. Stage a Postgres clone

Per memory `project_railway_environments.md`: Railway env clone does NOT copy DB data. Use pg_dump.

```bash
# From your machine (pg_dump v17 required for Railway Postgres v17)
/opt/homebrew/opt/postgresql@17/bin/pg_dump \
  "postgresql://<railway-prod-public-proxy-url>" \
  --no-owner --no-acl -f /tmp/budstack-prod.sql

# Restore into a local or staging-only DB
psql "<staging-db-or-local>" -f /tmp/budstack-prod.sql
```

### 3c. Dry-run on staging

```bash
cd nextjs_space
OLD_ENCRYPTION_KEY="<current-prod-key>" \
NEW_ENCRYPTION_KEY="<new-key>" \
DATABASE_URL="<staging-or-cloned-db-url>" \
npx tsx scripts/rotate-encryption-key.ts
```

Expect output like:

```
ENCRYPTION_KEY rotation — DRY-RUN (no writes)
Scanning N tenant rows...
Scanning 1 platform_config rows...

=== Summary ===
  rotated:     X
  already-new: 0
  empty:       Y
  error:       0
```

If `error: 0` → proceed. If errors → investigate before continuing.

### 3d. Confirm-mode on staging

```bash
OLD_ENCRYPTION_KEY="<current-prod-key>" \
NEW_ENCRYPTION_KEY="<new-key>" \
DATABASE_URL="<staging-db-url>" \
npx tsx scripts/rotate-encryption-key.ts --confirm
```

### 3e. Verify on staging

1. Push `ENCRYPTION_KEY=<new-key>` to Railway **staging** env
2. Wait for redeploy
3. Smoke test:
   - [ ] Tenant admin loads (decrypts `drGreenApiKey`)
   - [ ] Test SMTP from tenant admin (decrypts `smtpPassword`)
   - [ ] Submit a test order → DrGreen webhook fires + decrypts ok
   - [ ] Super-admin loads `awsAccessKeyId` / `redisUrl` settings
4. If any step fails → rollback `ENCRYPTION_KEY` to old value on staging, investigate

### 3f. Production rotation

Only proceed if 3e is clean.

1. Schedule a maintenance window (5-10 min)
2. Snapshot Postgres-BudStack via Railway dashboard (paranoia backup)
3. Run dry-run against production DB:
   ```bash
   OLD_ENCRYPTION_KEY="<prod>" NEW_ENCRYPTION_KEY="<new>" \
   DATABASE_URL="<prod-tcp-proxy>" \
   npx tsx scripts/rotate-encryption-key.ts
   ```
4. Run confirm:
   ```bash
   OLD_ENCRYPTION_KEY="<prod>" NEW_ENCRYPTION_KEY="<new>" \
   DATABASE_URL="<prod-tcp-proxy>" \
   npx tsx scripts/rotate-encryption-key.ts --confirm
   ```
5. Push `ENCRYPTION_KEY=<new-key>` to Railway production env (triggers redeploy)
6. Monitor Sentry / Railway logs for `DecryptionError` for next hour
7. If stable for 24h → invalidate the old `ENCRYPTION_KEY` value (can't actually delete; just remove from any backup notes)

## Step 4 — Delete `env.windows-dev` from working tree

After all secrets above are rotated and Railway envs are updated:

```bash
rm /Users/gkavanagh/Development/HealingBuds/budstack-saas/env.windows-dev
```

The new gitignore prevents re-committing if you ever recreate it.

## Rollback

If anything goes wrong during step 3:

- **Before pushing new key to Railway:** the migration only touched DB. Rotate `ENCRYPTION_KEY` env var back to OLD value on Railway → DB rows that were re-encrypted with NEW key will throw `DecryptionError`. Rerun migration with OLD ↔ NEW swapped to undo.
- **After pushing new key:** the same — swap env back, rerun migration in reverse.
- **Snapshot restore** (last resort): use the Railway Postgres snapshot from step 3f.2.

## Sign-off

- [ ] AWS keys rotated, smoke test passed
- [ ] Clerk secret rotated, signin works
- [ ] DrGreen creds rotated (if applicable)
- [ ] NEXTAUTH_SECRET rotated (low-traffic window confirmed)
- [ ] ENCRYPTION_KEY dry-run clean on staging
- [ ] ENCRYPTION_KEY confirm-mode clean on staging
- [ ] Staging smoke test green
- [ ] ENCRYPTION_KEY rotated in production
- [ ] 24h Sentry quiet
- [ ] `env.windows-dev` deleted from working tree

When all checked → Phase 0 complete. Move to Phase 1.
