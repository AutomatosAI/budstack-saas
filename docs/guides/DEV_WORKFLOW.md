# Optimized BudStack Development Workflow

To avoid the slowness of building Docker images during active development, use this **Hybrid Setup**.

## 🚀 The Strategy
1. **Docker**: Run all infrastructure services (Postgres, Redis, PgBouncer).
2. **Local**: Run the Next.js app on your Mac (`pnpm dev`) for instant updates (HMR).

---

## 🛠️ One-Time Setup

1. **Install Node.js 20**: Ensure you are using the recommended version locally.
2. **Install Local Dependencies**:
   ```bash
   cd nextjs_space
   pnpm install
   ```

## 🔄 Daily Workflow

### 1. Start Infrastructure (Docker)
Run the services in the background:
```bash
# From the root directory
docker-compose --env-file .env up -d postgres redis pgbouncer
```

### 2. Run Application (Local)
Run the app on your host machine to get instant Hot Module Replacement:
```bash
cd nextjs_space
pnpm dev
```

### 3. Database Sync (When schema changes)
If you update `schema.prisma`, sync the Docker database from your local machine:
```bash
pnpm prisma generate
pnpm prisma db push
```

## 📈 Benefits
- **Speed**: Instant UI updates (no Docker build overhead).
- **Consistency**: Databases are isolated and clean in Docker.
- **Ease of Use**: You get standard debuggers and console logs on your Mac.

> [!NOTE]
> When you are ready for a production-like test, you can still run `docker-compose up --build` to verify the standalone Docker build.
