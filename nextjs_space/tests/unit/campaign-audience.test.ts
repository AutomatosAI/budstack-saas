import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Email Phase 2 US-018 — the audience rule, its resolution, and the live count.
//
// Module-boundary mocks only (getCurrentUser, prisma, permission resolution,
// rate limit). The real auth wrapper, the real permission gate, the real
// dedupe/suppression folds and the real suppression store all execute.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
  campaigns: { findFirst: vi.fn() },
  newsletter_subscribers: { findMany: vi.fn() },
  users: { findMany: vi.fn() },
  email_suppressions: { findMany: vi.fn() },
  // Present so the "materialized at send time, not draft time" assertions can
  // prove nothing on this path writes a recipient row.
  campaign_recipients: { create: vi.fn(), createMany: vi.fn(), findMany: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit }));

import { GET as audienceCount } from "@/app/api/tenant-admin/campaigns/[id]/audience-count/route";
import {
  CAMPAIGN_AUDIENCE_OPTIONS,
  CAMPAIGN_AUDIENCE_TYPES,
  audienceIncludes,
  dedupeAudienceRecipients,
  excludeSuppressedRecipients,
  parseCampaignAudience,
} from "@/lib/email/campaign-audience";
import {
  campaignAudienceBodySchema,
  resolveCampaignAudience,
} from "@/lib/email/campaign-audience-query";
import { resolvePermissions } from "@/lib/permissions/resolve";

const TENANT_A = "tenant-a";
const CAMPAIGN_UUID = "33333333-3333-3333-3333-333333333333";
const params = { params: { id: CAMPAIGN_UUID } };

function request(path: string) {
  return new NextRequest(`http://store.dev${path}`, { method: "GET" });
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
  checkRateLimit.mockResolvedValue({ success: true });
  prismaMock.campaigns.findFirst.mockResolvedValue({
    audience: { type: "both" },
  });
  prismaMock.newsletter_subscribers.findMany.mockResolvedValue([]);
  prismaMock.users.findMany.mockResolvedValue([]);
  prismaMock.email_suppressions.findMany.mockResolvedValue([]);
});

describe("parseCampaignAudience", () => {
  it("accepts every flat audience type on its own", () => {
    for (const type of ["subscribers", "customers", "both"] as const) {
      expect(parseCampaignAudience({ type })).toEqual({ type });
    }
  });

  it("accepts a segment audience that names its segment (US-025)", () => {
    expect(
      parseCampaignAudience({ type: "segment", segmentId: "seg_1" }),
    ).toEqual({ type: "segment", segmentId: "seg_1" });
  });

  it.each([
    ["no segmentId", { type: "segment" }],
    ["an empty segmentId", { type: "segment", segmentId: "" }],
    ["a non-string segmentId", { type: "segment", segmentId: 7 }],
  ])("reads a segment audience with %s as no audience", (_label, value) => {
    // Half a rule is not a rule. Answering `{ type: "segment" }` here would
    // hand the resolver an audience with nothing to resolve.
    expect(parseCampaignAudience(value)).toBeNull();
  });

  it("rebuilds the object, so unknown keys cannot ride along", () => {
    // A rule written by a later version must not be half-honoured by this one,
    // and `segmentId` means nothing on an audience that is not a segment.
    expect(
      parseCampaignAudience({ type: "both", segmentId: "seg_1", limit: 10 }),
    ).toEqual({ type: "both" });
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["a bare string", "both"],
    ["an array", ["both"]],
    ["an empty object", {}],
    ["an unknown type", { type: "everyone" }],
    ["a non-string type", { type: 3 }],
    ["a nested shape", { audience: { type: "both" } }],
  ])("reads %s as no audience rather than as everybody", (_label, value) => {
    expect(parseCampaignAudience(value)).toBeNull();
  });

  it("offers exactly one picker option per type, in the declared order", () => {
    expect(CAMPAIGN_AUDIENCE_OPTIONS.map((option) => option.type)).toEqual([
      ...CAMPAIGN_AUDIENCE_TYPES,
    ]);
  });

  it("validates the same grammar on the wire as in the column", () => {
    expect(campaignAudienceBodySchema.safeParse({ type: "both" }).success).toBe(
      true,
    );
    expect(
      campaignAudienceBodySchema.safeParse({ type: "everyone" }).success,
    ).toBe(false);
  });

  it("refuses a segment audience with no segment on the wire too", () => {
    expect(
      campaignAudienceBodySchema.safeParse({ type: "segment" }).success,
    ).toBe(false);
    expect(
      campaignAudienceBodySchema.safeParse({
        type: "segment",
        segmentId: CAMPAIGN_UUID,
      }).success,
    ).toBe(true);
  });
});

