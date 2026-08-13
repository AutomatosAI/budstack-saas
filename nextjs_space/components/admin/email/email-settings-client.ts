/**
 * US-027 — the two requests behind the tracking switch.
 *
 * Split out of the component for the same reason `segment-client.ts` is: these
 * are the parts worth pinning with tests, and neither needs a DOM. The setting
 * KEY is imported rather than restated — it is the same string the API
 * validates, the render path reads and the privacy notice branches on, and a
 * fifth copy of it in a fetch body is a typo waiting to fail silently as
 * "tracking never turns on".
 */

import { EMAIL_TRACKING_SETTING } from "@/lib/email/email-tracking";
import {
  DEFAULT_REORDER_REMINDER_DAYS,
  MAX_REORDER_REMINDER_DAYS,
  MIN_REORDER_REMINDER_DAYS,
  REORDER_REMINDER_DAYS_SETTING,
  REORDER_REMINDER_SETTING,
} from "@/lib/email/reorder-reminder";

export const EMAIL_SETTINGS_URL = "/api/tenant-admin/email-settings";

export const EMAIL_TRACKING_READ_FAILED_MESSAGE =
  "Couldn't load the tracking setting.";

export const EMAIL_TRACKING_SAVE_FAILED_MESSAGE =
  "Couldn't change the tracking setting.";

/** The flag out of a response body, defaulting to OFF for anything unexpected. */
function readFlag(payload: unknown): boolean {
  if (typeof payload !== "object" || payload === null) return false;
  return (payload as Record<string, unknown>)[EMAIL_TRACKING_SETTING] === true;
}

async function parse(res: Response, fallback: string): Promise<unknown> {
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(
      (payload as { error?: string } | null)?.error || fallback,
    );
  }
  return payload;
}

/** Current state of the switch. */
export async function readEmailTracking(url: string): Promise<boolean> {
  const res = await fetch(url);
  return readFlag(await parse(res, EMAIL_TRACKING_READ_FAILED_MESSAGE));
}

/**
 * Flip the switch, and answer with what the SERVER now holds rather than with
 * what was asked for — a 200 that came back saying something else is the one
 * case where echoing the request would leave the UI lying.
 */
export async function saveEmailTracking(enabled: boolean): Promise<boolean> {
  const res = await fetch(EMAIL_SETTINGS_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [EMAIL_TRACKING_SETTING]: enabled }),
  });
  return readFlag(await parse(res, EMAIL_TRACKING_SAVE_FAILED_MESSAGE));
}

// ── US-028: the reorder-reminder rule, on the same endpoint ──────────────────

export const REORDER_READ_FAILED_MESSAGE =
  "Couldn't load the reorder reminder setting.";

export const REORDER_SAVE_FAILED_MESSAGE =
  "Couldn't change the reorder reminder setting.";

/** The rule as the screen holds it. */
export interface ReorderReminderSettings {
  readonly enabled: boolean;
  readonly days: number;
}

/**
 * The rule out of a response body, defaulting to OFF at the default interval for
 * anything unexpected — the same fail-safe reading `readFlag` uses, and the same
 * one the server applies to an unreadable settings blob.
 */
function readRule(payload: unknown): ReorderReminderSettings {
  if (typeof payload !== "object" || payload === null) {
    return { enabled: false, days: DEFAULT_REORDER_REMINDER_DAYS };
  }
  const body = payload as Record<string, unknown>;
  const days = body[REORDER_REMINDER_DAYS_SETTING];
  return {
    enabled: body[REORDER_REMINDER_SETTING] === true,
    days:
      typeof days === "number" &&
      Number.isInteger(days) &&
      days >= MIN_REORDER_REMINDER_DAYS &&
      days <= MAX_REORDER_REMINDER_DAYS
        ? days
        : DEFAULT_REORDER_REMINDER_DAYS,
  };
}

/** Current state of the rule. */
export async function readReorderReminder(
  url: string,
): Promise<ReorderReminderSettings> {
  const res = await fetch(url);
  return readRule(await parse(res, REORDER_READ_FAILED_MESSAGE));
}

/**
 * Change the rule, and answer with what the SERVER now holds. Only the keys
 * being changed are sent, so saving the interval cannot silently restate the
 * switch (or the tracking flag) from a stale copy of the screen.
 */
export async function saveReorderReminder(
  patch: Partial<ReorderReminderSettings>,
): Promise<ReorderReminderSettings> {
  const body: Record<string, unknown> = {};
  if (patch.enabled !== undefined) {
    body[REORDER_REMINDER_SETTING] = patch.enabled;
  }
  if (patch.days !== undefined) {
    body[REORDER_REMINDER_DAYS_SETTING] = patch.days;
  }

  const res = await fetch(EMAIL_SETTINGS_URL, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readRule(await parse(res, REORDER_SAVE_FAILED_MESSAGE));
}
