import { beforeEach, describe, expect, it, vi } from "vitest";

// Email Phase 2 US-019 — the writes the worker makes as a campaign goes out.
// Unit-tested against a prisma mock rather than by booting the worker: what
// matters here is that every statement names the tenant and that the campaign
// can only complete once.

const prismaMock = vi.hoisted(() => ({
  campaigns: { findFirst: vi.fn(), updateMany: vi.fn() },
  campaign_recipients: { updateMany: vi.fn(), groupBy: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  finalizeCampaignIfComplete,
  loadCampaignForSend,
  markCampaignRecipient,
} from "@/lib/email/campaign-recipient-store";

const CAMPAIGN_ID = "campaign-1";
const TENANT_A = "tenant-a";

const bucket = (status: string, count: number) => ({
  status,
  _count: { _all: count },
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.campaigns.findFirst.mockResolvedValue({
    id: CAMPAIGN_ID,
    status: "SENDING",
    subject: "Hi {{userName}}",
    contentHtml: "<p>Hi {{userName}}</p>",
  });
  prismaMock.campaigns.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.campaign_recipients.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.campaign_recipients.groupBy.mockResolvedValue([]);
});

describe("loadCampaignForSend", () => {
  it("names the tenant in the query rather than trusting the payload's id", async () => {
    await loadCampaignForSend(CAMPAIGN_ID, TENANT_A);

    // The worker has no bound tenant context, so tenantId has to be IN the
    // where — a tampered payload then resolves to nothing rather than to
    // another store's campaign.
    expect(prismaMock.campaigns.findFirst.mock.calls[0][0].where).toEqual({
      id: CAMPAIGN_ID,
      tenantId: TENANT_A,
    });
  });

  it("reads a deleted campaign as null", async () => {
    prismaMock.campaigns.findFirst.mockResolvedValue(null);
    await expect(loadCampaignForSend(CAMPAIGN_ID, TENANT_A)).resolves.toBeNull();
  });
});

describe("markCampaignRecipient", () => {
  it("records the outcome and the log row it came from", async () => {
    await markCampaignRecipient({
      recipientId: "recipient-1",
      status: "SENT",
      emailLogId: "log-1",
      error: null,
    });

    const write = prismaMock.campaign_recipients.updateMany.mock.calls[0][0];
    expect(write.where).toEqual({ id: "recipient-1" });
    expect(write.data).toEqual({
      status: "SENT",
      emailLogId: "log-1",
      error: null,
    });
  });

  it("leaves untouched fields alone", async () => {
    await markCampaignRecipient({ recipientId: "recipient-1", status: "QUEUED" });

    expect(
      prismaMock.campaign_recipients.updateMany.mock.calls[0][0].data,
    ).toEqual({ status: "QUEUED" });
  });
});

describe("finalizeCampaignIfComplete", () => {
  it("leaves the campaign SENDING while anyone still owes an outcome", async () => {
    prismaMock.campaign_recipients.groupBy.mockResolvedValue([
      bucket("SENT", 4),
      bucket("QUEUED", 2),
    ]);

    await expect(
      finalizeCampaignIfComplete(CAMPAIGN_ID, TENANT_A),
    ).resolves.toBe(false);
    expect(prismaMock.campaigns.updateMany).not.toHaveBeenCalled();
  });

  it("flips to SENT with a stats snapshot once nobody is left", async () => {
    prismaMock.campaign_recipients.groupBy.mockResolvedValue([
      bucket("SENT", 8),
      bucket("FAILED", 1),
      bucket("SUPPRESSED", 3),
    ]);
    const now = new Date("2026-08-13T10:00:00Z");

    await expect(
      finalizeCampaignIfComplete(CAMPAIGN_ID, TENANT_A, now),
    ).resolves.toBe(true);

    const write = prismaMock.campaigns.updateMany.mock.calls[0][0];
    // `status: SENDING` is part of the write, so only one job's update lands
    // and a campaign an admin cancelled mid-send is never resurrected.
    expect(write.where).toEqual({
      id: CAMPAIGN_ID,
      tenantId: TENANT_A,
      status: "SENDING",
    });
    expect(write.data.status).toBe("SENT");
    expect(write.data.sentAt).toBe(now);
    expect(write.data.stats).toEqual({
      total: 12,
      sent: 8,
      failed: 1,
      suppressed: 3,
      pending: 0,
    });
  });

  it("reports no flip when another job got there first", async () => {
    prismaMock.campaign_recipients.groupBy.mockResolvedValue([bucket("SENT", 1)]);
    prismaMock.campaigns.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      finalizeCampaignIfComplete(CAMPAIGN_ID, TENANT_A),
    ).resolves.toBe(false);
  });
});
