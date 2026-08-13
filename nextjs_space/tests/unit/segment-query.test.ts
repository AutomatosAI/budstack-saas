import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Email Phase 2 US-025 — resolving a segment rule against the database, and the
// four endpoints that read and write one.
//
// Module-boundary mocks only (getCurrentUser, prisma, permission resolution,
// rate limit). The real auth wrapper, the real permission gate, the real
// grammar, the real dedupe/suppression folds and the real suppression store all
// execute.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
  users: { findMany: vi.fn() },
  orders: { groupBy: vi.fn() },
  consultation_questionnaires: { findMany: vi.fn() },
  email_suppressions: { findMany: vi.fn() },
  newsletter_subscribers: { findMany: vi.fn() },
  segments: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  campaigns: { findFirst: vi.fn(), findMany: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit }));

import { GET as listSegmentsRoute, POST as createSegmentRoute } from "@/app/api/tenant-admin/segments/route";
import { POST as countSegmentRoute } from "@/app/api/tenant-admin/segments/count/route";
import {
  DELETE as deleteSegmentRoute,
  PUT as updateSegmentRoute,
} from "@/app/api/tenant-admin/segments/[id]/route";
import { resolveCampaignAudience } from "@/lib/email/campaign-audience-query";
import type { SegmentFilter } from "@/lib/email/segment-filter";
import {
  buildSegmentUserWhere,
  resolveSegmentById,
  resolveSegmentFilter,
} from "@/lib/email/segment-query";
import { resolvePermissions } from "@/lib/permissions/resolve";

const TENANT_A = "tenant-a";
const SEGMENT_UUID = "44444444-4444-4444-4444-444444444444";
const NOW = new Date("2026-08-13T12:00:00.000Z");
const params = { params: { id: SEGMENT_UUID } };

const filter = (...criteria: SegmentFilter["criteria"]): SegmentFilter => ({
  criteria,
});