describe("audienceIncludes", () => {
  it("routes each type to the sources it draws from", () => {
    expect(audienceIncludes({ type: "subscribers" }, "subscribers")).toBe(true);
    expect(audienceIncludes({ type: "subscribers" }, "customers")).toBe(false);
    expect(audienceIncludes({ type: "customers" }, "customers")).toBe(true);
    expect(audienceIncludes({ type: "customers" }, "subscribers")).toBe(false);
    expect(audienceIncludes({ type: "both" }, "subscribers")).toBe(true);
    expect(audienceIncludes({ type: "both" }, "customers")).toBe(true);
  });
});

describe("dedupeAudienceRecipients", () => {
  it("counts one person once even when the two rows disagree about case", () => {
    // Both rows can exist: the unique indexes are per-tenant and Postgres
    // compares case-sensitively, so `Jane@X.com` and `jane@x.com` are two rows
    // and one human being.
    const merged = dedupeAudienceRecipients([
      { email: "Jane@X.com", userId: "user_1" },
      { email: "jane@x.com", userId: null },
    ]);

    expect(merged).toEqual([
      { email: "jane@x.com", userId: "user_1", name: null },
    ]);
  });

  it("keeps the first occurrence, which is why customers are listed first", () => {
    const customers = [{ email: "a@x.com", userId: "user_a" }];
    const subscribers = [
      { email: "a@x.com", userId: null },
      { email: "b@x.com", userId: null },
    ];

    expect(dedupeAudienceRecipients([...customers, ...subscribers])).toEqual([
      // The userId survives — US-019 writes it onto campaign_recipients.
      { email: "a@x.com", userId: "user_a", name: null },
      { email: "b@x.com", userId: null, name: null },
    ]);
  });

  it("normalizes what it emits, so the suppression compare is exact", () => {
    expect(
      dedupeAudienceRecipients([{ email: "  Bob@Example.COM ", userId: null }]),
    ).toEqual([{ email: "bob@example.com", userId: null, name: null }]);
  });

  it("drops blanks rather than letting them pad the count", () => {
    expect(
      dedupeAudienceRecipients([
        { email: "   ", userId: null },
        { email: "", userId: "user_1" },
        { email: "real@x.com", userId: null },
      ]),
    ).toEqual([{ email: "real@x.com", userId: null, name: null }]);
  });
});

describe("excludeSuppressedRecipients", () => {
  const RECIPIENTS = [
    { email: "keep@x.com", userId: null },
    { email: "gone@x.com", userId: "user_1" },
    { email: "also@x.com", userId: null },
  ];

  it("removes everyone on the list and reports how many that was", () => {
    const result = excludeSuppressedRecipients(RECIPIENTS, [
      "gone@x.com",
      "also@x.com",
    ]);

    expect(result.recipients).toEqual([{ email: "keep@x.com", userId: null }]);
    expect(result.suppressedCount).toBe(2);
  });

  it("matches a suppression recorded in another case", () => {
    const result = excludeSuppressedRecipients(RECIPIENTS, ["GONE@X.com"]);

    expect(result.recipients.map((r) => r.email)).toEqual([
      "keep@x.com",
      "also@x.com",
    ]);
    expect(result.suppressedCount).toBe(1);
  });

  it("changes nothing when the list is empty", () => {
    const result = excludeSuppressedRecipients(RECIPIENTS, []);

    expect(result.recipients).toEqual(RECIPIENTS);
    expect(result.suppressedCount).toBe(0);
  });

  it("does not credit a suppression for an address nobody matched", () => {
    const result = excludeSuppressedRecipients(RECIPIENTS, ["stranger@x.com"]);

    expect(result.suppressedCount).toBe(0);
  });
});

