import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Health / status surface (PRD-215 AC-4, PRD-200 token hardening).
 *
 * The detailed body (memory, uptime, version, per-dependency latency) is a
 * fingerprinting + capacity-probing aid, so it is returned ONLY to a caller
 * presenting a valid `HEALTH_DETAIL_TOKEN` bearer header (uptime monitoring /
 * status page backend). Anonymous callers get a public dependency-health
 * summary (app / database / redis / drgreen as `ok | degraded | unknown`) with
 * the 200/503 code — enough to drive a status page's pills without leaking
 * internals. Fails closed: with HEALTH_DETAIL_TOKEN unset, no caller gets
 * detail. See `docs/STATUS_PAGE.md`.
 */

type DepStatus = "ok" | "degraded" | "unknown";

function hasValidDetailToken(req: Request): boolean {
  const expected = process.env.HEALTH_DETAIL_TOKEN;
  if (!expected) return false;

  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function checkDatabase(): Promise<{ healthy: boolean; latencyMs: number }> {
  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    return { healthy: true, latencyMs: Date.now() - startTime };
  } catch (error) {
    // Log server-side only — DB error text can include connection strings,
    // hostnames, or auth schemes. Routed through the redacting logger.
    logger.error("[Health] DB check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { healthy: false, latencyMs: 0 };
  }
}

/**
 * Redis health via a short-lived connection. We avoid importing the rate-limit
 * client (which is lazy + long-lived) so a health probe never disturbs request
 * metering. If REDIS_URL is unset we report "unknown" rather than failing —
 * Redis is an optional dependency for some deployments.
 */
async function checkRedis(): Promise<DepStatus> {
  if (!process.env.REDIS_URL) return "unknown";
  let client: import("ioredis").default | null = null;
  try {
    const { default: Redis } = await import("ioredis");
    client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      connectTimeout: 1500,
    });
    await client.connect();
    const pong = await client.ping();
    return pong === "PONG" ? "ok" : "degraded";
  } catch (error) {
    logger.warn("[Health] Redis check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return "degraded";
  } finally {
    try {
      client?.disconnect();
    } catch {
      // best-effort teardown
    }
  }
}

/**
 * Dr Green dependency: we do NOT call the live API on a health probe (it would
 * cost a request and could trip their rate limiting). We report whether the
 * platform-level credentials are configured — "ok" if a base URL is present,
 * "unknown" otherwise. Liveness of the upstream is covered by the runbook +
 * synthetic checks, not this endpoint.
 */
function checkDrGreenConfigured(): DepStatus {
  return process.env.DRGREEN_API_URL || process.env.DR_GREEN_API_URL
    ? "ok"
    : "unknown";
}

export async function GET(req: Request) {
  const db = await checkDatabase();
  const dbStatus: DepStatus = db.healthy ? "ok" : "degraded";

  // App is up if this handler runs; DB drives the overall code.
  const statusCode = db.healthy ? 200 : 503;

  const [redisStatus] = await Promise.all([checkRedis()]);
  const drgreenStatus = checkDrGreenConfigured();

  // Public summary: dependency pills only, no internals. Drives the status page.
  const publicSummary = {
    status: db.healthy ? "ok" : "degraded",
    dependencies: {
      app: "ok" as DepStatus,
      database: dbStatus,
      redis: redisStatus,
      drgreen: drgreenStatus,
    },
  };

  if (!hasValidDetailToken(req)) {
    return NextResponse.json(publicSummary, { status: statusCode });
  }

  // Authenticated detail (uptime monitoring / status page backend).
  const memUsage = process.memoryUsage();
  const detail = {
    timestamp: new Date().toISOString(),
    status: db.healthy ? "healthy" : "degraded",
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    services: {
      database: db.healthy
        ? { status: "healthy", latency: `${db.latencyMs}ms` }
        : { status: "unhealthy", error: "Database check failed" },
      redis: { status: redisStatus },
      drgreen: { status: drgreenStatus },
      memory: {
        status: "healthy",
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      },
      uptime: {
        status: "healthy",
        seconds: Math.floor(process.uptime()),
        human: formatUptime(process.uptime()),
      },
    },
  };

  return NextResponse.json(detail, { status: statusCode });
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);

  return parts.join(" ") || "< 1m";
}
