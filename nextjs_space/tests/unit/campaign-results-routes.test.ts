import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Email Phase 2 US-026 — the results endpoint and the recipient CSV export.
//
// Module-boundary mocks only (getCurrentUser, prisma, the rate limiter). The
// real auth wrapper and the REAL permission resolver execute, so the two gates
// below are asserted against production's own matrix rather than against a stub
// of it.

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  campaigns: { findFirst: vi.fn() },
  campaign_recipients: { groupBy: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  email_logs: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit }));

import { GET as getResults } from "@/app/api/tenant-admin/campaigns/[id]/results/route";
import { GET as exportRecipients } from "@/app/api/tenant-admin/campaigns/[id]/recipients/export/route";
import { CAMPAIGN_EXPORT_RATE_LIMIT } from "@/lib/email/campaign-export";
import { CAMPAIGN_FAILURE_LABELS } from "@/lib/email/campaign-results";
import { SUPPRESSED_LOG_MESSAGE } from "@/lib/email/suppression";
import { resolvePermissions } from "@/lib/permissions/resolve";
import { buildPermissionSet } from "@/lib/permissions/permission-keys";
import {
  getTenantContext,
  hasTenantContext,
} from "@/lib/tenant/tenant-context";

const TENANT_A = "tenant-a";
const CAMPAIGN_UUID = "44444444-4444-4444-4444-444444444444";
const params = { params: { id: CAMPAIGN_UUID } };

const SMTP_REJECTION = "550 5.1.1 <nobody@example.com>: user unknown";

const CAMPAIGN = {
  id: CAMPAIGN_UUID,
  name: "October news",
  subject: "What's new in October",
  status: "SENT" as const,
  sentAt: new Date("2026-08-13T09:00:00.000Z"),
};

