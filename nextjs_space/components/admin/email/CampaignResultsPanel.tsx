"use client";

/**
 * US-026 — how a campaign did, after it has gone.
 *
 * The send panel above it is the control; this is the record. The numbers come
 * from `campaign_recipients` rather than `campaigns.stats`, so they stay true
 * mid-send and after a retry, and the failure reasons come from the linked
 * `email_logs` rows — which is the only place the mail server's own answer is
 * kept.
 */

import { useState } from "react";
import useSWR from "swr";
import { Download, Loader2 } from "lucide-react";

import { toast } from "@/components/ui/sonner";
import { downloadCampaignRecipients } from "@/components/admin/email/campaign-export-download";
import type { CampaignResults } from "@/lib/email/campaign-results";
import { isCampaignInFlight } from "@/lib/email/campaign-rules";
import type { CampaignStatus } from "@prisma/client";

/** Matches the send panel's cadence — the two poll the same fan-out. */
const PROGRESS_POLL_MS = 5000;

const LOAD_FAILED_MESSAGE = "Could not load the results for this campaign";

export interface CampaignResultsPanelProps {
  readonly campaignId: string;
  /** Server-rendered status, used until the first poll answers. */
  readonly status: CampaignStatus;
  /** `canExportCustomers`, resolved on the server. The route re-checks it. */
  readonly canExport: boolean;
}

const fetcher = async (url: string): Promise<CampaignResults> => {
  const res = await fetch(url);
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new Error(payload?.error || LOAD_FAILED_MESSAGE);
  return payload;
};

function Stat({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: number;
  readonly tone?: "danger";
}) {
  return (
    <div className="space-y-0.5">
      <p
        className={`font-mono text-2xl tabular-nums ${
          tone === "danger" ? "text-bs-danger" : "text-bs-fg"
        }`}
      >
        {value}
      </p>
      <p className="text-xs text-bs-fg-muted">{label}</p>
    </div>
  );
}

/**
 * US-027 — shown only while the store has tracking on.
 *
 * Hidden rather than zeroed when it is off, because "0 opened" and "we are not
 * measuring opens" are opposite statements and the same two digits would say
 * both. The counts are of PEOPLE, not events: each recipient is stamped the
 * first time only, so these never exceed the number delivered.
 */
function EngagementStats({ results }: { readonly results: CampaignResults }) {
  if (!results.trackingEnabled) return null;

  return (
    <div className="space-y-2 border-t border-bs-border-100 pt-4">
      <p className="bs-eyebrow">Engagement</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Opened" value={results.opened} />
        <Stat label="Clicked a link" value={results.clicked} />
      </div>
      <p className="text-xs text-bs-fg-muted">
        Counted once per person. Opens are undercounted by design — many mail
        apps block images unless the reader asks for them, so a click is the
        firmer signal of the two.
      </p>
    </div>
  );
}

function FailureList({ results }: { readonly results: CampaignResults }) {
  if (results.failures.length === 0) return null;

  return (
    <div className="space-y-2 border-t border-bs-border-100 pt-4">
      <p className="bs-eyebrow">Why messages did not arrive</p>
      {results.failuresSampled < results.failuresTotal && (
        <p className="text-xs text-bs-fg-muted">
          Based on the first {results.failuresSampled} of{" "}
          {results.failuresTotal} failures.
        </p>
      )}
      <ul className="space-y-2">
        {results.failures.map((failure) => (
          <li key={failure.code} className="text-sm">
            <span className="font-mono tabular-nums text-bs-fg">
              {failure.count}
            </span>{" "}
            <span className="text-bs-fg-muted">{failure.label}</span>
            {failure.example && (
              <p className="mt-0.5 break-words font-mono text-xs text-bs-fg-muted opacity-80">
                {failure.example}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CampaignResultsPanel({
  campaignId,
  status,
  canExport,
}: CampaignResultsPanelProps) {
  const [exporting, setExporting] = useState(false);

  const { data, error } = useSWR<CampaignResults>(
    `/api/tenant-admin/campaigns/${campaignId}/results`,
    fetcher,
    {
      refreshInterval: isCampaignInFlight(status) ? PROGRESS_POLL_MS : 0,
      revalidateOnFocus: false,
    },
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadCampaignRecipients(campaignId);
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Export failed",
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="bs-card bs-card-pad space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="bs-eyebrow">Results</p>
          <p className="text-sm text-bs-fg-muted">
            Counted from the delivery record, so these keep up with a send in
            progress.
          </p>
        </div>
        {canExport && (
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="bs-btn bs-btn-ghost shrink-0"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            <span>Export recipients</span>
          </button>
        )}
      </div>

      {error && <p className="text-sm text-bs-danger">{error.message}</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <Stat label="Delivered" value={data.counts.sent} />
            <Stat label="Failed" value={data.counts.failed} tone="danger" />
            <Stat label="Skipped — opted out" value={data.counts.suppressed} />
            <Stat label="Still to send" value={data.counts.pending} />
            <Stat label="Unsubscribed" value={data.unsubscribed} />
          </div>

          <p className="text-xs text-bs-fg-muted">
            {data.counts.total} people were mailed. &ldquo;Skipped&rdquo; had
            already opted out when the send started; &ldquo;unsubscribed&rdquo;
            left from this campaign&rsquo;s own footer link.
          </p>

          <EngagementStats results={data} />
          <FailureList results={data} />
        </>
      )}
    </div>
  );
}
