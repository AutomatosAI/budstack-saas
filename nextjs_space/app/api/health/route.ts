import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Health check.
 *
 * SECURITY (AC-6): the detailed body (memory, uptime, version, per-service
 * latency) is a fingerprinting + capacity-probing aid, so it is returned
 * ONLY to a caller presenting a valid `HEALTH_DETAIL_TOKEN` bearer header
 * (used by uptime monitoring). Anonymous callers get just `{ status }` plus
 * the 200/503 code, which is all a liveness probe needs. Fails closed: if
 * HEALTH_DETAIL_TOKEN is unset, no caller can obtain detail.
 */

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

export async function GET(req: Request) {
  let dbHealthy = true;
  let dbLatencyMs = 0;

  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - startTime;
  } catch (error) {
    // Log server-side only — DB error text can include connection strings,
    // hostnames, or auth schemes.
    console.error(
      "[Health] DB check failed:",
      error instanceof Error ? error.message : String(error),
    );
    dbHealthy = false;
  }

  const statusCode = dbHealthy ? 200 : 503;

  // Anonymous callers: minimal body, no internals.
  if (!hasValidDetailToken(req)) {
    return NextResponse.json(
      { status: dbHealthy ? "ok" : "degraded" },
      { status: statusCode },
    );
  }

  // Authenticated detail (uptime monitoring).
  const memUsage = process.memoryUsage();
  const detail = {
    timestamp: new Date().toISOString(),
    status: dbHealthy ? "healthy" : "degraded",
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    services: {
      database: dbHealthy
        ? { status: "healthy", latency: `${dbLatencyMs}ms` }
        : { status: "unhealthy", error: "Database check failed" },
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
