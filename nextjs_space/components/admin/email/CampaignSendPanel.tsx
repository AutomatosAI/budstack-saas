"use client";

/**
 * US-019 — the send controls and the progress they produce.
 *
 * One panel for both halves of the screen because they are the same question at
 * different moments: before a send it asks "shall I?", during one it answers
 * "how far?". Splitting them would mean an author clicking Send and watching the
 * control they just used disappear with nothing in its place.
 *
 * The counts come from the campaign endpoint, which folds them out of
 * `campaign_recipients` — the delivery record — and are polled only while the
 * fan-out is actually running.
 */

import { useState } from "react";
import useSWR from "swr";
import { Loader2, Send, XCircle } from "lucide-react";

import { toast } from "@/components/ui/sonner";
import {
  isCampaignCancellable,
  isCampaignInFlight,
} from "@/lib/email/campaign-rules";
import type { CampaignStatus } from "@prisma/client";

const CAMPAIGNS_URL = "/api/tenant-admin/campaigns";

/** Often enough to feel live, rare enough to leave the rate cap the bottleneck. */
const PROGRESS_POLL_MS = 5000;

const SEND_FAILED_MESSAGE = "Failed to start this send";
const CANCEL_FAILED_MESSAGE = "Failed to cancel this campaign";

interface CampaignProgress {
  readonly status: CampaignStatus;
  readonly recipientCount: number;
  readonly sentCount: number;
  readonly failedCount: number;
  readonly suppressedCount: number;
}

export interface CampaignSendPanelProps {
  readonly campaignId: string;
  /** Server-rendered status, used until the first poll answers. */
  readonly status: CampaignStatus;
  /** False while the author has not chosen an audience — send is not offered. */
  readonly hasAudience: boolean;
  /** Refresh the page around this panel once a send or cancel lands. */
  readonly onChanged?: () => void;
}

const fetcher = async (url: string): Promise<CampaignProgress> => {
  const res = await fetch(url);
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(payload?.error || `Failed to fetch (${res.status})`);
  return payload;
};

/** POST with no body, surfacing the server's own sentence on refusal. */
async function post(url: string, fallbackMessage: string): Promise<void> {
  const res = await fetch(url, { method: "POST" }).catch(() => {
    throw new Error(fallbackMessage);
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(payload?.error || fallbackMessage);
}

export function CampaignSendPanel({
  campaignId,
  status,
  hasAudience,
  onChanged,
}: CampaignSendPanelProps) {
  const [busy, setBusy] = useState(false);

  const { data, mutate } = useSWR<CampaignProgress>(
    `${CAMPAIGNS_URL}/${campaignId}`,
    fetcher,
    {
      refreshInterval: isCampaignInFlight(status) ? PROGRESS_POLL_MS : 0,
      revalidateOnFocus: false,
    },
  );

  const liveStatus = data?.status ?? status;
  const sent = data?.sentCount ?? 0;
  const failed = data?.failedCount ?? 0;
  const suppressed = data?.suppressedCount ?? 0;
  const total = data?.recipientCount ?? 0;

  const run = async (path: string, fallback: string, done: string) => {
    setBusy(true);
    try {
      await post(`${CAMPAIGNS_URL}/${campaignId}/${path}`, fallback);
      toast.success(done);
      await mutate();
      onChanged?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const handleSend = () => {
    if (
      !confirm(
        "Send this campaign now? Everyone in the audience is mailed once, and it cannot be recalled.",
      )
    ) {
      return;
    }
    void run("send", SEND_FAILED_MESSAGE, "Sending — messages are on their way");
  };

  const handleCancel = () => {
    if (!confirm("Stop this campaign? Messages already sent cannot be recalled.")) {
      return;
    }
    void run("cancel", CANCEL_FAILED_MESSAGE, "Campaign cancelled");
  };

  const canSend = liveStatus === "DRAFT" || liveStatus === "SCHEDULED";

  return (
    <div className="bs-card bs-card-pad flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1">
        <p className="bs-eyebrow">Sending</p>
        {total > 0 ? (
          <p className="text-sm text-bs-fg-muted">
            <span className="font-mono tabular-nums text-bs-fg">{sent}</span> of{" "}
            <span className="font-mono tabular-nums">{total}</span> sent
            {failed > 0 && (
              <>
                {" · "}
                <span className="font-mono tabular-nums text-bs-danger">
                  {failed}
                </span>{" "}
                failed
              </>
            )}
            {suppressed > 0 && (
              <>
                {" · "}
                <span className="font-mono tabular-nums">{suppressed}</span>{" "}
                unsubscribed
              </>
            )}
          </p>
        ) : (
          <p className="text-sm text-bs-fg-muted">
            {hasAudience
              ? "Nobody has been mailed yet. Recipients are worked out the moment you send, so anyone who opts out before then is left off."
              : "Choose an audience above before sending."}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isCampaignCancellable(liveStatus) && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={busy}
            className="bs-btn bs-btn-ghost text-bs-danger hover:text-bs-danger"
          >
            <XCircle className="h-4 w-4" /> <span>Stop sending</span>
          </button>
        )}
        {canSend && (
          <button
            type="button"
            onClick={handleSend}
            disabled={busy || !hasAudience}
            className="bs-btn bs-btn-green"
            title={hasAudience ? "Send now" : "Choose an audience first"}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />{" "}
                <span>Starting...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> <span>Send now</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
