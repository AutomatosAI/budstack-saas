import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Email Phase 2 US-017 — the campaign CRUD handlers.
//
// Module-boundary mocks only (getCurrentUser, prisma, permission resolution).
// The real auth wrapper, the real permission gate and the REAL US-011 pipeline
// all execute, so the unsubscribe guarantee below is asserted against the
// shell, juice and the sanitizer rather than against a stub of them.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  campaigns: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    // Writes go through updateMany/deleteMany so the DRAFT|SCHEDULED predicate
    // is part of the statement rather than a separate read.
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  campaign_recipients: {
    groupBy: vi.fn(),
    // Present so US-018's "materialized at send time" rule can be asserted:
    // choosing an audience stores a RULE and writes no recipient rows.
    create: vi.fn(),
    createMany: vi.fn(),
  },
  tenants: { findFirst: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));

import {
  GET as listCampaigns,
  POST as createCampaign,
} from "@/app/api/tenant-admin/campaigns/route";
import {
  DELETE as deleteCampaign,
  GET as getCampaign,
  PUT as updateCampaign,
} from "@/app/api/tenant-admin/campaigns/[id]/route";
import { MISSING_UNSUBSCRIBE_MESSAGE } from "@/lib/email/campaign-content";
import { EMPTY_SUBJECT_MESSAGE } from "@/lib/email/campaign-fields";
import { CAMPAIGN_LOCKED_MESSAGE } from "@/lib/email/campaign-rules";
import { resolvePermissions } from "@/lib/permissions/resolve";

const TENANT_A = "tenant-a";
const CAMPAIGN_UUID = "22222222-2222-2222-2222-222222222222";
const params = { params: { id: CAMPAIGN_UUID } };

const TENANT_ROW = {
  id: TENANT_A,
  businessName: "Healing Buds",
  subdomain: "healingbuds",
  customDomain: "shop.example",
  settings: null,
  businessAddress1: "1 Sample Street",
  businessAddress2: null,
  businessCity: "Dublin",
  businessState: null,
  businessPostalCode: null,
  businessCountry: null,
  tenant_branding: { logoUrl: null, primaryColor: "#7c3aed" },
};

const DOC = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Hi {{userName}}" }] },
  ],
};

