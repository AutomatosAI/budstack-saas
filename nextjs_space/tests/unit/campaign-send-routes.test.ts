import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Email Phase 2 US-019 — the send and cancel endpoints.
//
// Module-boundary mocks only (getCurrentUser, prisma, rate limit, the fan-out
// itself). The real auth wrapper and the REAL permission resolver execute, so
// the gate below is asserted against production's own matrix.

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const { fanOutCampaign } = vi.hoisted(() => ({ fanOutCampaign: vi.fn() }));
const { resolveCampaignAudience } = vi.hoisted(() => ({
  resolveCampaignAudience: vi.fn(),
}));

const prismaMock = vi.hoisted(() => ({
  campaigns: { findFirst: vi.fn(), updateMany: vi.fn() },
  tenants: { findFirst: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit }));
vi.mock("@/lib/email/campaign-fan-out", () => ({ fanOutCampaign }));
vi.mock("@/lib/email/campaign-audience-query", () => ({
  resolveCampaignAudience,
}));

import { POST as sendCampaign } from "@/app/api/tenant-admin/campaigns/[id]/send/route";
import { POST as cancelCampaign } from "@/app/api/tenant-admin/campaigns/[id]/cancel/route";
import {
  CAMPAIGN_EMPTY_AUDIENCE_MESSAGE,
  CAMPAIGN_MAX_RECIPIENTS,
  CAMPAIGN_NO_AUDIENCE_MESSAGE,
  CAMPAIGN_NOT_CANCELLABLE_MESSAGE,
  CAMPAIGN_NOT_SENDABLE_MESSAGE,
  CAMPAIGN_SEND_RATE_LIMIT,
  campaignSendRateLimitKey,
} from "@/lib/email/campaign-send";
import { resolvePermissions } from "@/lib/permissions/resolve";

const TENANT_A = "tenant-a";
const CAMPAIGN_UUID = "33333333-3333-3333-3333-333333333333";
const params = { params: { id: CAMPAIGN_UUID } };

const TENANT_ROW = {
  businessName: "Healing Buds",
  subdomain: "healingbuds",
  customDomain: null,
};

const DRAFT = {
  id: CAMPAIGN_UUID,
  status: "DRAFT" as const,
  subject: "October news",
  audience: { type: "subscribers" },
};

function request(path: string) {
  return new NextRequest(`http://store.dev${path}`, { method: "POST" });
}

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

const send = () => sendCampaign(request(`/x/${CAMPAIGN_UUID}/send`), params);
const cancel = () => cancelCampaign(request(`/x/${CAMPAIGN_UUID}/cancel`), params);

beforeEach(() => {
  vi.clearAllMocks();
  signInAs("admin");
  checkRateLimit.mockResolvedValue({ success: true });
  prismaMock.campaigns.findFirst.mockResolvedValue(DRAFT);
  prismaMock.campaigns.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.tenants.findFirst.mockResolvedValue(TENANT_ROW);
  resolveCampaignAudience.mockResolvedValue({
    recipients: [
      { email: "jane@example.com", userId: null, name: null },
      { email: "sam@example.com", userId: "user-2", name: "Sam" },
    ],
    suppressedCount: 1,
  });
  fanOutCampaign.mockResolvedValue({ queued: 2, ratePerMinute: 60 });
});

describe("POST /api/tenant-admin/campaigns/[id]/send", () => {
  it("claims the campaign as SENDING before anything is enqueued", async () => {
    const response = await send();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ status: "SENDING", queued: 2, suppressed: 1 }),
    );

    const write = prismaMock.campaigns.updateMany.mock.calls[0][0];
    expect(write.data.status).toBe("SENDING");
    // The status predicate is IN the write: two clicks race here, and the loser
    // must enqueue nothing at all.
    expect(write.where).toEqual({
      id: CAMPAIGN_UUID,
      tenantId: TENANT_A,
      status: { in: ["DRAFT", "SCHEDULED"] },
    });

    expect(fanOutCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        campaign: { id: CAMPAIGN_UUID, tenantId: TENANT_A, subject: "October news" },
        tenant: TENANT_ROW,
      }),
    );
  });

  it("resolves the audience at SEND time, never from the draft", async () => {
    await send();
    // The rule, resolved now — so anyone who unsubscribed since the draft was
    // written is already gone from this send.
    expect(resolveCampaignAudience).toHaveBeenCalledWith(
      { type: "subscribers" },
      TENANT_A,
    );
  });

  it("refuses a campaign with no audience chosen", async () => {
    prismaMock.campaigns.findFirst.mockResolvedValue({ ...DRAFT, audience: null });

    const response = await send();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ error: CAMPAIGN_NO_AUDIENCE_MESSAGE }),
    );
    expect(prismaMock.campaigns.updateMany).not.toHaveBeenCalled();
    expect(fanOutCampaign).not.toHaveBeenCalled();
  });

  it("refuses an audience that resolves to nobody", async () => {
    resolveCampaignAudience.mockResolvedValue({
      recipients: [],
      suppressedCount: 4,
    });

    const response = await send();

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ error: CAMPAIGN_EMPTY_AUDIENCE_MESSAGE }),
    );
    expect(prismaMock.campaigns.updateMany).not.toHaveBeenCalled();
  });

  it("refuses an audience larger than one fan-out may take", async () => {
    resolveCampaignAudience.mockResolvedValue({
      recipients: Array.from({ length: CAMPAIGN_MAX_RECIPIENTS + 1 }, (_, i) => ({
        email: `person${i}@example.com`,
        userId: null,
        name: null,
      })),
      suppressedCount: 0,
    });

    const response = await send();

    expect(response.status).toBe(400);
    expect(fanOutCampaign).not.toHaveBeenCalled();
  });

  it.each(["SENDING", "SENT", "CANCELLED"])(
    "refuses to send a campaign that is already %s",
    async (status) => {
      prismaMock.campaigns.findFirst.mockResolvedValue({ ...DRAFT, status });

      const response = await send();

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({ error: CAMPAIGN_NOT_SENDABLE_MESSAGE }),
      );
      expect(fanOutCampaign).not.toHaveBeenCalled();
    },
  );

  it("enqueues nothing when the claim loses the race", async () => {
    prismaMock.campaigns.updateMany.mockResolvedValue({ count: 0 });

    const response = await send();

    expect(response.status).toBe(409);
    expect(fanOutCampaign).not.toHaveBeenCalled();
  });

  it("404s another tenant's campaign", async () => {
    prismaMock.campaigns.findFirst.mockResolvedValue(null);

    const response = await send();

    expect(response.status).toBe(404);
    expect(prismaMock.campaigns.findFirst.mock.calls[0][0].where).toEqual({
      id: CAMPAIGN_UUID,
      tenantId: TENANT_A,
    });
  });

  it("meters sends per admin and fails closed", async () => {
    checkRateLimit.mockResolvedValue({
      success: false,
      response: NextResponse.json({ error: "Too many requests" }, { status: 429 }),
    });

    const response = await send();

    expect(response.status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith(
      campaignSendRateLimitKey("admin_1"),
      CAMPAIGN_SEND_RATE_LIMIT,
    );
    expect(CAMPAIGN_SEND_RATE_LIMIT.failMode).toBe("closed");
    expect(fanOutCampaign).not.toHaveBeenCalled();
  });

  it("refuses a team role without canEditEmails", async () => {
    signInAs("customer_support");

    const response = await send();

    expect(response.status).toBe(403);
    expect(fanOutCampaign).not.toHaveBeenCalled();
  });
});