describe("resolveCampaignAudience", () => {
  it("reads confirmed subscribers only, and never opens the customer table", async () => {
    prismaMock.newsletter_subscribers.findMany.mockResolvedValue([
      { email: "sub@x.com" },
    ]);

    const result = await resolveCampaignAudience(
      { type: "subscribers" },
      TENANT_A,
    );

    expect(result.recipients).toEqual([
      { email: "sub@x.com", userId: null, name: null },
    ]);
    expect(prismaMock.newsletter_subscribers.findMany).toHaveBeenCalledWith({
      // PENDING never confirmed the opt-in; UNSUBSCRIBED/SUPPRESSED left.
      where: { tenantId: TENANT_A, status: "CONFIRMED" },
      select: { email: true },
    });
    expect(prismaMock.users.findMany).not.toHaveBeenCalled();
  });

  it("reads consented customers only, excluding GDPR-erased rows", async () => {
    prismaMock.users.findMany.mockResolvedValue([
      { id: "user_1", email: "customer@x.com", name: "Sample Customer" },
    ]);

    const result = await resolveCampaignAudience({ type: "customers" }, TENANT_A);

    expect(result.recipients).toEqual([
      { email: "customer@x.com", userId: "user_1", name: "Sample Customer" },
    ]);
    expect(prismaMock.users.findMany).toHaveBeenCalledWith({
      where: {
        tenantId: TENANT_A,
        role: "PATIENT",
        // Consent is never inferred from having ordered.
        marketingConsentAt: { not: null },
        NOT: { email: { endsWith: "@deleted.local" } },
      },
      // `name` feeds the {{userName}} merge tag US-019 fills per recipient.
      select: { id: true, email: true, name: true },
    });
    expect(prismaMock.newsletter_subscribers.findMany).not.toHaveBeenCalled();
  });

  it("dedupes WITHIN one source too — the unique index does not stop this", async () => {
    // `@@unique([tenantId, email])` on newsletter_subscribers is case-sensitive
    // in Postgres, so one tenant really can hold both of these rows as
    // CONFIRMED. Two confirmations, one person, one message.
    prismaMock.newsletter_subscribers.findMany.mockResolvedValue([
      { email: "Jane@x.com" },
      { email: "jane@x.com" },
    ]);

    const result = await resolveCampaignAudience(
      { type: "subscribers" },
      TENANT_A,
    );

    expect(result.recipients).toEqual([
      { email: "jane@x.com", userId: null, name: null },
    ]);
  });

  it("dedupes across both sources and applies the suppression list", async () => {
    prismaMock.users.findMany.mockResolvedValue([
      { id: "user_1", email: "Both@x.com", name: "Both Lists" },
      { id: "user_2", email: "opted-out@x.com", name: null },
    ]);
    prismaMock.newsletter_subscribers.findMany.mockResolvedValue([
      { email: "both@x.com" },
      { email: "subscriber@x.com" },
    ]);
    prismaMock.email_suppressions.findMany.mockResolvedValue([
      { email: "opted-out@x.com" },
    ]);

    const result = await resolveCampaignAudience({ type: "both" }, TENANT_A);

    expect(result.recipients).toEqual([
      // One message for the person on both lists, carrying the customer's id —
      // and the customer's name, which the subscriber row does not have.
      { email: "both@x.com", userId: "user_1", name: "Both Lists" },
      { email: "subscriber@x.com", userId: null, name: null },
    ]);
    expect(result.suppressedCount).toBe(1);
  });

  it("asks the suppression store about the deduped set, scoped to the tenant", async () => {
    prismaMock.users.findMany.mockResolvedValue([
      { id: "user_1", email: "a@x.com" },
    ]);
    prismaMock.newsletter_subscribers.findMany.mockResolvedValue([
      { email: "A@X.com" },
      { email: "b@x.com" },
    ]);

    await resolveCampaignAudience({ type: "both" }, TENANT_A);

    expect(prismaMock.email_suppressions.findMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_A, email: { in: ["a@x.com", "b@x.com"] } },
      select: { email: true },
    });
  });

  it("resolves a rule and materializes nothing", async () => {
    prismaMock.newsletter_subscribers.findMany.mockResolvedValue([
      { email: "sub@x.com" },
    ]);

    await resolveCampaignAudience({ type: "both" }, TENANT_A);

    // The audience is a RULE. Recipient rows are US-019's, written at send
    // time — a draft that resolved its own recipients would mail whoever was
    // consented on the day it was written.
    expect(prismaMock.campaign_recipients.create).not.toHaveBeenCalled();
    expect(prismaMock.campaign_recipients.createMany).not.toHaveBeenCalled();
  });
});

