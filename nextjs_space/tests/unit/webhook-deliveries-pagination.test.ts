import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// PRD-203 follow-up (PR #115 review) — pagination hardening on the webhook
// deliveries list. A crafted ?limit=1000000 previously forced an unbounded scan
// and ?page=-1 / ?page=abc produced negative or NaN skips. The handler now
// clamps limit to <=100 and floors page at 1.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
  webhooks: { findFirst: vi.fn() },
  webhookDelivery: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { GET as deliveriesGet } from "@/app/api/tenant-admin/webhooks/[id]/deliveries/route";

const TENANT_A = "tenant-a";
const WEBHOOK_UUID = "22222222-2222-2222-2222-222222222222";

function adminUser(over: Record<string, unknown> = {}) {
  return {
    id: "admin_1",
    email: "admin@store.dev",
    name: "Admin",
    image: "",
    role: "TENANT_ADMIN",
    tenantId: TENANT_A,
    clerkOrgId: null,
    ...over,
  };
}

const call = (qs: string) =>
  deliveriesGet(
    new NextRequest(
      `http://store.dev/api/tenant-admin/webhooks/${WEBHOOK_UUID}/deliveries${qs}`,
    ),
    { params: { id: WEBHOOK_UUID } },
  );

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(adminUser());
  prismaMock.webhooks.findFirst.mockResolvedValue({
    id: WEBHOOK_UUID,
    tenantId: TENANT_A,
  });
  prismaMock.webhookDelivery.findMany.mockResolvedValue([]);
  prismaMock.webhookDelivery.count.mockResolvedValue(0);
});

describe("GET webhooks/[id]/deliveries — pagination clamp (finding #6)", () => {
  it("caps an oversized limit at 100", async () => {
    await call("?limit=1000000");
    expect(prismaMock.webhookDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100, skip: 0 }),
    );
  });

  it("floors a negative page at 1 (skip 0)", async () => {
    await call("?page=-5&limit=20");
    expect(prismaMock.webhookDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20, skip: 0 }),
    );
  });

  it("falls back to defaults for non-numeric params", async () => {
    await call("?page=abc&limit=xyz");
    expect(prismaMock.webhookDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50, skip: 0 }),
    );
  });

  it("honours a valid page/limit (skip = (page-1)*limit)", async () => {
    await call("?page=3&limit=25");
    expect(prismaMock.webhookDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25, skip: 50 }),
    );
  });
});
