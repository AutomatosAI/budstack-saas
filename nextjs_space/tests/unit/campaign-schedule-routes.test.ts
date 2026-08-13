import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Email Phase 2 US-021 — the schedule endpoint, and what a cancel does to the
// trigger a scheduled campaign is waiting on.
//
// Module-boundary mocks only (getCurrentUser, prisma, rate limit, the queue).
// The real auth wrapper and the REAL permission resolver execute, so the gate
// below is asserted against production's own matrix.

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const { add, remove } = vi.hoisted(() => ({ add: vi.fn(), remove: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  campaigns: { findFirst: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit }));
vi.mock("@/lib/queue", () => ({ getCampaignQueue: () => ({ add, remove }) }));

import { POST as scheduleCampaign } from "@/app/api/tenant-admin/campaigns/[id]/schedule/route";
import { POST as cancelCampaign } from "@/app/api/tenant-admin/campaigns/[id]/cancel/route";
import { CAMPAIGN_LOCKED_MESSAGE } from "@/lib/email/campaign-rules";
import {
  CAMPAIGN_SCHEDULE_MAX_HORIZON_MS,
  CAMPAIGN_SCHEDULE_TOO_FAR_MESSAGE,
  CAMPAIGN_SCHEDULE_TOO_SOON_MESSAGE,
  campaignScheduleRateLimitKey,
} from "@/lib/email/campaign-schedule";
import {
  CAMPAIGN_NO_AUDIENCE_MESSAGE,
  CAMPAIGN_SEND_RATE_LIMIT,
} from "@/lib/email/campaign-send";
import { resolvePermissions } from "@/lib/permissions/resolve";

const TENANT_A = "tenant-a";
const CAMPAIGN_UUID = "33333333-3333-3333-3333-333333333333";
const params = { params: { id: CAMPAIGN_UUID } };

const DRAFT = {
  status: "DRAFT" as const,
  audience: { type: "subscribers" },
  scheduledJobId: null,
};

const HOUR_MS = 60 * 60 * 1000;
const inHours = (hours: number) => new Date(Date.now() + hours * HOUR_MS);

function signInAs(teamRole: string | null) {
  getCurrentUser.mockResolvedValue({
    id: "admin_1",
    email: "admin@store.dev",
    name: "Admin",
    image: "",
    role: "TENANT_ADMIN",
    tenantId: TENANT_A,
    clerkOrgId: null,
  });
  resolveUserPermissions.mockResolvedValue({
    teamRole,
    permissions: resolvePermissions({ role: "TENANT_ADMIN", teamRole }),
  });
}

const schedule = (at: Date | string) =>
  scheduleCampaign(
    new NextRequest(`http://store.dev/x/${CAMPAIGN_UUID}/schedule`, {
      method: "POST",
      body: JSON.stringify({
        scheduledAt: at instanceof Date ? at.toISOString() : at,
      }),
    }),
    params,
  );

const cancel = () =>
  cancelCampaign(
    new NextRequest(`http://store.dev/x/${CAMPAIGN_UUID}/cancel`, {
      method: "POST",
    }),
    params,
  );

beforeEach(() => {
  vi.clearAllMocks();
  signInAs("admin");
  checkRateLimit.mockResolvedValue({ success: true });
  prismaMock.campaigns.findFirst.mockResolvedValue(DRAFT);
  prismaMock.campaigns.updateMany.mockResolvedValue({ count: 1 });
});

describe("POST /api/tenant-admin/campaigns/[id]/schedule", () => {
  it("arms a delayed trigger and points the campaign at it", async () => {
    const at = inHours(3);

    const response = await schedule(at);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "SCHEDULED",
      scheduledAt: at.toISOString(),
    });

    const [jobName, data, opts] = add.mock.calls[0];
    expect(jobName).toBe("campaign-scheduled-send");
    expect(data).toEqual({ campaignId: CAMPAIGN_UUID, tenantId: TENANT_A });
    // Delayed by the distance to the send time, give or take the request.
    expect(opts.delay).toBeGreaterThan(3 * HOUR_MS - 5000);
    expect(opts.delay).toBeLessThanOrEqual(3 * HOUR_MS);

    const write = prismaMock.campaigns.updateMany.mock.calls.at(-1)?.[0];
    expect(write.data).toEqual({
      status: "SCHEDULED",
      scheduledAt: at,
      scheduledJobId: opts.jobId,
    });
    // The status predicate is IN the write: a send or a cancel can land
    // between the check above and this update.
    expect(write.where).toEqual({
      id: CAMPAIGN_UUID,
      tenantId: TENANT_A,
      status: { in: ["DRAFT", "SCHEDULED"] },
    });
  });

  it("replaces the previous trigger when rescheduling", async () => {
    prismaMock.campaigns.findFirst.mockResolvedValue({
      status: "SCHEDULED",
      audience: { type: "subscribers" },
      scheduledJobId: "old-job",
    });

    await schedule(inHours(5));

    expect(remove).toHaveBeenCalledWith("old-job");
    // One armed trigger at a time — the new job id is not the removed one.
    expect(add.mock.calls[0][2].jobId).not.toBe("old-job");
  });

  it("drops the job it just armed when the campaign moves on mid-request", async () => {
    prismaMock.campaigns.updateMany.mockResolvedValue({ count: 0 });

    const response = await schedule(inHours(2));

    expect(response.status).toBe(409);
    // No orphan: a campaign that never adopted this trigger must not leave it
    // sitting in the queue waiting to fire.
    expect(remove).toHaveBeenCalledWith(add.mock.calls[0][2].jobId);
  });

  it("refuses a time in the past", async () => {
    const response = await schedule(inHours(-1));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ error: CAMPAIGN_SCHEDULE_TOO_SOON_MESSAGE }),
    );
    expect(add).not.toHaveBeenCalled();
  });

  it("refuses a time past the horizon the queue can hold", async () => {
    const response = await schedule(
      new Date(Date.now() + CAMPAIGN_SCHEDULE_MAX_HORIZON_MS + HOUR_MS),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ error: CAMPAIGN_SCHEDULE_TOO_FAR_MESSAGE }),
    );
    expect(add).not.toHaveBeenCalled();
  });

  it("refuses a campaign with no audience, while somebody is watching", async () => {
    prismaMock.campaigns.findFirst.mockResolvedValue({
      ...DRAFT,
      audience: null,
    });

    const response = await schedule(inHours(2));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ error: CAMPAIGN_NO_AUDIENCE_MESSAGE }),
    );
    expect(add).not.toHaveBeenCalled();
  });

  it.each(["SENDING", "SENT", "CANCELLED"])(
    "refuses to schedule a campaign that is %s",
    async (status) => {
      prismaMock.campaigns.findFirst.mockResolvedValue({ ...DRAFT, status });

      const response = await schedule(inHours(2));

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({ error: CAMPAIGN_LOCKED_MESSAGE }),
      );
      expect(add).not.toHaveBeenCalled();
    },
  );

  it("404s another tenant's campaign", async () => {
    prismaMock.campaigns.findFirst.mockResolvedValue(null);

    const response = await schedule(inHours(2));

    expect(response.status).toBe(404);
    expect(prismaMock.campaigns.findFirst.mock.calls[0][0].where).toEqual({
      id: CAMPAIGN_UUID,
      tenantId: TENANT_A,
    });
  });

  it("rejects a body that is not a real instant", async () => {
    const response = await schedule("next tuesday");

    expect(response.status).toBe(400);
    expect(add).not.toHaveBeenCalled();
  });

  it("meters scheduling on its own counter and fails closed", async () => {
    checkRateLimit.mockResolvedValue({
      success: false,
      response: NextResponse.json({ error: "Too many requests" }, { status: 429 }),
    });

    const response = await schedule(inHours(2));

    expect(response.status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith(
      campaignScheduleRateLimitKey("admin_1"),
      CAMPAIGN_SEND_RATE_LIMIT,
    );
    expect(add).not.toHaveBeenCalled();
  });

  it("refuses a team role without canEditEmails", async () => {
    signInAs("customer_support");

    const response = await schedule(inHours(2));

    expect(response.status).toBe(403);
    expect(add).not.toHaveBeenCalled();
  });
});

describe("POST /api/tenant-admin/campaigns/[id]/cancel", () => {
  it("disarms the trigger a scheduled campaign was waiting on", async () => {
    prismaMock.campaigns.findFirst.mockResolvedValue({
      scheduledJobId: "armed-job",
    });

    const response = await cancel();

    expect(response.status).toBe(200);
    expect(remove).toHaveBeenCalledWith("armed-job");
    const clear = prismaMock.campaigns.updateMany.mock.calls.at(-1)?.[0];
    expect(clear.data).toEqual({ scheduledJobId: null });
  });

  it("touches the queue at all only when there was a trigger", async () => {
    prismaMock.campaigns.findFirst.mockResolvedValue({ scheduledJobId: null });

    await cancel();

    expect(remove).not.toHaveBeenCalled();
  });
});
