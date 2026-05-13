# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-slim AS deps
RUN apt-get update -y && apt-get install -y openssl ca-certificates
RUN corepack enable && corepack prepare pnpm@10.30.2 --activate

WORKDIR /app

# Copy package files and lockfile for deterministic installs
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma/

# Install dependencies
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-slim AS builder
RUN corepack enable && corepack prepare pnpm@10.30.2 --activate
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Provide a dummy DATABASE_URL for build time (Prisma needs it to initialize)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js application
RUN pnpm build

# ============================================
# Stage 3: Runner
# ============================================
FROM node:20-slim AS runner
WORKDIR /app

# Install dependencies needed for production (OpenSSL for Prisma)
RUN apt-get update -y && apt-get install -y openssl ca-certificates

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/package.json ./package.json

# Copy build output (standalone includes its own minimal node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy public assets to where standalone server.js expects them
COPY --from=builder --chown=nextjs:nodejs /app/public ./app/public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./app/.next/static

# Copy Prisma schema for migrations
COPY --from=builder /app/prisma ./prisma

# Copy full node_modules (includes Prisma generated client, scripts deps, etc.)
COPY --from=builder /app/node_modules ./node_modules

# Copy scripts and lib for maintenance tasks (migrations, seeding, S3 sync)
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/lib ./lib

# Create templates directory for S3 sync with correct permissions
RUN mkdir -p /app/templates && chown nextjs:nodejs /app/templates

# Make lib directory writable for registry updates at runtime
RUN chown -R nextjs:nodejs /app/lib

USER nextjs

# Copy and set up entrypoint script
COPY --chown=nextjs:nodejs entrypoint.sh ./
RUN chmod +x ./entrypoint.sh

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["./entrypoint.sh"]
