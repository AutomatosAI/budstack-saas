/**
 * PRD-220 Part A — email-worker health primitives.
 *
 * Pure logic + shared constants only (unit-tested in
 * tests/unit/email-worker-health.test.ts). All IO — Redis heartbeat writes,
 * email_logs queries, console alerts — stays in scripts/email-worker.ts and
 * the super-admin email-health route, which both import from here so the
 * writer and the readers can never drift on key names or thresholds.
 */

/** Redis key the worker heartbeats; the health route reads it. */
export const EMAIL_WORKER_HEARTBEAT_KEY = "email-worker:heartbeat";
export const HEARTBEAT_INTERVAL_MS = 30_000;
/** TTL > 2 intervals so one missed tick doesn't read as death. */
export const HEARTBEAT_TTL_SECONDS = 90;

/** Older than this, a job is expired instead of sent (env: EMAIL_MAX_JOB_AGE_MS). */
export const DEFAULT_MAX_JOB_AGE_MS = 48 * 60 * 60 * 1000;
/** Oldest send-eligible QUEUED row older than this raises the alert line (env: EMAIL_QUEUED_ALERT_AGE_MS). */
export const DEFAULT_QUEUED_ALERT_AGE_MS = 15 * 60 * 1000;
export const QUEUED_ALERT_DEBOUNCE_MS = 5 * 60 * 1000;

/**
 * Stable prefix for the stuck-queue alert. Railway log alerting matches on
 * this exact string (see docs/runbooks/email-worker.md) — do not reword.
 */
export const QUEUED_ALERT_PREFIX = "[EmailWorker][ALERT] oldest actionable QUEUED email";

/** Parse a millisecond env value; falls back on unset/garbage/non-positive. */
export function msFromEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * A job past its max age must be expired, not sent — the backlog that
 * accumulated while no worker was deployed must never blast customers with
 * weeks-old invites/confirmations the moment a worker comes up.
 */
export function isJobExpired(
  jobTimestampMs: number,
  nowMs: number,
  maxAgeMs: number,
): boolean {
  return nowMs - jobTimestampMs > maxAgeMs;
}

/**
 * Returns the alert line to log when the oldest send-eligible QUEUED row
 * breaches the threshold, or null when there is nothing to alert on.
 */
export function queuedAlertLine(
  oldestQueuedAtMs: number | null,
  nowMs: number,
  alertAgeMs: number,
): string | null {
  if (oldestQueuedAtMs === null) return null;
  const ageMs = nowMs - oldestQueuedAtMs;
  if (ageMs <= alertAgeMs) return null;
  const ageMin = Math.round(ageMs / 60_000);
  const thresholdMin = Math.round(alertAgeMs / 60_000);
  return `${QUEUED_ALERT_PREFIX} is ${ageMin}min old (threshold ${thresholdMin}min) — check worker liveness and SMTP config`;
}
