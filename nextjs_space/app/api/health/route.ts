import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    timestamp: new Date().toISOString(),
    status: "healthy",
    services: {} as Record<string, any>,
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
  };

  try {
    // Database check
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - startTime;

    checks.services.database = {
      status: "healthy",
      latency: `${dbLatency}ms`,
    };
  } catch (error: any) {
    checks.services.database = {
      status: "unhealthy",
      error: error.message,
    };
    checks.status = "degraded";
  }

  // Memory usage
  const memUsage = process.memoryUsage();
  checks.services.memory = {
    status: "healthy",
    heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
    heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
    rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
  };

  // Uptime
  checks.services.uptime = {
    status: "healthy",
    seconds: Math.floor(process.uptime()),
    human: formatUptime(process.uptime()),
  };

  const statusCode = checks.status === "healthy" ? 200 : 503;
  return NextResponse.json(checks, { status: statusCode });
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
