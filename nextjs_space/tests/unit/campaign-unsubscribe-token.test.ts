import { beforeEach, describe, expect, it, vi } from "vitest";

// Email Phase 2 US-019 — a campaign footer's unsubscribe link has to work for
// EVERY recipient, including the consented customers who have no subscriber row
// and therefore no subscriber token. Both token shapes arrive on the same URL,
// so the resolver tries both before calling one invalid.
//
// US-028 added a third shape (`users.reorderReminderToken`), tried last. Its own
// behaviour is covered in tests/unit/reorder-reminder.test.ts; here it only has
// to be reachable, so `users.findFirst` returns null throughout and the two
// campaign paths below are unchanged.

const prismaMock = vi.hoisted(() => ({
  newsletter_subscribers: {
    findFirst: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  // US-026: the redemption is also stamped on the recipient row, which is what
  // attributes the opt-out to the campaign that prompted it.
  campaign_recipients: { findFirst: vi.fn(), updateMany: vi.fn() },
  email_suppressions: { create: vi.fn() },
  // US-023: unsubscribeNewsletterSubscriber also clears users.marketingConsentAt
  // US-028: `findFirst` is the third token kind's lookup, tried after this one.
  users: { findFirst: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { unsubscribeByToken } from "@/lib/email/unsubscribe-token";

const TENANT_A = "tenant-a";
const TOKEN = "a-very-long-unsubscribe-token-value";
const NOW = new Date("2026-08-13T10:00:00Z");
const RECIPIENT_ID = "rec-1";

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.newsletter_subscribers.findFirst.mockResolvedValue(null);
  prismaMock.newsletter_subscribers.update.mockResolvedValue({ id: "sub_1" });
  prismaMock.newsletter_subscribers.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.users.findFirst.mockResolvedValue(null);
  prismaMock.users.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.campaign_recipients.findFirst.mockResolvedValue(null);
  prismaMock.campaign_recipients.updateMany.mockResolvedValue({ count: 1 });
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
      id: RECIPIENT_ID,
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
      id: RECIPIENT_ID,
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
    expect(prismaMock.campaign_recipients.updateMany).not.toHaveBeenCalled();
  });

  // US-026 — attribution. A suppression row knows that an address left; only
  // the per-recipient token knows which email it left from.
  it("stamps the recipient row so the opt-out is attributed to its campaign", async () => {
    prismaMock.campaign_recipients.findFirst.mockResolvedValue({
      id: RECIPIENT_ID,
      email: "jane@example.com",
    });

    await unsubscribeByToken(TOKEN, TENANT_A, NOW);

    const write = prismaMock.campaign_recipients.updateMany.mock.calls[0][0];
    // Keyed on the id that came out of the tenant-scoped read above, never on
    // the token again.
    expect(write.where).toEqual({ id: RECIPIENT_ID, unsubscribedAt: null });
    expect(write.data).toEqual({ unsubscribedAt: NOW });
  });

  it("keeps the FIRST redemption when the link is followed again", async () => {
    prismaMock.campaign_recipients.findFirst.mockResolvedValue({
      id: RECIPIENT_ID,
      email: "jane@example.com",
    });

    await unsubscribeByToken(TOKEN, TENANT_A, NOW);

    // The link outlives the campaign in somebody's inbox, so a second click
    // months later must not restate an old opt-out as a fresh one. The
    // predicate is in the write, so Postgres decides it, not a read.
    expect(
      prismaMock.campaign_recipients.updateMany.mock.calls[0][0].where
        .unsubscribedAt,
    ).toBeNull();
  });

  it("never touches a campaign recipient when a subscriber token matched", async () => {
    prismaMock.newsletter_subscribers.findFirst.mockResolvedValue({
      id: "sub_1",
      tenantId: TENANT_A,
      email: "jane@example.com",
      status: "CONFIRMED",
    });

    await unsubscribeByToken(TOKEN, TENANT_A, NOW);

    // A newsletter opt-out is not attributable to any campaign — inventing an
    // attribution here would inflate a campaign's unsubscribe count with
    // people who left from somewhere else entirely.
    expect(prismaMock.campaign_recipients.updateMany).not.toHaveBeenCalled();
  });
});
