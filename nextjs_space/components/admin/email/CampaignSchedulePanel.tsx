"use client";

/**
 * US-021 — choosing when a campaign goes out.
 *
 * A `datetime-local` input rather than a component library's calendar: it is
 * the one control that shows an author their OWN clock without a timezone
 * conversation, which is what "9am Tuesday" means to the person typing it. The
 * value is converted to a real instant on the way out, so the server never has
 * to guess whose morning was meant.
 *
 * Shown only while the campaign is still the author's (DRAFT or SCHEDULED) —
 * the panel disappears the moment a fan-out starts, because by then the
 * question has been answered.
 */

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { CalendarClock, Loader2 } from "lucide-react";

import { toast } from "@/components/ui/sonner";
import {
  CAMPAIGN_SCHEDULE_MAX_HORIZON_MS,
  CAMPAIGN_SCHEDULE_MIN_LEAD_MS,
} from "@/lib/email/campaign-schedule";
import type { CampaignStatus } from "@prisma/client";

const CAMPAIGNS_URL = "/api/tenant-admin/campaigns";

const SCHEDULE_FAILED_MESSAGE = "Failed to schedule this campaign";

/** What `<input type="datetime-local">` reads and writes: local, to the minute. */
const INPUT_FORMAT = "yyyy-MM-dd'T'HH:mm";

const toInputValue = (date: Date): string => format(date, INPUT_FORMAT);

export interface CampaignSchedulePanelProps {
  readonly campaignId: string;
  readonly status: CampaignStatus;
  /** When it is currently due to go out, if it is. */
  readonly scheduledAt: string | null;
  /** False while no audience is chosen — the server refuses either way. */
  readonly hasAudience: boolean;
  readonly onChanged?: () => void;
}

export function CampaignSchedulePanel({
  campaignId,
  status,
  scheduledAt,
  hasAudience,
  onChanged,
}: CampaignSchedulePanelProps) {
  const [value, setValue] = useState(() =>
    scheduledAt ? toInputValue(new Date(scheduledAt)) : "",
  );
  const [bounds, setBounds] = useState<{ min: string; max: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  // After mount, never during render: the server rendering this component has
  // a different "now" than the browser, and a bound computed in both places
  // would be a hydration mismatch on every load.
  useEffect(() => {
    const now = Date.now();
    setBounds({
      min: toInputValue(new Date(now + CAMPAIGN_SCHEDULE_MIN_LEAD_MS)),
      max: toInputValue(new Date(now + CAMPAIGN_SCHEDULE_MAX_HORIZON_MS)),
    });
  }, []);

  const isScheduled = status === "SCHEDULED";

  const handleSchedule = async () => {
    // The picker hands back local wall-clock time; this is where it becomes an
    // instant, using the author's own timezone to do it.
    const at = new Date(value);
    if (!value || Number.isNaN(at.getTime())) {
      toast.error("Pick a date and time first");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${CAMPAIGNS_URL}/${campaignId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: at.toISOString() }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || SCHEDULE_FAILED_MESSAGE);

      toast.success(`Scheduled for ${format(at, "MMM d, yyyy 'at' HH:mm")}`);
      onChanged?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : SCHEDULE_FAILED_MESSAGE,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bs-card bs-card-pad flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="space-y-1">
        <p className="bs-eyebrow">Scheduling</p>
        <p className="text-sm text-bs-fg-muted">
          {isScheduled && scheduledAt ? (
            <>
              Due to go out{" "}
              <span className="font-medium text-bs-fg">
                {format(new Date(scheduledAt), "MMM d, yyyy 'at' HH:mm")}
              </span>
              . Pick another time to move it, or stop it above.
            </>
          ) : (
            "Send it later instead. Recipients are still worked out at send time, so anyone who opts out before then is left off."
          )}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="campaign-scheduled-at">
          Send date and time
        </label>
        <input
          id="campaign-scheduled-at"
          type="datetime-local"
          className="bs-input h-9 w-[15rem]"
          value={value}
          min={bounds?.min}
          max={bounds?.max}
          disabled={busy}
          onChange={(event) => setValue(event.target.value)}
        />
        <button
          type="button"
          onClick={handleSchedule}
          disabled={busy || !hasAudience || !value}
          className="bs-btn bs-btn-ghost"
          title={
            hasAudience ? "Schedule this send" : "Choose an audience first"
          }
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CalendarClock className="h-4 w-4" />
          )}
          <span>{isScheduled ? "Reschedule" : "Schedule"}</span>
        </button>
      </div>
    </div>
  );
}
