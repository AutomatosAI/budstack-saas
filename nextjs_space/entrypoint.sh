#!/bin/sh
set -e

echo "🚀 Starting deployment..."

# Run migrations
echo "⏳ Waiting for database to be ready..."
npx tsx scripts/wait-for-db.ts

echo "📦 Running database migrations..."
npx prisma migrate deploy

echo "📦 Applying marketplace schema changes (idempotent)..."
npx tsx scripts/apply-marketplace-migrations.ts

# Sync templates from S3
echo "📥 Syncing marketplace templates from S3..."
npx tsx scripts/sync-templates-from-s3.ts || echo "⚠️  S3 sync skipped (using git-based templates)"

# Start the application
echo "🚀 Starting Next.js application..."
exec node app/server.js
