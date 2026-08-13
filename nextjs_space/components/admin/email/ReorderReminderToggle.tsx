"use client";

/**
 * US-028 — the per-store reorder-reminder switch and its window.
 *
 * Off until asked for, and the copy says who actually gets mailed rather than
 * selling the retention play: turning this on starts a daily job that sends
 * unprompted marketing to people who bought once, so the four conditions it
 * applies are on the screen next to the switch instead of in a doc.
 *
 * The interval saves on blur/Enter rather than on every keystroke — the number
 * is the send window, and a half-typed "6" on the way to "60" is a legal value
 * that would mail everybody a week later.
 */

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Loader2 } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/sonner";
import {
  MAX_REORDER_REMINDER_DAYS,
  MIN_REORDER_REMINDER_DAYS,
  REORDER_REMINDER_DAYS_MESSAGE,
} from "@/lib/email/reorder-reminder";

import {
  EMAIL_SETTINGS_URL,
  REORDER_SAVE_FAILED_MESSAGE,
  readReorderReminder,
  saveReorderReminder,
  type ReorderReminderSettings,
} from "./email-settings-client";

/** Its own SWR key: this reads the same endpoint as the tracking switch, and
 *  the two must not share a cache entry holding different shapes. */
const SWR_KEY = `${EMAIL_SETTINGS_URL}#reorder`;

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : REORDER_SAVE_FAILED_MESSAGE;
}

export function ReorderReminderToggle() {
  const { data, error, isLoading, mutate } = useSWR<ReorderReminderSettings>(
    SWR_KEY,
    () => readReorderReminder(EMAIL_SETTINGS_URL),
  );
  const [saving, setSaving] = useState(false);
  const [draftDays, setDraftDays] = useState("");

  // The input is uncontrolled until the server answers, then seeded once. A
  // value bound straight to `data` would overwrite what the operator is typing
  // every time SWR revalidated.
  useEffect(() => {
    if (data) setDraftDays(String(data.days));
  }, [data]);

  const enabled = data?.enabled === true;
  const busy = saving || isLoading;

  const apply = async (
    patch: Partial<ReorderReminderSettings>,
    success: string,
  ) => {
    setSaving(true);
    try {
      await mutate(saveReorderReminder(patch), { revalidate: false });
      toast.success(success);
    } catch (cause) {
      toast.error(errorMessage(cause));
      // Put the field back to what the server actually holds — a rejected
      // interval must not sit on screen looking saved.
      await mutate();
    } finally {
      setSaving(false);
    }
  };

  const toggle = (next: boolean) =>
    apply(
      { enabled: next },
      next
        ? "Reorder reminders on — the next daily run will include this store"
        : "Reorder reminders off — nothing further will be sent",
    );

  const commitDays = async () => {
    const parsed = Number(draftDays);
    if (!Number.isInteger(parsed) || parsed === data?.days) {
      setDraftDays(String(data?.days ?? ""));
      return;
    }
    if (
      parsed < MIN_REORDER_REMINDER_DAYS ||
      parsed > MAX_REORDER_REMINDER_DAYS
    ) {
      toast.error(REORDER_REMINDER_DAYS_MESSAGE);
      setDraftDays(String(data?.days ?? ""));
      return;
    }
    await apply({ days: parsed }, `Reminder window set to ${parsed} days`);
  };

  return (
    <div className="bs-card bs-card-pad space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="bs-eyebrow">Reorder reminders</p>
          <p className="text-sm text-bs-fg-muted">
            Off by default. When on, a daily job emails customers whose last
            delivered order is older than the window below — and only those who
            ticked the marketing box, have not ordered since, have not
            unsubscribed, and have not already had a reminder this window.
          </p>
          <p className="text-sm text-bs-fg-muted">
            The message is the platform default until you point the{" "}
            <span className="font-medium">Reorder Reminder</span> event at a
            template of your own under Event Triggers.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-1">
          {busy && (
            <Loader2 className="h-4 w-4 animate-spin text-bs-fg-muted" />
          )}
          <Switch
            checked={enabled}
            onCheckedChange={toggle}
            disabled={busy || Boolean(error)}
            aria-label="Reorder reminders"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-bs-fg-muted">
        <span>Send</span>
        <input
          type="number"
          className="bs-input w-24"
          min={MIN_REORDER_REMINDER_DAYS}
          max={MAX_REORDER_REMINDER_DAYS}
          step={1}
          value={draftDays}
          onChange={(event) => setDraftDays(event.target.value)}
          onBlur={commitDays}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          disabled={busy || Boolean(error)}
          aria-label="Days after the last delivered order"
        />
        <span>days after a customer&rsquo;s last delivered order</span>
      </label>

      {error && (
        <p className="text-sm text-bs-danger">{errorMessage(error)}</p>
      )}
    </div>
  );
}
