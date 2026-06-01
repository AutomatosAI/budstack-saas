/**
 * Operational alerting channel (PRD-215, AC-7 / AC-7a).
 *
 * A thin, transport-pluggable abstraction that turns a structured ops/security
 * event into a page for on-call. Today it posts to a Slack/Discord-style
 * incoming webhook configured from `ALERT_WEBHOOK_URL`; the transport is
 * deliberately swappable so PagerDuty/email can be added later (OQ-3).
 *
 * Hard rules:
 *  - Alerting NEVER breaks the request path — every failure is swallowed and
 *    downgraded to a `logger.error` (AC: "failures are swallowed").
 *  - The event payload is redacted via the logger before it leaves the process
 *    (the identifier in `ops.rate_limit_fail_open` is expected pre-hashed by the
 *    caller; we still pass everything through the redacting logger).
 *
 * RALPH_BLOCKED: the real PagerDuty/Slack delivery + on-call routing + status
 * page hosting need live infra and an org webhook secret. Wiring the actual
 * provider, ret ries, and delivery-SLA monitoring is deferred until that infra
 * exists; this file ships the stable interface its callers (rate-limit
 * fail-open, webhook fail-open, cross-PRD security events) bind to now.
 */

import { logger } from "@/lib/logger";

/** Known ops/security alert events (AC-7 / AC-7a). */
export type AlertEvent =
  | "ops.rate_limit_fail_open"
  | "ops.webhook_rate_limit_fail_open"
  | "security.tenant_context_missing"
  | "account.erasure_noop_user_not_found";

export type AlertSeverity = "info" | "warning" | "critical";

export interface AlertPayload {
  /** The event name — maps to a runbook (e.g. rate-limit-fail-open.md). */
  event: AlertEvent;
  /** Human-readable one-liner for the on-call notification. */
  message: string;
  /** Severity for routing/paging. Defaults to "warning". */
  severity?: AlertSeverity;
  /**
   * Structured context. MUST already be free of raw PII (identifiers hashed);
   * still routed through the redacting logger as defence in depth.
   */
  context?: Record<string, unknown>;
}

function isAlertingConfigured(): boolean {
  return Boolean(process.env.ALERT_WEBHOOK_URL);
}

/**
 * Deliver an alert to the configured transport.
 *
 * Returns `true` if the alert was accepted by the transport, `false` if it was
 * dropped (no config, transport error, etc.). NEVER throws — a failed alert is
 * logged and swallowed so it cannot take down the calling request.
 */
export async function sendAlert(payload: AlertPayload): Promise<boolean> {
  const severity = payload.severity ?? "warning";

  // Always leave a structured breadcrumb in the log stream, redacted, so the
  // event is observable even when the transport is unconfigured or down.
  logger.warn(`alert:${payload.event}`, {
    severity,
    message: payload.message,
    ...(payload.context ?? {}),
  });

  if (!isAlertingConfigured()) {
    // No transport wired (dev/test/CI). The log breadcrumb above is the record.
    return false;
  }

  // RALPH_BLOCKED: live delivery (Slack/PagerDuty), retry/backoff, and the
  // delivery-SLA check belong here once the org webhook + on-call routing exist.
  // The fetch below is the minimal stub — kept behind config so it never fires
  // in CI/test and never blocks the request if the endpoint is unreachable.
  try {
    const res = await fetch(process.env.ALERT_WEBHOOK_URL as string, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `[${severity.toUpperCase()}] ${payload.event}: ${payload.message}`,
        event: payload.event,
        severity,
        context: payload.context ?? {},
      }),
    });
    if (!res.ok) {
      logger.error("alert:delivery_failed", {
        event: payload.event,
        status: res.status,
      });
      return false;
    }
    return true;
  } catch (error) {
    // Swallow — alerting must never break the request path.
    logger.error("alert:delivery_error", {
      event: payload.event,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
