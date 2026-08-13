"use client";

/**
 * US-017 — the Campaigns tab.
 *
 * Both numbers come from `campaign_recipients` via the API's fold
 * (`lib/email/campaign-fields.ts`), so a draft reads 0/0 rather than an
 * invented estimate: nothing is resolved before send time, because `audience`
 * stores a RULE and not an address list.
 */

import { useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import useSWR from "swr";
import { Edit, Loader2, Plus, Trash2 } from "lucide-react";

import { toast } from "@/components/ui/sonner";
import type { CampaignListRow } from "@/lib/email/campaign-fields";
import { isCampaignEditable } from "@/lib/email/campaign-rules";

const CAMPAIGNS_URL = "/api/tenant-admin/campaigns";
const NEW_CAMPAIGN_HREF = "/tenant-admin/emails/campaigns/new";

/** Chip per status. Cancelled reads as a dead end, not as another draft. */
const STATUS_CHIP: Record<CampaignListRow["status"], string> = {
  DRAFT: "bs-chip bs-chip-muted",
  SCHEDULED: "bs-chip bs-chip-info",
  SENDING: "bs-chip bs-chip-warn",
  SENT: "bs-chip bs-chip-green",
  CANCELLED: "bs-chip bs-chip-danger",
};

const fetcher = async (url: string): Promise<CampaignListRow[]> => {
  const res = await fetch(url);
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(payload?.error || `Failed to fetch (${res.status})`);
  }
  return payload ?? [];
};

export function TenantCampaignList() {
  const { data, error, isLoading, mutate } = useSWR<CampaignListRow[]>(
    CAMPAIGNS_URL,
    fetcher,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (campaign: CampaignListRow) => {
    if (!confirm(`Delete the draft "${campaign.name}"? This cannot be undone.`)) {
      return;
    }
    setDeletingId(campaign.id);
    try {
      const res = await fetch(`${CAMPAIGNS_URL}/${campaign.id}`, {
        method: "DELETE",
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error || "Failed to delete campaign");
      toast.success("Campaign deleted");
      mutate();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete campaign",
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bs-card bs-card-pad flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-bs-fg-muted" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bs-card bs-card-pad text-sm text-bs-danger">
        Failed to load campaigns.
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bs-card bs-card-pad flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-sm text-bs-fg-muted">
          No campaigns yet. Write a newsletter and save it as a draft.
        </p>
        <Link href={NEW_CAMPAIGN_HREF}>
          <span className="bs-btn bs-btn-green bs-btn-sm">
            <Plus className="h-4 w-4" /> <span>New Campaign</span>
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div className="bs-card bs-card-pad space-y-4">
      <div className="flex justify-end">
        <Link href={NEW_CAMPAIGN_HREF}>
          <span className="bs-btn bs-btn-green bs-btn-sm">
            <Plus className="h-4 w-4" /> <span>New Campaign</span>
          </span>
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="bs-table w-full">
          <thead>
            <tr>
              <th className="text-left">Campaign</th>
              <th className="text-left">Status</th>
              <th className="text-right">Audience</th>
              <th className="text-right">Sent</th>
              <th className="hidden text-left md:table-cell">Last Updated</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((campaign) => {
              const editable = isCampaignEditable(campaign.status);
              return (
                <tr key={campaign.id}>
                  <td className="font-medium text-bs-fg">
                    {campaign.name}
                    <div className="max-w-[150px] truncate text-xs text-bs-fg-muted sm:max-w-[300px]">
                      {campaign.subject}
                    </div>
                  </td>
                  <td>
                    <span className={STATUS_CHIP[campaign.status]}>
                      {campaign.status}
                    </span>
                  </td>
                  <td className="text-right font-mono text-bs-fg-muted tabular-nums">
                    {campaign.recipientCount}
                  </td>
                  <td className="text-right font-mono text-bs-fg-muted tabular-nums">
                    {campaign.sentCount}
                    {/* US-019: the two outcomes that are not a delivery, shown
                        only when there are any — a clean send should read as a
                        clean send, not as three zeroes. */}
                    {(campaign.failedCount > 0 ||
                      campaign.suppressedCount > 0) && (
                      <div className="text-xs">
                        {campaign.failedCount > 0 && (
                          <span className="text-bs-danger">
                            {campaign.failedCount} failed
                          </span>
                        )}
                        {campaign.failedCount > 0 &&
                          campaign.suppressedCount > 0 &&
                          " · "}
                        {campaign.suppressedCount > 0 && (
                          <span>{campaign.suppressedCount} opted out</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="hidden font-mono text-bs-fg-muted tabular-nums md:table-cell">
                    {format(new Date(campaign.updatedAt), "MMM d, yyyy")}
                  </td>
                  <td className="text-right">
                    <div className="flex min-w-[80px] flex-nowrap items-center justify-end gap-1 whitespace-nowrap">
                      <Link href={`/tenant-admin/emails/campaigns/${campaign.id}`}>
                        <span
                          className="bs-btn bs-btn-ghost bs-btn-sm h-8 w-8 px-0"
                          title={editable ? "Edit campaign" : "View campaign"}
                        >
                          <Edit className="h-4 w-4" />
                        </span>
                      </Link>
                      {editable && (
                        <button
                          type="button"
                          onClick={() => handleDelete(campaign)}
                          disabled={deletingId === campaign.id}
                          title="Delete campaign"
                          className="bs-btn bs-btn-ghost bs-btn-sm h-8 w-8 px-0 text-bs-danger hover:text-bs-danger"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
