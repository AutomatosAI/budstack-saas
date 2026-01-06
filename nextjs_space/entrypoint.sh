#!/bin/sh
set -e

echo "🚀 Starting deployment..."

# Run migrations
echo "📦 Running database migrations..."
npx prisma migrate deploy

# Start the application
echo "🚀 Starting Next.js application..."
exec node app/server.js