function request(path: string, body?: unknown, method = "POST") {
  return new NextRequest(`http://store.dev${path}`, {
    method,
    ...(body !== undefined && {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  });
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

/** A consented customer, which is what the resolver is allowed to keep. */
const customer = (id: string, email: string, consented = true) => ({
  id,
  email,
  name: null,
  marketingConsentAt: consented ? new Date("2026-01-01T00:00:00.000Z") : null,
});

beforeEach(() => {
  vi.clearAllMocks();
  signInAs("admin");
  checkRateLimit.mockResolvedValue({ success: true });
  prismaMock.users.findMany.mockResolvedValue([]);
  prismaMock.orders.groupBy.mockResolvedValue([]);
  prismaMock.consultation_questionnaires.findMany.mockResolvedValue([]);
  prismaMock.email_suppressions.findMany.mockResolvedValue([]);
  prismaMock.newsletter_subscribers.findMany.mockResolvedValue([]);
  prismaMock.segments.findMany.mockResolvedValue([]);
  prismaMock.campaigns.findMany.mockResolvedValue([]);
});

describe("buildSegmentUserWhere — one test per filter axis", () => {
  const base = {
    tenantId: TENANT_A,
    role: "PATIENT",
    NOT: { email: { endsWith: "@deleted.local" } },
  };

  it("always scopes to this tenant's live customers", () => {
    expect(
      buildSegmentUserWhere(filter({ kind: "kyc-approved" }), TENANT_A, NOW),
    ).toEqual(base);
  });

  it("last-order age: has ordered, but not since the cutoff", () => {
    const where = buildSegmentUserWhere(
      filter({ kind: "last-order-age", days: 60 }),
      TENANT_A,
      NOW,
    );

    expect(where.AND).toEqual([
      // Both halves, because "no order since the cutoff" alone would also match
      // every customer who has never ordered — a different segment entirely.
      { orders: { some: { tenantId: TENANT_A } } },
      {
        orders: {
          none: {
            tenantId: TENANT_A,
            createdAt: { gte: new Date("2026-06-14T12:00:00.000Z") },
          },
        },
      },
    ]);
  });

  it("order count >= N: narrows to customers who have ordered at all", () => {
    // Prisma cannot ask "at least three" in a where; the floor is checked
    // against the candidate set afterwards.
    expect(
      buildSegmentUserWhere(
        filter({ kind: "order-count-min", count: 3 }),
        TENANT_A,
        NOW,
      ).AND,
    ).toEqual([{ orders: { some: { tenantId: TENANT_A } } }]);
  });

  it("order count = 0: no orders in this store", () => {
    expect(
      buildSegmentUserWhere(filter({ kind: "never-ordered" }), TENANT_A, NOW).AND,
    ).toEqual([{ orders: { none: { tenantId: TENANT_A } } }]);
  });

  it("has tag: the relation predicate names the tenant itself", () => {
    // The $extends scope layer rewrites only the top-level where of the model
    // being queried, so a relation predicate without its own tenantId would
    // reach across stores.
    expect(
      buildSegmentUserWhere(
        filter({ kind: "has-tag", tag: "vip" }),
        TENANT_A,
        NOW,
      ).AND,
    ).toEqual([{ customer_tags: { some: { tenantId: TENANT_A, tag: "vip" } } }]);
  });

  it("KYC approved: not expressible here — it is joined by email", () => {
    expect(
      buildSegmentUserWhere(filter({ kind: "kyc-approved" }), TENANT_A, NOW).AND,
    ).toBeUndefined();
  });

  it("marketing consent: a plain column predicate", () => {
    expect(
      buildSegmentUserWhere(filter({ kind: "marketing-consent" }), TENANT_A, NOW)
        .AND,
    ).toEqual([{ marketingConsentAt: { not: null } }]);
  });

  it("ANDs the axes together", () => {
    const where = buildSegmentUserWhere(
      filter({ kind: "never-ordered" }, { kind: "has-tag", tag: "vip" }),
      TENANT_A,
      NOW,
    );

    expect(where.AND).toHaveLength(2);
  });
});

describe("resolveSegmentFilter", () => {
  it("checks the order floor against the candidates, tenant-scoped", async () => {
    prismaMock.users.findMany.mockResolvedValue([
      customer("user_1", "loyal@x.com"),
      customer("user_2", "once@x.com"),
    ]);
    prismaMock.orders.groupBy.mockResolvedValue([
      { userId: "user_1", _count: { _all: 4 } },
      { userId: "user_2", _count: { _all: 1 } },
    ]);

    const result = await resolveSegmentFilter(
      filter({ kind: "order-count-min", count: 3 }),
      TENANT_A,
      NOW,
    );

    expect(result.recipients.map((r) => r.email)).toEqual(["loyal@x.com"]);
    expect(prismaMock.orders.groupBy).toHaveBeenCalledWith({
      by: ["userId"],
      where: { tenantId: TENANT_A, userId: { in: ["user_1", "user_2"] } },
      _count: { _all: true },
    });
  });

  it("does not spend a groupBy on a floor of one", async () => {
    prismaMock.users.findMany.mockResolvedValue([customer("user_1", "a@x.com")]);

    const result = await resolveSegmentFilter(
      filter({ kind: "order-count-min", count: 1 }),
      TENANT_A,
      NOW,
    );

    // `orders: { some: ... }` in the where already asserted it.
    expect(prismaMock.orders.groupBy).not.toHaveBeenCalled();
    expect(result.recipients).toHaveLength(1);
  });

  it("keeps only KYC-verified customers, matched case-insensitively", async () => {
    prismaMock.users.findMany.mockResolvedValue([
      customer("user_1", "Verified@X.com"),
      customer("user_2", "pending@x.com"),
    ]);
    prismaMock.consultation_questionnaires.findMany.mockResolvedValue([
      { email: "verified@x.com" },
    ]);

    const result = await resolveSegmentFilter(
      filter({ kind: "kyc-approved" }),
      TENANT_A,
      NOW,
    );

    expect(result.recipients.map((r) => r.email)).toEqual(["verified@x.com"]);
    expect(prismaMock.consultation_questionnaires.findMany).toHaveBeenCalledWith({
      where: { tenantId: TENANT_A, isKycVerified: true },
      select: { email: true },
    });
  });

  it("applies marketing consent EVEN WHEN the rule does not ask for it", async () => {
    // Consent is the law, not one of the axes an author may leave off.
    prismaMock.users.findMany.mockResolvedValue([
      customer("user_1", "consented@x.com"),
      customer("user_2", "never-opted-in@x.com", false),
    ]);

    const result = await resolveSegmentFilter(
      filter({ kind: "never-ordered" }),
      TENANT_A,
      NOW,
    );

    expect(result.recipients.map((r) => r.email)).toEqual(["consented@x.com"]);
    // …and says so: `matched` is what the rule describes, `recipients` is who
    // may be mailed, and the builder shows the gap between them.
    expect(result.matchedCount).toBe(2);
  });

  it("applies the suppression list after the dedupe", async () => {
    prismaMock.users.findMany.mockResolvedValue([
      customer("user_1", "keep@x.com"),
      customer("user_2", "gone@x.com"),
    ]);
    prismaMock.email_suppressions.findMany.mockResolvedValue([
      { email: "gone@x.com" },
    ]);

    const result = await resolveSegmentFilter(
      filter({ kind: "never-ordered" }),
      TENANT_A,
      NOW,
    );

    expect(result.recipients.map((r) => r.email)).toEqual(["keep@x.com"]);
    expect(result.suppressedCount).toBe(1);
    expect(result.matchedCount).toBe(2);
  });

  it("carries the userId and name US-019 writes onto the recipient row", async () => {
    prismaMock.users.findMany.mockResolvedValue([
      { ...customer("user_1", "a@x.com"), name: "Sample Customer" },
    ]);

    const result = await resolveSegmentFilter(
      filter({ kind: "never-ordered" }),
      TENANT_A,
      NOW,
    );

    expect(result.recipients).toEqual([
      { email: "a@x.com", userId: "user_1", name: "Sample Customer" },
    ]);
  });
});

describe("resolveSegmentById", () => {
  it("resolves a stored rule scoped to the tenant", async () => {
    prismaMock.segments.findFirst.mockResolvedValue({
      id: SEGMENT_UUID,
      name: "Reorder",
      filter: { criteria: [{ kind: "never-ordered" }] },
    });
    prismaMock.users.findMany.mockResolvedValue([customer("user_1", "a@x.com")]);

    const result = await resolveSegmentById(SEGMENT_UUID, TENANT_A, NOW);

    expect(result.recipients).toHaveLength(1);
    expect(prismaMock.segments.findFirst).toHaveBeenCalledWith({
      where: { id: SEGMENT_UUID, tenantId: TENANT_A },
      select: { id: true, name: true, filter: true },
    });
  });

  it("resolves a deleted segment to NOBODY, and reads no customers", async () => {
    // A dangling reference must stop a send (US-019 refuses an empty audience),
    // never widen one.
    prismaMock.segments.findFirst.mockResolvedValue(null);

    const result = await resolveSegmentById(SEGMENT_UUID, TENANT_A, NOW);

    expect(result).toEqual({ recipients: [], suppressedCount: 0, matchedCount: 0 });
    expect(prismaMock.users.findMany).not.toHaveBeenCalled();
  });

  it("resolves an unreadable rule to nobody", async () => {
    prismaMock.segments.findFirst.mockResolvedValue({
      id: SEGMENT_UUID,
      name: "From the future",
      filter: { criteria: [{ kind: "spent-over", amount: 100 }] },
    });

    const result = await resolveSegmentById(SEGMENT_UUID, TENANT_A, NOW);

    expect(result.recipients).toEqual([]);
    expect(prismaMock.users.findMany).not.toHaveBeenCalled();
  });
});

describe("resolveCampaignAudience with a segment", () => {
  it("routes a segment audience through the segment resolver only", async () => {
    prismaMock.segments.findFirst.mockResolvedValue({
      id: SEGMENT_UUID,
      name: "Reorder",
      filter: { criteria: [{ kind: "never-ordered" }] },
    });
    prismaMock.users.findMany.mockResolvedValue([customer("user_1", "a@x.com")]);

    const result = await resolveCampaignAudience(
      { type: "segment", segmentId: SEGMENT_UUID },
      TENANT_A,
    );

    expect(result.recipients.map((r) => r.email)).toEqual(["a@x.com"]);
    // A segment is customers narrowed by a rule — never the subscriber list,
    // and never every consented customer.
    expect(prismaMock.newsletter_subscribers.findMany).not.toHaveBeenCalled();
    expect(prismaMock.users.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("segments API", () => {
  const LIST_PATH = "/api/tenant-admin/segments";
  const COUNT_PATH = "/api/tenant-admin/segments/count";
  const ITEM_PATH = `/api/tenant-admin/segments/${SEGMENT_UUID}`;
  const RULE = { criteria: [{ kind: "never-ordered" }] };

  it("lists this tenant's segments, rule narrowed", async () => {
    prismaMock.segments.findMany.mockResolvedValue([
      {
        id: SEGMENT_UUID,
        name: "Reorder",
        filter: RULE,
        updatedAt: new Date("2026-08-13T09:00:00.000Z"),
      },
    ]);

    const response = await listSegmentsRoute(request(LIST_PATH, undefined, "GET"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      segments: [
        {
          id: SEGMENT_UUID,
          name: "Reorder",
          filter: RULE,
          updatedAt: "2026-08-13T09:00:00.000Z",
        },
      ],
    });
    expect(prismaMock.segments.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: TENANT_A } }),
    );
  });

  it("creates a segment against the session tenant, never a body one", async () => {
    prismaMock.segments.create.mockResolvedValue({
      id: SEGMENT_UUID,
      name: "Reorder",
      filter: RULE,
      updatedAt: new Date("2026-08-13T09:00:00.000Z"),
    });

    const response = await createSegmentRoute(
      request(LIST_PATH, { name: "Reorder", filter: RULE, tenantId: "tenant-b" }),
    );

    // `.strict()` on the body schema: an unexpected key is a rejected request,
    // not a silently ignored one.
    expect(response.status).toBe(400);
    expect(prismaMock.segments.create).not.toHaveBeenCalled();
  });

  it("stores the parsed rule under the session tenant", async () => {
    prismaMock.segments.create.mockResolvedValue({
      id: SEGMENT_UUID,
      name: "Reorder",
      filter: RULE,
      updatedAt: new Date("2026-08-13T09:00:00.000Z"),
    });

    await createSegmentRoute(request(LIST_PATH, { name: " Reorder ", filter: RULE }));

    expect(prismaMock.segments.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { tenantId: TENANT_A, name: "Reorder", filter: RULE },
      }),
    );
  });

  it("turns a duplicate name into a sentence rather than a 500", async () => {
    prismaMock.segments.create.mockRejectedValue({ code: "P2002" });

    const response = await createSegmentRoute(
      request(LIST_PATH, { name: "Reorder", filter: RULE }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        error: expect.stringContaining("already exists"),
      }),
    );
  });

  it("403s a create from an admin without canEditEmails", async () => {
    signInAs("customer_support");

    const response = await createSegmentRoute(
      request(LIST_PATH, { name: "Reorder", filter: RULE }),
    );

    expect(response.status).toBe(403);
    expect(prismaMock.segments.create).not.toHaveBeenCalled();
  });

  it("404s an update to another tenant's segment", async () => {
    prismaMock.segments.updateMany.mockResolvedValue({ count: 0 });

    const response = await updateSegmentRoute(
      request(ITEM_PATH, { name: "Renamed" }, "PUT"),
      params,
    );

    expect(response.status).toBe(404);
    // Ownership IS the update's row count — the write itself carried tenantId.
    expect(prismaMock.segments.updateMany).toHaveBeenCalledWith({
      where: { id: SEGMENT_UUID, tenantId: TENANT_A },
      data: { name: "Renamed" },
    });
  });

  it("refuses to delete a segment an unsent campaign points at", async () => {
    prismaMock.campaigns.findMany.mockResolvedValue([
      { name: "October newsletter", audience: { type: "segment", segmentId: SEGMENT_UUID } },
    ]);

    const response = await deleteSegmentRoute(
      request(ITEM_PATH, undefined, "DELETE"),
      params,
    );

    expect(response.status).toBe(409);
    expect(prismaMock.segments.deleteMany).not.toHaveBeenCalled();
  });

  it("deletes one nothing points at", async () => {
    prismaMock.campaigns.findMany.mockResolvedValue([
      { name: "Everyone", audience: { type: "both" } },
    ]);
    prismaMock.segments.deleteMany.mockResolvedValue({ count: 1 });

    const response = await deleteSegmentRoute(
      request(ITEM_PATH, undefined, "DELETE"),
      params,
    );

    expect(response.status).toBe(200);
    expect(prismaMock.segments.deleteMany).toHaveBeenCalledWith({
      where: { id: SEGMENT_UUID, tenantId: TENANT_A },
    });
  });

  it("400s a malformed id before it reaches a where clause", async () => {
    const response = await deleteSegmentRoute(
      request("/api/tenant-admin/segments/not-a-uuid", undefined, "DELETE"),
      { params: { id: "not-a-uuid" } },
    );

    expect(response.status).toBe(400);
    expect(prismaMock.campaigns.findMany).not.toHaveBeenCalled();
  });

  it("counts an unsaved rule, and answers with numbers only", async () => {
    prismaMock.users.findMany.mockResolvedValue([
      customer("user_1", "private@x.com"),
      customer("user_2", "no-consent@x.com", false),
    ]);

    const response = await countSegmentRoute(request(COUNT_PATH, RULE));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).toEqual({ matched: 2, count: 1, suppressed: 0 });
    // `canViewEmails` is enough to ask how many; it is not a reason to hand a
    // browser the tenant's customer list.
    expect(JSON.stringify(payload)).not.toContain("private@x.com");
  });

  it("400s a rule it cannot read, rather than counting a wider one", async () => {
    const response = await countSegmentRoute(
      request(COUNT_PATH, {
        criteria: [{ kind: "never-ordered" }, { kind: "spent-over", amount: 100 }],
      }),
    );

    expect(response.status).toBe(400);
    expect(prismaMock.users.findMany).not.toHaveBeenCalled();
  });

  it("hands back the rate limiter's answer without touching the database", async () => {
    const limited = { status: 429 } as never;
    checkRateLimit.mockResolvedValue({ success: false, response: limited });

    const response = await countSegmentRoute(request(COUNT_PATH, RULE));

    expect(response).toBe(limited);
    expect(prismaMock.users.findMany).not.toHaveBeenCalled();
  });

  it("403s a count from an admin with no email permissions at all", async () => {
    signInAs("editor"); // products/templates only

    const response = await countSegmentRoute(request(COUNT_PATH, RULE));

    expect(response.status).toBe(403);
    expect(prismaMock.users.findMany).not.toHaveBeenCalled();
  });
});
