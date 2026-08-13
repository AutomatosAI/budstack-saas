import { beforeEach, describe, expect, it, vi } from "vitest";

// Email Phase 2 US-021 — what a delayed trigger does when its time comes.
//
// The whole point of this file is the send-time guard: the decision is made
// against the campaign row as it stands NOW, so a campaign cancelled while it
// waited must never reach the dispatcher.

const { dispatchCampaign } = vi.hoisted(() => ({ dispatchCampaign: vi.fn() }));
const { remove, add } = vi.hoisted(() => ({ remove: vi.fn(), add: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  campaigns: { findFirst: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/email/campaign-dispatch", () => ({ dispatchCampaign }));
vi.mock("@/lib/queue", () => ({
  getCampaignQueue: () => ({ add, remove }),
}));

import { runScheduledCampaign } from "@/lib/email/campaign-scheduled-runner";

const CAMPAIGN_ID = "44444444-4444-4444-4444-444444444444";
const TENANT_ID = "tenant-a";
const JOB_ID = "job-1";

const payload = { campaignId: CAMPAIGN_ID, tenantId: TENANT_ID };

const run = () => runScheduledCampaign(payload, JOB_ID);

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.campaigns.findFirst.mockResolvedValue({
    status: "SCHEDULED",
    scheduledJobId: JOB_ID,
  });
  prismaMock.campaigns.updateMany.mockResolvedValue({ count: 1 });
  dispatchCampaign.mockResolvedValue({
    ok: true,
    queued: 12,
    suppressed: 1,
    ratePerMinute: 60,
  });
});

describe("runScheduledCampaign", () => {
  it("fans the campaign out when it is still waiting on this trigger", async () => {
    const outcome = await run();

    expect(outcome).toEqual(
      expect.objectContaining({ decision: "SEND", queued: 12 }),
    );
    expect(dispatchCampaign).toHaveBeenCalledWith(CAMPAIGN_ID, TENANT_ID);
  });

  it("reads the status at SEND time, scoped to the tenant in the payload", async () => {
    await run();

    expect(prismaMock.campaigns.findFirst).toHaveBeenCalledWith({
      where: { id: CAMPAIGN_ID, tenantId: TENANT_ID },
      select: { status: true, scheduledJobId: true },
    });
  });

  it("NEVER sends a campaign that was cancelled while it waited", async () => {
    prismaMock.campaigns.findFirst.mockResolvedValue({
      status: "CANCELLED",
      scheduledJobId: JOB_ID,
    });

    const outcome = await run();

    expect(outcome.decision).toBe("CANCELLED");
    expect(outcome.queued).toBe(0);
    expect(dispatchCampaign).not.toHaveBeenCalled();
  });

  it("never sends a campaign a reschedule moved on from", async () => {
    prismaMock.campaigns.findFirst.mockResolvedValue({
      status: "SCHEDULED",
      scheduledJobId: "job-2",
    });

    const outcome = await run();

    expect(outcome.decision).toBe("SUPERSEDED");
    expect(dispatchCampaign).not.toHaveBeenCalled();
  });

  it("never sends a campaign that is already sending", async () => {
    prismaMock.campaigns.findFirst.mockResolvedValue({
      status: "SENDING",
      scheduledJobId: JOB_ID,
    });

    const outcome = await run();

    expect(outcome.decision).toBe("NOT_SCHEDULED");
    expect(dispatchCampaign).not.toHaveBeenCalled();
  });

  it("clears the pointer after a send WITHOUT removing the job it is running in", async () => {
    await run();

    // BullMQ refuses to remove a job holding an active lock — this one.
    expect(remove).not.toHaveBeenCalled();
    const clear = prismaMock.campaigns.updateMany.mock.calls.at(-1)?.[0];
    expect(clear.data).toEqual({ scheduledJobId: null });
  });

  it("hands a refused campaign back to its author as a draft", async () => {
    dispatchCampaign.mockResolvedValue({
      ok: false,
      refusal: "EMPTY_AUDIENCE",
      message: "Nobody in that audience can be mailed right now",
    });

    const outcome = await run();

    expect(outcome.queued).toBe(0);
    expect(outcome.refusal).toContain("Nobody in that audience");

    const revert = prismaMock.campaigns.updateMany.mock.calls[0][0];
    expect(revert.data).toEqual({ status: "DRAFT", scheduledJobId: null });
    // The predicate is the safety: a manual send that won the race leaves the
    // campaign SENDING, and this must match nothing rather than re-open it.
    expect(revert.where).toEqual({
      id: CAMPAIGN_ID,
      tenantId: TENANT_ID,
      status: "SCHEDULED",
    });
  });

  it("ignores a payload it cannot read rather than guessing at a campaign", async () => {
    const outcome = await runScheduledCampaign({ campaignId: 42 }, JOB_ID);

    expect(outcome.decision).toBe("UNREADABLE");
    expect(prismaMock.campaigns.findFirst).not.toHaveBeenCalled();
    expect(dispatchCampaign).not.toHaveBeenCalled();
  });
});