describe("GET /api/tenant-admin/campaigns/[id]/audience-count", () => {
  const path = `/api/tenant-admin/campaigns/${CAMPAIGN_UUID}/audience-count`;

  it("counts the stored rule, after dedupe and suppression", async () => {
    prismaMock.users.findMany.mockResolvedValue([
      { id: "user_1", email: "both@x.com" },
      { id: "user_2", email: "gone@x.com" },
    ]);
    prismaMock.newsletter_subscribers.findMany.mockResolvedValue([
      { email: "both@x.com" },
      { email: "sub@x.com" },
    ]);
    prismaMock.email_suppressions.findMany.mockResolvedValue([
      { email: "gone@x.com" },
    ]);

    const response = await audienceCount(request(path), params);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      audience: { type: "both" },
      count: 2,
      suppressed: 1,
    });
  });

  it("counts the requested type instead, so the picker can compare options", async () => {
    prismaMock.newsletter_subscribers.findMany.mockResolvedValue([
      { email: "sub@x.com" },
    ]);

    const response = await audienceCount(request(`${path}?type=subscribers`), params);

    await expect(response.json()).resolves.toEqual({
      audience: { type: "subscribers" },
      count: 1,
      suppressed: 0,
    });
    // The stored rule was `both`; the query string won, and the customer table
    // was never opened for it.
    expect(prismaMock.users.findMany).not.toHaveBeenCalled();
  });

  it("400s an audience type it does not know, rather than answering zero", async () => {
    const response = await audienceCount(request(`${path}?type=everyone`), params);

    expect(response.status).toBe(400);
    expect(prismaMock.newsletter_subscribers.findMany).not.toHaveBeenCalled();
    expect(prismaMock.users.findMany).not.toHaveBeenCalled();
  });

  it("answers a campaign with no audience yet without querying anybody", async () => {
    prismaMock.campaigns.findFirst.mockResolvedValue({ audience: null });

    const response = await audienceCount(request(path), params);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      audience: null,
      count: 0,
      suppressed: 0,
    });
    expect(prismaMock.newsletter_subscribers.findMany).not.toHaveBeenCalled();
    expect(prismaMock.users.findMany).not.toHaveBeenCalled();
  });

  it("returns counts and never the addresses behind them", async () => {
    prismaMock.newsletter_subscribers.findMany.mockResolvedValue([
      { email: "private@x.com" },
    ]);

    const response = await audienceCount(request(`${path}?type=subscribers`), params);

    // `canViewEmails` is enough to ask how many; it is not a reason to hand a
    // browser the tenant's mailing list.
    expect(JSON.stringify(await response.json())).not.toContain("private@x.com");
  });

  it("404s another tenant's campaign before resolving anything", async () => {
    prismaMock.campaigns.findFirst.mockResolvedValue(null);

    const response = await audienceCount(request(path), params);

    expect(response.status).toBe(404);
    expect(prismaMock.newsletter_subscribers.findMany).not.toHaveBeenCalled();
  });

  it("scopes the campaign lookup to the session tenant", async () => {
    await audienceCount(request(path), params);

    expect(prismaMock.campaigns.findFirst).toHaveBeenCalledWith({
      where: { id: CAMPAIGN_UUID, tenantId: TENANT_A },
      select: { audience: true },
    });
  });

  it("400s a malformed id before it reaches a where clause", async () => {
    const response = await audienceCount(
      request("/api/tenant-admin/campaigns/not-a-uuid/audience-count"),
      { params: { id: "not-a-uuid" } },
    );

    expect(response.status).toBe(400);
    expect(prismaMock.campaigns.findFirst).not.toHaveBeenCalled();
  });

  it("403s an admin without canViewEmails", async () => {
    signInAs("editor"); // products/templates only — no email permissions

    const response = await audienceCount(request(path), params);

    expect(response.status).toBe(403);
    expect(prismaMock.campaigns.findFirst).not.toHaveBeenCalled();
  });

  it("hands back the rate limiter's answer without touching the database", async () => {
    const limited = { status: 429 } as never;
    checkRateLimit.mockResolvedValue({ success: false, response: limited });

    const response = await audienceCount(request(path), params);

    // Two unbounded reads per call, fired on every change of selection — a
    // held-down key must not turn the picker into a table-scan loop.
    expect(response).toBe(limited);
    expect(prismaMock.campaigns.findFirst).not.toHaveBeenCalled();
  });

  it("never materializes recipients — that is the send's job", async () => {
    prismaMock.newsletter_subscribers.findMany.mockResolvedValue([
      { email: "sub@x.com" },
    ]);

    await audienceCount(request(path), params);

    expect(prismaMock.campaign_recipients.create).not.toHaveBeenCalled();
    expect(prismaMock.campaign_recipients.createMany).not.toHaveBeenCalled();
  });
});
