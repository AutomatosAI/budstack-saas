import { NextResponse } from "next/server";
import Redis from "ioredis";
import { withSuperAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { getEmailQueue } from "@/lib/queue";
import {
  DEFAULT_MAX_JOB_AGE_MS,
  DEFAULT_QUEUED_ALERT_AGE_MS,
  EMAIL_WORKER_HEARTBEAT_KEY,
  msFromEnv,
} from "@/lib/email/worker-health";

export const dynamic = "force-dynamic";

let redisClient: Redis | undefined;
const getRedis = () => {
  if (!redisClient) {
    redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return redisClient;
};

/**
 * GET /api/super-admin/ops/email-health
 *
 * PRD-220 AC-A2 — one view of the transactional-email pipeline:
 * worker liveness (heartbeat written by scripts/email-worker.ts), BullMQ
 * queue counts, and email_logs QUEUED backlog. Super-admin only: this is
 * operational telemetry and must not ride on the anonymous /api/health.
 */
export const GET = withSuperAdmin(async () => {
  try {
    const maxJobAgeMs = msFromEnv(process.env.EMAIL_MAX_JOB_AGE_MS, DEFAULT_MAX_JOB_AGE_MS);
    const queuedAlertAgeMs = msFromEnv(
      process.env.EMAIL_QUEUED_ALERT_AGE_MS,
      DEFAULT_QUEUED_ALERT_AGE_MS,
    );
    const now = Date.now();

    const [heartbeat, queueCounts, queuedTotal, oldestActionable] = await Promise.all([
      getRedis()
        .get(EMAIL_WORKER_HEARTBEAT_KEY)
        .catch(() => null),
      getEmailQueue()
        .getJobCounts("wait", "active", "delayed", "failed", "completed")
        .catch(() => null),
      prisma.email_logs.count({ where: { status: "QUEUED" } }),
      prisma.email_logs.findFirst({
        where: {
          status: "QUEUED",
          // Send-eligible only: rows past the max job age are the expiry
          // guard / drain script's problem, not a "stuck queue" signal.
          createdAt: { gt: new Date(now - maxJobAgeMs) },
        },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

    const oldestAtMs: number | null = oldestActionable?.createdAt
      ? new Date(oldestActionable.createdAt).getTime()
      : null;
    const oldestAgeMs = oldestAtMs === null ? null : now - oldestAtMs;

    return NextResponse.json({
      worker: {
        alive: Boolean(heartbeat),
        lastSeen: heartbeat, // ISO string or null (key TTLs out 90s after death)
      },
      queue: queueCounts, // null when Redis is unreachable
      logs: {
        queuedTotal,
        oldestActionableQueuedAt: oldestActionable?.createdAt ?? null,
        oldestActionableAgeMs: oldestAgeMs,
        stuck: oldestAgeMs !== null && oldestAgeMs > queuedAlertAgeMs,
      },
      thresholds: { maxJobAgeMs, queuedAlertAgeMs },
    });
  } catch (error) {
    return apiError(error, {
      route: "GET /api/super-admin/ops/email-health",
      safeMessage: "Failed to read email pipeline health",
    });
  }
});
