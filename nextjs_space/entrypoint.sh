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

# Start the application
echo "🚀 Starting Next.js application..."
exec node app/server.js
