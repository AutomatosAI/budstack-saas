/**
 * US-017 — the one request both campaign screens make.
 *
 * Shared so the two clients cannot report failures differently. It reads the
 * server's own sentence rather than substituting "Failed to save": the two
 * rejections this endpoint has are a missing unsubscribe link and a campaign
 * that has already left (409), and both tell the author something a generic
 * message would throw away.
 */

import type { CampaignDraft } from "./CampaignEditor";

const CAMPAIGNS_URL = "/api/tenant-admin/campaigns";

const SAVE_FAILED_MESSAGE = "Failed to save campaign";

export interface SavedCampaign {
  readonly id: string;
}

/** Create when no id is given, update when there is one. */
export async function saveCampaign(
  draft: CampaignDraft,
  campaignId?: string,
): Promise<SavedCampaign> {
  const res = await fetch(
    campaignId ? `${CAMPAIGNS_URL}/${campaignId}` : CAMPAIGNS_URL,
    {
      method: campaignId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    },
  ).catch(() => {
    // A dropped connection rejects with a TypeError whose message is the
    // browser's wording ("Failed to fetch"); the author gets ours instead.
    throw new Error(SAVE_FAILED_MESSAGE);
  });

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(payload?.error || SAVE_FAILED_MESSAGE);
  }
  if (!payload?.id) {
    throw new Error(SAVE_FAILED_MESSAGE);
  }
  return payload as SavedCampaign;
}
