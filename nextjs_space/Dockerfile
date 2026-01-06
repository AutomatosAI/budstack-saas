# ============================================
# Stage 1: Dependencies
# ============================================
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy package files
COPY package.json ./
COPY prisma ./prisma/

# Install dependencies (will generate yarn.lock if missing)
RUN yarn install --frozen-lockfile --network-timeout 600000 || yarn install --network-timeout 600000

# ============================================
# Stage 2: Builder
# ============================================
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production
# Provide a dummy DATABASE_URL for build time (Prisma needs it to initialize)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# Generate Prisma Client
RUN npx prisma generate

# Build Next.js application
RUN yarn build

# ============================================
# Stage 3: Runner
# ============================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files (for root level server.js if it exists)
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Copy build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Also copy public and static to the inner 'app' folder where server.js resides
# This is required by Next.js standalone mode to serve graphics/styles correctly
COPY --from=builder --chown=nextjs:nodejs /app/public ./app/public
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./app/.next/static

# Copy Prisma schema and generated client
COPY --from=builder /app/prisma ./prisma

# Copy the generated Prisma client and the runtime client to the standalone node_modules
# Nextjs standalone build puts the app in a subfolder (usually named after the project)
# We saw it was in '/app/app/' in our debug ls
COPY --from=builder /app/node_modules/.prisma ./app/node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./app/node_modules/@prisma

# Copy scripts for seeding and maintenance
COPY --from=builder /app/scripts ./scripts

# Copy all node_modules for maintenance tasks (seeding, etc)
COPY --from=builder /app/node_modules ./node_modules
# Also copy to the standalone app folder for correctly resolving dependencies in maintenance tasks
COPY --from=builder /app/node_modules ./app/node_modules

USER nextjs

# Copy and set up entrypoint script
COPY entrypoint.sh ./
RUN chmod +x ./entrypoint.sh

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["./entrypoint.sh"]