function request(method: string, path: string, body?: unknown) {
  return new NextRequest(`http://store.dev${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }),
  });
}

/** Data handed to the single create/update this test performed. */
function writtenData(fn: { mock: { calls: unknown[][] } }) {
  expect(fn.mock.calls).toHaveLength(1);
  return (fn.mock.calls[0][0] as { data: Record<string, unknown> }).data;
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
    // The REAL pure resolver, so the fixture cannot drift from production.
    permissions: resolvePermissions({ role: "TENANT_ADMIN", teamRole }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  signInAs("admin");
  prismaMock.tenants.findFirst.mockResolvedValue(TENANT_ROW);
  prismaMock.campaigns.create.mockImplementation(
    async (args: { data: Record<string, unknown> }) => ({
      id: CAMPAIGN_UUID,
      ...args.data,
    }),
  );
  prismaMock.campaigns.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.campaigns.deleteMany.mockResolvedValue({ count: 1 });
  prismaMock.campaigns.findFirst.mockResolvedValue({
    id: CAMPAIGN_UUID,
    status: "DRAFT",
  });
  prismaMock.campaigns.findMany.mockResolvedValue([]);
  prismaMock.campaign_recipients.groupBy.mockResolvedValue([]);
});

describe("POST /api/tenant-admin/campaigns", () => {
  it("creates a DRAFT whose HTML is derived from the document and carries the unsubscribe slot", async () => {
    const response = await createCampaign(
      request("POST", "/api/tenant-admin/campaigns", {
        name: "October newsletter",
        subject: "What's new",
        contentJson: DOC,
      }),
    );

    expect(response.status).toBe(200);
    const data = writtenData(prismaMock.campaigns.create);
    expect(data.tenantId).toBe(TENANT_A);
    expect(data.status).toBe("DRAFT");
    expect(data.contentJson).toEqual(DOC);
    expect(data.contentHtml).toContain("Hi {{userName}}");
    expect(data.contentHtml).toContain("Healing Buds");
    // The whole point of the marketing category: the shell's footer is in the
    // stored HTML, and the worker fills the slot per recipient at send time.
    expect(data.contentHtml).toContain("{{unsubscribeUrl}}");
  });

  it("never accepts a status from the caller", async () => {
    await createCampaign(
      request("POST", "/api/tenant-admin/campaigns", {
        name: "Sneaky",
        subject: "Hi",
        contentJson: DOC,
        status: "SENT",
      }),
    );

    // Strip-mode schema: the extra key is dropped, not honoured. Only US-021's
    // scheduling and US-019's fan-out move a campaign off DRAFT.
    expect(writtenData(prismaMock.campaigns.create).status).toBe("DRAFT");
  });

  it("refuses a campaign with no document — there is no raw-HTML mode", async () => {
    const response = await createCampaign(
      request("POST", "/api/tenant-admin/campaigns", {
        name: "Hand written",
        subject: "Hi",
        contentHtml: "<p>No shell, no unsubscribe link</p>",
      }),
    );

    expect(response.status).toBe(400);
    expect(prismaMock.campaigns.create).not.toHaveBeenCalled();
  });

  it("refuses a subject that is nothing but markup", async () => {
    const response = await createCampaign(
      request("POST", "/api/tenant-admin/campaigns", {
        name: "Untitled",
        subject: "<script>alert(1)</script>",
        contentJson: DOC,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ error: EMPTY_SUBJECT_MESSAGE }),
    );
    expect(prismaMock.campaigns.create).not.toHaveBeenCalled();
  });

  it("keeps the sanitizer's answer for a subject carrying markup around real text", async () => {
    await createCampaign(
      request("POST", "/api/tenant-admin/campaigns", {
        name: "Untitled",
        subject: "<b>Big</b> news",
        contentJson: DOC,
      }),
    );

    expect(writtenData(prismaMock.campaigns.create).subject).toBe("Big news");
  });

  it("403s an admin without canEditEmails, before any render", async () => {
    signInAs("editor"); // products/templates only — no email permissions

    const response = await createCampaign(
      request("POST", "/api/tenant-admin/campaigns", {
        name: "Nope",
        subject: "Nope",
        contentJson: DOC,
      }),
    );

    expect(response.status).toBe(403);
    expect(prismaMock.campaigns.create).not.toHaveBeenCalled();
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
  });
});

describe("GET /api/tenant-admin/campaigns", () => {
  const LISTED = {
    id: CAMPAIGN_UUID,
    name: "October newsletter",
    subject: "What's new",
    status: "SENT",
    scheduledAt: null,
    sentAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };

  it("scopes the list to the session tenant and folds in the recipient counts", async () => {
    prismaMock.campaigns.findMany.mockResolvedValue([LISTED]);
    prismaMock.campaign_recipients.groupBy.mockResolvedValue([
      { campaignId: CAMPAIGN_UUID, status: "SENT", _count: { _all: 12 } },
      { campaignId: CAMPAIGN_UUID, status: "FAILED", _count: { _all: 2 } },
    ]);

    const response = await listCampaigns(
      request("GET", "/api/tenant-admin/campaigns"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        ...LISTED,
        recipientCount: 14,
        sentCount: 12,
        // US-019 progress: the two outcomes that are not a delivery.
        failedCount: 2,
        suppressedCount: 0,
      },
    ]);
    expect(prismaMock.campaigns.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_A } }),
    );
    // campaign_recipients carries no tenantId, so the ONLY thing keeping this
    // count inside the tenant is that the ids came from the scoped query.
    expect(prismaMock.campaign_recipients.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { campaignId: { in: [CAMPAIGN_UUID] } },
      }),
    );
  });

  it("does not query recipients at all when the tenant has no campaigns", async () => {
    const response = await listCampaigns(
      request("GET", "/api/tenant-admin/campaigns"),
    );

    await expect(response.json()).resolves.toEqual([]);
    expect(prismaMock.campaign_recipients.groupBy).not.toHaveBeenCalled();
  });

  it("403s an admin without canViewEmails", async () => {
    signInAs("editor");

    const response = await listCampaigns(
      request("GET", "/api/tenant-admin/campaigns"),
    );

    expect(response.status).toBe(403);
    expect(prismaMock.campaigns.findMany).not.toHaveBeenCalled();
  });
});

describe("PUT /api/tenant-admin/campaigns/[id]", () => {
  it("re-renders the document through the pipeline on every save", async () => {
    const response = await updateCampaign(
      request("PUT", `/api/tenant-admin/campaigns/${CAMPAIGN_UUID}`, {
        contentJson: DOC,
      }),
      params,
    );

    expect(response.status).toBe(200);
    const data = writtenData(prismaMock.campaigns.updateMany);
    expect(data.contentJson).toEqual(DOC);
    expect(data.contentHtml).toContain("Hi {{userName}}");
    expect(data.contentHtml).toContain("{{unsubscribeUrl}}");
  });

  it("leaves both content columns alone for a rename", async () => {
    await updateCampaign(
      request("PUT", `/api/tenant-admin/campaigns/${CAMPAIGN_UUID}`, {
        name: "Renamed",
      }),
      params,
    );

    const data = writtenData(prismaMock.campaigns.updateMany);
    expect(data.name).toBe("Renamed");
    expect(data).not.toHaveProperty("contentHtml");
    expect(data).not.toHaveProperty("contentJson");
    // No render means no shell, so no tenant read either.
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
  });

  it("409s a campaign that is mid fan-out, without rendering anything", async () => {
    prismaMock.campaigns.findFirst.mockResolvedValue({ status: "SENDING" });

    const response = await updateCampaign(
      request("PUT", `/api/tenant-admin/campaigns/${CAMPAIGN_UUID}`, {
        contentJson: DOC,
      }),
      params,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: CAMPAIGN_LOCKED_MESSAGE,
    });
    expect(prismaMock.campaigns.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
  });

  it("409s a campaign that has already been sent", async () => {
    prismaMock.campaigns.findFirst.mockResolvedValue({ status: "SENT" });

    const response = await updateCampaign(
      request("PUT", `/api/tenant-admin/campaigns/${CAMPAIGN_UUID}`, {
        name: "Rewriting history",
      }),
      params,
    );

    expect(response.status).toBe(409);
    expect(prismaMock.campaigns.updateMany).not.toHaveBeenCalled();
  });

  it("404s another tenant's campaign", async () => {
    prismaMock.campaigns.findFirst.mockResolvedValue(null);

    const response = await updateCampaign(
      request("PUT", `/api/tenant-admin/campaigns/${CAMPAIGN_UUID}`, {
        contentJson: DOC,
      }),
      params,
    );

    expect(response.status).toBe(404);
    expect(prismaMock.campaigns.updateMany).not.toHaveBeenCalled();
  });

  it("400s a malformed id before it reaches a where clause", async () => {
    const response = await updateCampaign(
      request("PUT", "/api/tenant-admin/campaigns/not-a-uuid", {
        name: "Hi",
      }),
      { params: { id: "not-a-uuid" } },
    );

    expect(response.status).toBe(400);
    expect(prismaMock.campaigns.findFirst).not.toHaveBeenCalled();
  });

  it("carries the DRAFT|SCHEDULED predicate into the write, not just the read", async () => {
    await updateCampaign(
      request("PUT", `/api/tenant-admin/campaigns/${CAMPAIGN_UUID}`, {
        name: "Renamed",
      }),
      params,
    );

    // The read and the write are separate round trips with a render between
    // them. Postgres evaluates this predicate at the moment of the write, so a
    // campaign that flips to SENDING mid-request cannot be rewritten.
    expect(prismaMock.campaigns.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: CAMPAIGN_UUID,
          tenantId: TENANT_A,
          status: { in: ["DRAFT", "SCHEDULED"] },
        },
      }),
    );
  });

  it("409s when the campaign moves on between the check and the write", async () => {
    // What the race actually looks like from the handler: the status read said
    // DRAFT, the fan-out claimed the row, and the guarded write matched nothing.
    prismaMock.campaigns.updateMany.mockResolvedValue({ count: 0 });

    const response = await updateCampaign(
      request("PUT", `/api/tenant-admin/campaigns/${CAMPAIGN_UUID}`, {
        name: "Too late",
      }),
      params,
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: CAMPAIGN_LOCKED_MESSAGE,
    });
  });
});

describe("GET /api/tenant-admin/campaigns/[id]", () => {
  it("404s another tenant's campaign rather than leaking its existence", async () => {
    prismaMock.campaigns.findFirst.mockResolvedValue(null);

    const response = await getCampaign(
      request("GET", `/api/tenant-admin/campaigns/${CAMPAIGN_UUID}`),
      params,
    );

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/tenant-admin/campaigns/[id]", () => {
  it("deletes a draft", async () => {
    const response = await deleteCampaign(
      request("DELETE", `/api/tenant-admin/campaigns/${CAMPAIGN_UUID}`),
      params,
    );

    expect(response.status).toBe(200);
    expect(prismaMock.campaigns.deleteMany).toHaveBeenCalledWith({
      where: {
        id: CAMPAIGN_UUID,
        tenantId: TENANT_A,
        status: { in: ["DRAFT", "SCHEDULED"] },
      },
    });
  });

  it("409s when the campaign is claimed between the check and the delete", async () => {
    prismaMock.campaigns.deleteMany.mockResolvedValue({ count: 0 });

    const response = await deleteCampaign(
      request("DELETE", `/api/tenant-admin/campaigns/${CAMPAIGN_UUID}`),
      params,
    );

    expect(response.status).toBe(409);
  });

  it("refuses to delete a sent campaign — recipients cascade off it", async () => {
    prismaMock.campaigns.findFirst.mockResolvedValue({ status: "SENT" });

    const response = await deleteCampaign(
      request("DELETE", `/api/tenant-admin/campaigns/${CAMPAIGN_UUID}`),
      params,
    );

    expect(response.status).toBe(409);
    expect(prismaMock.campaigns.deleteMany).not.toHaveBeenCalled();
  });
});

describe("the audience rule (US-018)", () => {
  it("stores the rule a create was given, and writes no recipients for it", async () => {
    await createCampaign(
      request("POST", "/api/tenant-admin/campaigns", {
        name: "October newsletter",
        subject: "What's new",
        contentJson: DOC,
        audience: { type: "both" },
      }),
    );

    const data = writtenData(prismaMock.campaigns.create);
    expect(data.audience).toEqual({ type: "both" });
    // The addresses are resolved from this rule at send time (US-019). A draft
    // that materialized its own recipients would mail whoever happened to be
    // consented on the day it was written.
    expect(prismaMock.campaign_recipients.create).not.toHaveBeenCalled();
    expect(prismaMock.campaign_recipients.createMany).not.toHaveBeenCalled();
  });

  it("leaves the column NULL when no audience is chosen", async () => {
    await createCampaign(
      request("POST", "/api/tenant-admin/campaigns", {
        name: "Not addressed yet",
        subject: "Draft",
        contentJson: DOC,
      }),
    );

    // NULL reads as "not chosen yet" everywhere — never as "everybody".
    expect(writtenData(prismaMock.campaigns.create)).not.toHaveProperty(
      "audience",
    );
  });

  it("changes the audience on its own, without re-rendering the document", async () => {
    await updateCampaign(
      request("PUT", `/api/tenant-admin/campaigns/${CAMPAIGN_UUID}`, {
        audience: { type: "customers" },
      }),
      params,
    );

    const data = writtenData(prismaMock.campaigns.updateMany);
    expect(data.audience).toEqual({ type: "customers" });
    expect(data).not.toHaveProperty("contentHtml");
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
  });

  it("does not re-assert an audience when only the document is saved", async () => {
    await updateCampaign(
      request("PUT", `/api/tenant-admin/campaigns/${CAMPAIGN_UUID}`, {
        contentJson: DOC,
      }),
      params,
    );

    expect(writtenData(prismaMock.campaigns.updateMany)).not.toHaveProperty(
      "audience",
    );
  });

  it("400s an audience type the platform does not know", async () => {
    const response = await createCampaign(
      request("POST", "/api/tenant-admin/campaigns", {
        name: "Everyone",
        subject: "Hi",
        contentJson: DOC,
        audience: { type: "everyone" },
      }),
    );

    expect(response.status).toBe(400);
    expect(prismaMock.campaigns.create).not.toHaveBeenCalled();
  });

  it("403s an admin without canEditEmails changing who a campaign reaches", async () => {
    signInAs("editor");

    const response = await updateCampaign(
      request("PUT", `/api/tenant-admin/campaigns/${CAMPAIGN_UUID}`, {
        audience: { type: "both" },
      }),
      params,
    );

    expect(response.status).toBe(403);
    expect(prismaMock.campaigns.updateMany).not.toHaveBeenCalled();
  });
});

describe("the unsubscribe guarantee", () => {
  it("is enforced by the save, not merely provided by the shell", async () => {
    // Proves the check is load-bearing rather than decorative: the pipeline is
    // left alone and only the shell's answer is emptied, which is exactly what
    // a dropped footer looks like from the handler's side.
    const shell = await import("@/lib/email/email-shell");
    const renderEmailBody = vi
      .spyOn(shell, "renderEmailBody")
      .mockResolvedValue("<html><body><p>Buy things</p></body></html>");

    try {
      const response = await createCampaign(
        request("POST", "/api/tenant-admin/campaigns", {
          name: "Footerless",
          subject: "Hi",
          contentJson: DOC,
        }),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: MISSING_UNSUBSCRIBE_MESSAGE,
      });
      expect(prismaMock.campaigns.create).not.toHaveBeenCalled();
    } finally {
      renderEmailBody.mockRestore();
    }
  });
});