describe("POST /api/tenant-admin/campaigns/[id]/cancel", () => {
  it("cancels a campaign that is still sending", async () => {
    const response = await cancel();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "CANCELLED" });

    const write = prismaMock.campaigns.updateMany.mock.calls[0][0];
    expect(write.data).toEqual({ status: "CANCELLED" });
    expect(write.where).toEqual({
      id: CAMPAIGN_UUID,
      tenantId: TENANT_A,
      status: { in: ["SCHEDULED", "SENDING"] },
    });
  });

  it("409s a campaign that was never in a cancellable state", async () => {
    prismaMock.campaigns.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.campaigns.findFirst.mockResolvedValue({ id: CAMPAIGN_UUID });

    const response = await cancel();

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ error: CAMPAIGN_NOT_CANCELLABLE_MESSAGE }),
    );
  });

  it("404s a campaign this tenant does not have", async () => {
    prismaMock.campaigns.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.campaigns.findFirst.mockResolvedValue(null);

    const response = await cancel();

    expect(response.status).toBe(404);
  });

  it("refuses a team role without canEditEmails", async () => {
    signInAs("customer_support");

    const response = await cancel();

    expect(response.status).toBe(403);
    expect(prismaMock.campaigns.updateMany).not.toHaveBeenCalled();
  });
});
