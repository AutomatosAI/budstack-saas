import { beforeEach, describe, expect, it, vi } from "vitest";

// Email Phase 2 US-019 — a campaign footer's unsubscribe link has to work for
// EVERY recipient, including the consented customers who have no subscriber row
// and therefore no subscriber token. Both token shapes arrive on the same URL,
// so the resolver tries both before calling one invalid.

const prismaMock = vi.hoisted(() => ({
  newsletter_subscribers: {
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  campaign_recipients: { findFirst: vi.fn() },
  email_suppressions: { create: vi.fn() },
  // US-023: unsubscribeNewsletterSubscriber also clears users.marketingConsentAt
  users: { updateMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { unsubscribeByToken } from "@/lib/email/unsubscribe-token";

const TENANT_A = "tenant-a";
const TOKEN = "a-very-long-unsubscribe-token-value";
const NOW = new Date("2026-08-13T10:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.newsletter_subscribers.findFirst.mockResolvedValue(null);
  prismaMock.newsletter_subscribers.update.mockResolvedValue({ id: "sub_1" });
  prismaMock.newsletter_subscribers.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.users.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.campaign_recipients.findFirst.mockResolvedValue(null);
  prismaMock.email_suppressions.create.mockResolvedValue({ id: "sup_1" });
});

describe("unsubscribeByToken", () => {
  it("honours a subscriber token without touching campaign recipients", async () => {
    prismaMock.newsletter_subscribers.findFirst.mockResolvedValue({
      id: "sub_1",
      tenantId: TENANT_A,
      email: "jane@example.com",
      status: "CONFIRMED",
    });

    await expect(unsubscribeByToken(TOKEN, TENANT_A, NOW)).resolves.toBe(
      "unsubscribe",
    );
    expect(prismaMock.campaign_recipients.findFirst).not.toHaveBeenCalled();
  });

  it("honours a campaign recipient token by writing the suppression row", async () => {
    prismaMock.campaign_recipients.findFirst.mockResolvedValue({
      email: "Customer@Example.com",
    });

    await expect(unsubscribeByToken(TOKEN, TENANT_A, NOW)).resolves.toBe(
      "unsubscribe",
    );

    // The suppression row is the load-bearing write: it is what every future
    // marketing send is checked against, subscriber row or not. Normalised,
    // because the unique index is case-sensitive in Postgres.
    expect(prismaMock.email_suppressions.create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT_A,
        email: "customer@example.com",
        reason: "unsubscribed",
      },
    });
  });

  it("also retires a subscriber row for the same address, without downgrading a stronger one", async () => {
    prismaMock.campaign_recipients.findFirst.mockResolvedValue({
      email: "jane@example.com",
    });

    await unsubscribeByToken(TOKEN, TENANT_A, NOW);

    const write = prismaMock.newsletter_subscribers.updateMany.mock.calls[0][0];
    expect(write.where).toEqual({
      tenantId: TENANT_A,
      email: "jane@example.com",
      // SUPPRESSED carries stronger provenance than UNSUBSCRIBED (a hard
      // bounce, an operator decision) and must not be overwritten.
      status: { notIn: ["UNSUBSCRIBED", "SUPPRESSED"] },
    });
    expect(write.data).toEqual({
      status: "UNSUBSCRIBED",
      unsubscribedAt: NOW,
    });
  });

  it("resolves a campaign token only inside the tenant that served the link", async () => {
    await unsubscribeByToken(TOKEN, TENANT_A, NOW);

    // campaign_recipients carries no tenantId, so the relation filter is what
    // stops a token minted by one store being redeemed on another.
    expect(prismaMock.campaign_recipients.findFirst.mock.calls[0][0].where).toEqual(
      { unsubscribeToken: TOKEN, campaigns: { tenantId: TENANT_A } },
    );
  });

  it("calls an unknown token invalid, and writes nothing", async () => {
    await expect(unsubscribeByToken(TOKEN, TENANT_A, NOW)).resolves.toBe(
      "invalid",
    );
    expect(prismaMock.email_suppressions.create).not.toHaveBeenCalled();
    expect(prismaMock.newsletter_subscribers.updateMany).not.toHaveBeenCalled();
  });
});