function request(path: string) {
  return new NextRequest(`http://store.dev${path}`);
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

/** A role that exists only in this test: export rights, no email rights. */
function signInWithExportOnly() {
  getCurrentUser.mockResolvedValue({
    id: "agent_1",
    email: "agent@store.dev",
    name: "Agent",
    image: "",
    role: "TENANT_ADMIN",
    tenantId: TENANT_A,
    clerkOrgId: null,
  });
  resolveUserPermissions.mockResolvedValue({
    teamRole: "customer_support",
    permissions: buildPermissionSet(["canExportCustomers", "canViewCustomers"]),
  });
}

const results = () =>
  getResults(request(`/x/${CAMPAIGN_UUID}/results`), params);

const exportCsv = () =>
  exportRecipients(request(`/x/${CAMPAIGN_UUID}/recipients/export`), params);

/** The bytes the client would save — `text()` would strip the BOM. */
async function csvBody(response: Response): Promise<string> {
  const buffer = await response.arrayBuffer();
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(buffer);
}

beforeEach(() => {
  vi.clearAllMocks();
  signInAs("admin");
  checkRateLimit.mockResolvedValue({ success: true });
  prismaMock.campaigns.findFirst.mockResolvedValue(CAMPAIGN);
  prismaMock.campaign_recipients.groupBy.mockResolvedValue([
    { status: "SENT", _count: { _all: 8 } },
    { status: "FAILED", _count: { _all: 2 } },
    { status: "SUPPRESSED", _count: { _all: 1 } },
    { status: "QUEUED", _count: { _all: 3 } },
  ]);
  // count() is used for two different questions. Answered by the WHERE rather
  // than by call order, so a reordering of the Promise.all cannot silently swap
  // "who unsubscribed" for "who failed".
  prismaMock.campaign_recipients.count.mockImplementation(
    async ({ where }: { where: Record<string, unknown> }) =>
      where.unsubscribedAt ? 4 : 2,
  );
  prismaMock.campaign_recipients.findMany.mockResolvedValue([
    { emailLogId: "log-1" },
    { emailLogId: "log-2" },
  ]);
  prismaMock.email_logs.findMany.mockResolvedValue([
    { id: "log-1", errorMessage: SMTP_REJECTION, smtpResponse: null },
    { id: "log-2", errorMessage: SUPPRESSED_LOG_MESSAGE, smtpResponse: null },
  ]);
});

describe("GET /api/tenant-admin/campaigns/[id]/results", () => {
  it("counts the recipient rows and attributes the opt-outs", async () => {
    const response = await results();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.counts).toEqual({
      total: 14,
      sent: 8,
      failed: 2,
      suppressed: 1,
      pending: 3,
    });
    // Attributed by the per-recipient token, which is the only thing that knows
    // WHICH email an unsubscribe came from.
    expect(body.unsubscribed).toBe(4);
    expect(prismaMock.campaign_recipients.count).toHaveBeenCalledWith({
      where: { campaignId: CAMPAIGN_UUID, unsubscribedAt: { not: null } },
    });
  });

  it("reads failure reasons through the US-008 log linkage", async () => {
    const body = await (await results()).json();

    expect(prismaMock.campaign_recipients.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { campaignId: CAMPAIGN_UUID, status: "FAILED" },
        select: { emailLogId: true },
      }),
    );
    // tenantId is re-asserted on the log read: email_logs IS tenant-scoped, and
    // a linkage column is a weaker guarantee than the filter.
    expect(prismaMock.email_logs.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ["log-1", "log-2"] }, tenantId: TENANT_A },
      }),
    );

    expect(body.failures).toEqual([
      {
        code: "smtp",
        label: CAMPAIGN_FAILURE_LABELS.smtp,
        count: 1,
        example: SMTP_REJECTION,
      },
      {
        code: "suppressed",
        label: CAMPAIGN_FAILURE_LABELS.suppressed,
        count: 1,
        example: SUPPRESSED_LOG_MESSAGE,
      },
    ]);
  });

  it("keeps a failure whose log row was never linked, as unknown", async () => {
    prismaMock.campaign_recipients.findMany.mockResolvedValue([
      { emailLogId: "log-1" },
      { emailLogId: null },
    ]);
    prismaMock.email_logs.findMany.mockResolvedValue([
      { id: "log-1", errorMessage: SMTP_REJECTION, smtpResponse: null },
    ]);

    const body = await (await results()).json();
    // Dropping it would make the reasons disagree with the failed count shown
    // right beside them.
    expect(body.failures.map((row: { code: string }) => row.code).sort()).toEqual(
      ["smtp", "unknown"],
    );
    expect(body.failuresSampled).toBe(2);
  });

  it("reports the sample size beside the total", async () => {
    const body = await (await results()).json();
    expect(body.failuresSampled).toBe(2);
    expect(body.failuresTotal).toBe(2);
  });

  it("scopes the campaign read to the tenant and 404s otherwise", async () => {
    prismaMock.campaigns.findFirst.mockResolvedValue(null);

    const response = await results();
    expect(response.status).toBe(404);
    expect(prismaMock.campaigns.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CAMPAIGN_UUID, tenantId: TENANT_A },
      }),
    );
    // Nothing is counted for a campaign this tenant does not own.
    expect(prismaMock.campaign_recipients.groupBy).not.toHaveBeenCalled();
  });

  it("rejects a malformed id before it reaches a where clause", async () => {
    const response = await getResults(request("/x/nope/results"), {
      params: { id: "nope" },
    });
    expect(response.status).toBe(400);
    expect(prismaMock.campaigns.findFirst).not.toHaveBeenCalled();
  });

  it("is closed to a team role without canViewEmails (US-009)", async () => {
    signInAs("customer_support");

    const response = await results();
    expect(response.status).toBe(403);
    expect(prismaMock.campaigns.findFirst).not.toHaveBeenCalled();
  });
});

