#!/bin/sh
set -e

echo "🚀 Starting deployment..."

# Run migrations
echo "⏳ Waiting for database to be ready..."
npx tsx scripts/wait-for-db.ts

echo "📦 Running database migrations..."
# Self-heal: the 20260531181200 migration previously failed in prod because it
# used CREATE INDEX CONCURRENTLY inside migrate deploy's transaction (P3018),
# leaving a failed record that blocks all future deploys (P3009). It has since
# been rewritten to plain (transaction-safe) CREATE INDEX. Clear any stale
# failed record so the rewritten version re-applies. This is a no-op on healthy
# DBs (Prisma refuses to roll back a non-failed migration) — hence || true.
npx prisma migrate resolve --rolled-back 20260531181200_prd208_concurrent_indexes 2>/dev/null || true
npx prisma migrate deploy

echo "📦 Applying marketplace schema changes (idempotent)..."
npx tsx scripts/apply-marketplace-migrations.ts

# Sync templates from S3
echo "📥 Syncing marketplace templates from S3..."
npx tsx scripts/sync-templates-from-s3.ts || echo "⚠️  S3 sync skipped (using git-based templates)"

# PRD-220 Part A — email-worker sidecar. MailerService only ENQUEUES to
# BullMQ; without this consumer every transactional email sits QUEUED forever
# (there is no separate Railway worker service). Runs in-container with a
# restart loop so a worker crash never takes the web process down — and
# vice-versa the loop revives the worker. `set +e` inside the subshell keeps
# the outer `set -e` from killing the loop on a non-zero worker exit.
if [ -n "$REDIS_URL" ]; then
  echo "📧 Starting email worker sidecar..."
  (
    set +e
    backoff=5
    while true; do
      started=$(date +%s)
      npx tsx scripts/email-worker.ts
      code=$?
      # A worker that ran healthily for 60s+ resets the backoff; a fast crash
      # escalates it (capped at 120s) so a hard-failing worker can't hammer the
      # container into `spawn esbuild EAGAIN` by respawning tsx+esbuild every 5s.
      if [ $(( $(date +%s) - started )) -ge 60 ]; then
        backoff=5
      fi
      echo "⚠️  [EmailWorker] exited with code $code — restarting in ${backoff}s..."
      sleep "$backoff"
      backoff=$(( backoff * 2 ))
      [ "$backoff" -gt 120 ] && backoff=120
    done
  ) &
else
  echo "⚠️  REDIS_URL not set — email worker NOT started; transactional email will stay QUEUED."
fi

# Start the application
echo "🚀 Starting Next.js application..."
exec node app/server.js