describe("GET /api/tenant-admin/campaigns/[id]/recipients/export", () => {
  beforeEach(() => {
    prismaMock.campaign_recipients.findMany.mockResolvedValue([
      {
        id: "rec-1",
        email: "jane@example.com",
        status: "SENT",
        createdAt: new Date("2026-08-13T09:00:00.000Z"),
        unsubscribedAt: null,
        error: null,
        emailLogId: "log-1",
      },
      {
        id: "rec-2",
        email: "sam@example.com",
        status: "FAILED",
        createdAt: new Date("2026-08-13T09:00:00.000Z"),
        unsubscribedAt: new Date("2026-08-14T10:00:00.000Z"),
        error: SMTP_REJECTION,
        emailLogId: null,
      },
    ]);
    prismaMock.email_logs.findMany.mockResolvedValue([
      {
        id: "log-1",
        sentAt: new Date("2026-08-13T09:01:00.000Z"),
        errorMessage: null,
        smtpResponse: "250 OK",
      },
    ]);
  });

  it("streams a CSV of every recipient with its outcome", async () => {
    const response = await exportCsv();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/csv; charset=utf-8",
    );
    expect(response.headers.get("Content-Disposition")).toContain(
      `campaign-${CAMPAIGN_UUID}-recipients-`,
    );
    // Customer addresses, generated per request.
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const csv = await csvBody(response);
    const lines = csv.split("\n").filter(Boolean);

    expect(lines[0]).toBe(
      '﻿"email","status","added_at","delivered_at","unsubscribed_at","failure_reason","failure_detail"',
    );
    expect(lines[1]).toBe(
      '"jane@example.com","SENT","2026-08-13T09:00:00.000Z","2026-08-13T09:01:00.000Z","","",""',
    );
    expect(lines[2]).toBe(
      `"sam@example.com","FAILED","2026-08-13T09:00:00.000Z","","2026-08-14T10:00:00.000Z","${CAMPAIGN_FAILURE_LABELS.smtp}","${SMTP_REJECTION}"`,
    );
  });

  it("pages by keyset, never by offset", async () => {
    await csvBody(await exportCsv());

    const query = prismaMock.campaign_recipients.findMany.mock.calls[0][0];
    expect(query.orderBy).toEqual({ id: "asc" });
    expect(query.skip).toBeUndefined();
    expect(query.where).toEqual({ campaignId: CAMPAIGN_UUID });
    expect(query.take).toBeGreaterThan(0);
  });

  it("reads each page with the tenant context still bound", async () => {
    const bindings: Array<{ bound: boolean; tenantId: string | null }> = [];
    prismaMock.email_logs.findMany.mockImplementation(async () => {
      // email_logs is a tenant-scoped model. This callback runs from the
      // response writer's async context, LONG after withTenantAuth's ALS store
      // was torn down — an unbound read here warns today and throws under
      // TENANT_CONTEXT_STRICT, mid-download.
      bindings.push({
        bound: hasTenantContext(),
        tenantId: getTenantContext(),
      });
      return [];
    });

    const response = await exportCsv();
    // Deliberately drained OUTSIDE the handler, which is exactly how Next
    // serialises the response.
    await csvBody(response);

    expect(bindings).toEqual([{ bound: true, tenantId: TENANT_A }]);
  });

  it("meters the export per admin", async () => {
    await exportCsv();
    expect(checkRateLimit).toHaveBeenCalledWith(
      "campaign-export:admin_1",
      CAMPAIGN_EXPORT_RATE_LIMIT,
    );
  });

  it("answers the limiter's refusal instead of streaming", async () => {
    checkRateLimit.mockResolvedValue({
      success: false,
      response: new Response(null, { status: 429 }),
    });

    const response = await exportCsv();
    expect(response.status).toBe(429);
    expect(prismaMock.campaigns.findFirst).not.toHaveBeenCalled();
  });

  it("checks ownership BEFORE any byte is streamed", async () => {
    prismaMock.campaigns.findFirst.mockResolvedValue(null);

    const response = await exportCsv();
    // Once a 200 and a chunk are on the wire, a 404 is no longer available.
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).not.toContain("text/csv");
    expect(prismaMock.campaign_recipients.findMany).not.toHaveBeenCalled();
  });

  it("is closed to a role without canExportCustomers", async () => {
    signInAs("editor");

    const response = await exportCsv();
    expect(response.status).toBe(403);
    expect(prismaMock.campaign_recipients.findMany).not.toHaveBeenCalled();
  });

  it("is closed to canExportCustomers alone, without canViewEmails", async () => {
    signInWithExportOnly();

    // Exporting the customers you can already see is not a way into the email
    // surface US-009 closed — and this list includes newsletter subscribers who
    // are not customers at all.
    const response = await exportCsv();
    expect(response.status).toBe(403);
    expect(prismaMock.campaign_recipients.findMany).not.toHaveBeenCalled();
  });
});
