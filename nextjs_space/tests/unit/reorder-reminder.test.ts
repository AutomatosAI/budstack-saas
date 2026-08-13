import { beforeEach, describe, expect, it, vi } from "vitest";

// Email Phase 2 US-028 — the reorder-reminder automation.
//
// Four properties carry it, and each is a different way of being wrong:
//
//   1. THE WINDOW. A reminder goes out N days after the last DELIVERED order
//      and not before, and never at all to somebody who has ordered since.
//   2. THE GATES. Consent and suppression are applied unconditionally — a
//      reminder is marketing, and neither is an axis the store may leave off.
//   3. IDEMPOTENCY. The once-per-window guard is a CONDITIONAL write, so two
//      sweeps racing each other mail nobody twice.
//   4. THE FOOTER. Every queued job is `category: "marketing"` carrying a real
//      unsubscribe URL, because US-020's worker guard refuses one that is not.
//
// Module-boundary mocks only (prisma, the queue, the tenant-context ALS). The
// real rules, the real predicate builder, the real dedupe/suppression folds and
// the real render pipeline all execute.

const prismaMock = vi.hoisted(() => ({
  users: { findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  tenants: { findMany: vi.fn(), findFirst: vi.fn() },
  email_suppressions: { findMany: vi.fn(), create: vi.fn() },
  email_logs: { create: vi.fn() },
  newsletter_subscribers: { findFirst: vi.fn(), updateMany: vi.fn() },
  campaign_recipients: { findFirst: vi.fn(), updateMany: vi.fn() },
}));
const queueMock = vi.hoisted(() => ({ add: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/queue", () => ({
  getEmailQueue: () => queueMock,
  getCampaignQueue: () => queueMock,
  getReorderQueue: () => queueMock,
}));

import { UNSUBSCRIBE_URL_SLOT } from "@/lib/email/email-shell";
import { resolveMarketingCompliance } from "@/lib/email/marketing-headers";
import {
  DEFAULT_REORDER_REMINDER_DAYS,
  MAX_REORDER_REMINDER_DAYS,
  MIN_REORDER_REMINDER_DAYS,
  REORDER_MAX_PER_SWEEP,
  REORDER_REMINDER_EVENT,
  isReorderReminderDue,
  reorderCutoff,
  resolveReorderReminderRule,
} from "@/lib/email/reorder-reminder";
import {
  renderReorderReminderHtml,
  reorderReminderVariables,
} from "@/lib/email/reorder-reminder-content";
import { runReorderReminderSweep } from "@/lib/email/reorder-reminder-runner";
import {
  buildReorderCandidateWhere,
  claimReorderReminder,
  findReorderCandidates,
} from "@/lib/email/reorder-reminder-store";
import { unsubscribeByToken } from "@/lib/email/unsubscribe-token";

const TENANT_A = "tenant-a";
const NOW = new Date("2026-08-13T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

/** `n` days before NOW. */
const ago = (n: number) => new Date(NOW.getTime() - n * DAY);

const TENANT_ROW = {
  id: TENANT_A,
  businessName: "Healing Buds",
  subdomain: "healingbuds",
  customDomain: "shop.example",
  settings: { businessAddress: "1 Sample Street, Dublin" },
  businessAddress1: null,
  businessAddress2: null,
  businessCity: null,
  businessState: null,
  businessPostalCode: null,
  businessCountry: null,
  tenant_branding: null,
};

const CUSTOMER = {
  id: "user-1",
  email: "Jane@Example.com",
  name: "Jane",
  reorderReminderToken: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.email_suppressions.findMany.mockResolvedValue([]);
  prismaMock.users.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.email_logs.create.mockResolvedValue({});
  queueMock.add.mockResolvedValue({ id: "job-1" });
});

// ── 1. The rule ──────────────────────────────────────────────────────────────

describe("resolveReorderReminderRule", () => {
  it("is off, at the default window, for a store that never mentioned it", () => {
    expect(resolveReorderReminderRule(null)).toEqual({
      enabled: false,
      days: DEFAULT_REORDER_REMINDER_DAYS,
    });
    expect(resolveReorderReminderRule({})).toEqual({
      enabled: false,
      days: DEFAULT_REORDER_REMINDER_DAYS,
    });
  });

  it("is off for anything that is not exactly true", () => {
    for (const value of [false, "true", 1, null, undefined]) {
      expect(
        resolveReorderReminderRule({ reorderReminderEnabled: value }).enabled,
      ).toBe(false);
    }
  });

  it("reads a bounded window and falls back UP for an unusable one", () => {
    expect(
      resolveReorderReminderRule({ reorderReminderDays: 90 }).days,
    ).toBe(90);

    // Out of bounds, fractional, or the wrong type all fall back to 60 — the
    // conservative direction, because a shorter window mails people sooner.
    for (const value of [
      MIN_REORDER_REMINDER_DAYS - 1,
      MAX_REORDER_REMINDER_DAYS + 1,
      30.5,
      "60",
      null,
    ]) {
      expect(
        resolveReorderReminderRule({ reorderReminderDays: value }).days,
      ).toBe(DEFAULT_REORDER_REMINDER_DAYS);
    }
  });

  it("survives a settings blob that will not parse", () => {
    expect(resolveReorderReminderRule("not an object").enabled).toBe(false);
  });
});

// ── 2. The window ────────────────────────────────────────────────────────────

describe("isReorderReminderDue", () => {
  const due = (history: Parameters<typeof isReorderReminderDue>[0]) =>
    isReorderReminderDue(history, NOW, 60);

  it("is due once the last delivery is older than the window", () => {
    expect(
      due({
        lastDeliveredAt: ago(61),
        lastOrderAt: ago(61),
        lastRemindedAt: null,
      }),
    ).toBe(true);
  });

  it("is not due while the delivery is still inside the window", () => {
    expect(
      due({
        lastDeliveredAt: ago(59),
        lastOrderAt: ago(59),
        lastRemindedAt: null,
      }),
    ).toBe(false);
  });

  it("is due exactly ON the boundary, not a day later", () => {
    const cutoff = reorderCutoff(NOW, 60);
    expect(
      due({ lastDeliveredAt: cutoff, lastOrderAt: cutoff, lastRemindedAt: null }),
    ).toBe(true);
  });

  it("is never due for somebody with no delivered order", () => {
    expect(
      due({ lastDeliveredAt: null, lastOrderAt: ago(90), lastRemindedAt: null }),
    ).toBe(false);
  });

  it("is not due when a newer order exists, whatever its status", () => {
    // The delivery is old, but they have ordered since — the parcel is in
    // transit and "time to reorder?" is the wrong message.
    expect(
      due({
        lastDeliveredAt: ago(120),
        lastOrderAt: ago(3),
        lastRemindedAt: null,
      }),
    ).toBe(false);
  });

  it("is not due again within the same window", () => {
    expect(
      due({
        lastDeliveredAt: ago(120),
        lastOrderAt: ago(120),
        lastRemindedAt: ago(10),
      }),
    ).toBe(false);
  });

  it("is due again once a whole window has passed since the last reminder", () => {
    expect(
      due({
        lastDeliveredAt: ago(200),
        lastOrderAt: ago(200),
        lastRemindedAt: ago(61),
      }),
    ).toBe(true);
  });
});

// The prose rule and the SQL predicate are two statements of one thing, so the
// predicate is pinned against the four conditions rather than against a snapshot.
describe("buildReorderCandidateWhere", () => {
  const where = buildReorderCandidateWhere(TENANT_A, reorderCutoff(NOW, 60));
  const clauses = where.AND as Record<string, any>[];

  it("only ever looks at this tenant's consented customers", () => {
    expect(where.tenantId).toBe(TENANT_A);
    expect(where.role).toBe("PATIENT");
    expect(where.marketingConsentAt).toEqual({ not: null });
  });

  it("excludes GDPR-erased rows, which are not addresses", () => {
    expect(where.NOT).toEqual({ email: { endsWith: "@deleted.local" } });
  });

  it("names tenantId inside EVERY relation predicate", () => {
    // The lib/db scope layer rewrites only the top-level where; a relation
    // predicate without its own tenantId reaches across stores.
    const relations = clauses
      .filter((clause) => clause.orders)
      .map((clause) => clause.orders.some ?? clause.orders.none);
    expect(relations).toHaveLength(3);
    for (const relation of relations) {
      expect(relation.tenantId).toBe(TENANT_A);
    }
  });

  it("requires a delivered order, none delivered since, and none of any kind since", () => {
    expect(clauses).toContainEqual({
      orders: { some: { tenantId: TENANT_A, status: "DELIVERED" } },
    });
    expect(clauses).toContainEqual({
      orders: {
        none: {
          tenantId: TENANT_A,
          status: "DELIVERED",
          updatedAt: { gt: reorderCutoff(NOW, 60) },
        },
      },
    });
    expect(clauses).toContainEqual({
      orders: {
        none: { tenantId: TENANT_A, createdAt: { gt: reorderCutoff(NOW, 60) } },
      },
    });
  });

  it("carries the once-per-window guard", () => {
    expect(clauses).toContainEqual({
      OR: [
        { reorderReminderAt: null },
        { reorderReminderAt: { lte: reorderCutoff(NOW, 60) } },
      ],
    });
  });
});

// ── 3. The gates ─────────────────────────────────────────────────────────────

describe("findReorderCandidates", () => {
  it("normalises the address and keeps the customer's id and token", async () => {
    prismaMock.users.findMany.mockResolvedValue([
      { ...CUSTOMER, reorderReminderToken: "existing-token" },
    ]);

    const { candidates } = await findReorderCandidates(
      TENANT_A,
      reorderCutoff(NOW, 60),
    );

    expect(candidates[0]).toEqual({
      email: "jane@example.com",
      userId: "user-1",
      name: "Jane",
      reorderReminderToken: "existing-token",
    });
  });

  it("drops anyone on the suppression list", async () => {
    prismaMock.users.findMany.mockResolvedValue([CUSTOMER]);
    prismaMock.email_suppressions.findMany.mockResolvedValue([
      { email: "jane@example.com" },
    ]);

    const { candidates } = await findReorderCandidates(
      TENANT_A,
      reorderCutoff(NOW, 60),
    );
    expect(candidates).toEqual([]);
  });

  it("checks suppression against this tenant only", async () => {
    prismaMock.users.findMany.mockResolvedValue([CUSTOMER]);
    await findReorderCandidates(TENANT_A, reorderCutoff(NOW, 60));

    expect(prismaMock.email_suppressions.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: TENANT_A, email: { in: ["jane@example.com"] } },
      }),
    );
  });

  it("takes the longest-waiting first, so truncation is fair and repeatable", async () => {
    prismaMock.users.findMany.mockResolvedValue([]);
    await findReorderCandidates(TENANT_A, reorderCutoff(NOW, 60));

    const { orderBy, take } = prismaMock.users.findMany.mock.calls[0][0];
    expect(take).toBe(REORDER_MAX_PER_SWEEP);
    expect(orderBy).toEqual([
      { reorderReminderAt: { sort: "asc", nulls: "first" } },
      { createdAt: "asc" },
    ]);
  });

  it("reports a full page as 'more are due', measured before suppression", async () => {
    // Two rows for a limit of two: the page is full, so more are waiting — even
    // though one of them is suppressed and never becomes a candidate.
    prismaMock.users.findMany.mockResolvedValue([
      CUSTOMER,
      { ...CUSTOMER, id: "user-2", email: "bob@example.com" },
    ]);
    prismaMock.email_suppressions.findMany.mockResolvedValue([
      { email: "bob@example.com" },
    ]);

    const result = await findReorderCandidates(TENANT_A, reorderCutoff(NOW, 60), 2);

    expect(result.candidates).toHaveLength(1);
    expect(result.atCap).toBe(true);
  });

  it("is not at the cap when the page came back short", async () => {
    prismaMock.users.findMany.mockResolvedValue([CUSTOMER]);

    const result = await findReorderCandidates(TENANT_A, reorderCutoff(NOW, 60), 2);
    expect(result.atCap).toBe(false);
  });
});

// ── 4. Idempotency ───────────────────────────────────────────────────────────

describe("claimReorderReminder", () => {
  const candidate = {
    email: "jane@example.com",
    userId: "user-1",
    name: "Jane",
    reorderReminderToken: null,
  };
  const cutoff = reorderCutoff(NOW, 60);

  it("puts the window predicate IN the write, not before it", async () => {
    await claimReorderReminder(candidate, TENANT_A, cutoff, NOW);

    expect(prismaMock.users.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "user-1",
          tenantId: TENANT_A,
          OR: [
            { reorderReminderAt: null },
            { reorderReminderAt: { lte: cutoff } },
          ],
        }),
      }),
    );
  });

  it("reports a lost race rather than mailing the customer twice", async () => {
    prismaMock.users.updateMany.mockResolvedValue({ count: 0 });

    const claim = await claimReorderReminder(candidate, TENANT_A, cutoff, NOW);
    expect(claim.claimed).toBe(false);
  });

  it("mints a token on the first reminder and never rotates it after", async () => {
    const first = await claimReorderReminder(candidate, TENANT_A, cutoff, NOW);
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{20,}$/);

    const second = await claimReorderReminder(
      { ...candidate, reorderReminderToken: "already-minted" },
      TENANT_A,
      cutoff,
      NOW,
    );
    expect(second.token).toBe("already-minted");
  });
});

// ── 5. The sweep, end to end ─────────────────────────────────────────────────

describe("runReorderReminderSweep", () => {
  const enable = (settings: Record<string, unknown>) => {
    prismaMock.tenants.findMany.mockResolvedValue([
      { id: TENANT_A, settings },
    ]);
    prismaMock.tenants.findFirst.mockResolvedValue(TENANT_ROW);
  };

  it("mails nobody for a store that has not switched it on", async () => {
    enable({});
    prismaMock.users.findMany.mockResolvedValue([CUSTOMER]);

    const outcome = await runReorderReminderSweep(NOW);

    expect(outcome).toEqual({ tenants: 0, queued: 0, perTenant: [] });
    expect(queueMock.add).not.toHaveBeenCalled();
  });

  it("queues one marketing job per person, with a real unsubscribe URL", async () => {
    enable({ reorderReminderEnabled: true });
    prismaMock.users.findMany.mockResolvedValue([CUSTOMER]);

    const outcome = await runReorderReminderSweep(NOW);

    expect(outcome.queued).toBe(1);
    expect(queueMock.add).toHaveBeenCalledTimes(1);

    const [, payload] = queueMock.add.mock.calls[0];
    expect(payload.to).toBe("jane@example.com");
    expect(payload.templateName).toBe(REORDER_REMINDER_EVENT);
    expect(payload.category).toBe("marketing");

    expect(payload.variables.unsubscribeUrl).toMatch(
      /^https:\/\/shop\.example\/api\/storefront\/newsletter\/unsubscribe\?token=/,
    );

    // US-020: the worker refuses a marketing job whose rendered body carries no
    // unsubscribe link, so the slot must be FILLED here — the worker only
    // compiles the payload's html when an event mapping replaced it. Asserted
    // through the worker's OWN guard rather than a substring match, because the
    // link in the body is Handlebars-escaped (`?token&#x3D;…`) and a naive
    // `includes` would pass only by accident of which form was compared.
    expect(payload.html).not.toContain(UNSUBSCRIBE_URL_SLOT);
    expect(
      resolveMarketingCompliance({
        category: payload.category,
        variables: payload.variables,
        html: payload.html,
      }),
    ).toEqual({ refuse: false, unsubscribeUrl: payload.variables.unsubscribeUrl });
  });

  it("writes the QUEUED log row before the job, linked by id", async () => {
    enable({ reorderReminderEnabled: true });
    prismaMock.users.findMany.mockResolvedValue([CUSTOMER]);

    await runReorderReminderSweep(NOW);

    const logged = prismaMock.email_logs.create.mock.calls[0][0].data;
    const [, payload] = queueMock.add.mock.calls[0];
    expect(logged.status).toBe("QUEUED");
    expect(logged.tenantId).toBe(TENANT_A);
    expect(logged.templateName).toBe(REORDER_REMINDER_EVENT);
    expect(payload.logId).toBe(logged.id);
  });

  it("queues nothing for a customer another sweep already claimed", async () => {
    enable({ reorderReminderEnabled: true });
    prismaMock.users.findMany.mockResolvedValue([CUSTOMER]);
    prismaMock.users.updateMany.mockResolvedValue({ count: 0 });

    const outcome = await runReorderReminderSweep(NOW);

    expect(outcome.queued).toBe(0);
    expect(outcome.perTenant[0]).toMatchObject({ due: 1, skipped: 1 });
    expect(queueMock.add).not.toHaveBeenCalled();
  });

  it("does not let one store's failure cost every store after it", async () => {
    // `enabledTenants` imposes no order, so an exception escaping the loop would
    // silently starve whichever stores happened to sort after the broken one.
    prismaMock.tenants.findMany.mockResolvedValue([
      { id: "tenant-broken", settings: { reorderReminderEnabled: true } },
      { id: TENANT_A, settings: { reorderReminderEnabled: true } },
    ]);
    prismaMock.tenants.findFirst.mockResolvedValue(TENANT_ROW);
    prismaMock.users.findMany
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValue([CUSTOMER]);

    const outcome = await runReorderReminderSweep(NOW);

    expect(outcome.perTenant[0]).toMatchObject({
      tenantId: "tenant-broken",
      queued: 0,
      error: "connection reset",
    });
    // The store after the failure still got its reminders.
    expect(outcome.perTenant[1]).toMatchObject({ tenantId: TENANT_A, queued: 1 });
    expect(outcome.queued).toBe(1);
  });

  it("applies the store's own window to the query", async () => {
    enable({ reorderReminderEnabled: true, reorderReminderDays: 90 });
    prismaMock.users.findMany.mockResolvedValue([]);

    await runReorderReminderSweep(NOW);

    const { where } = prismaMock.users.findMany.mock.calls[0][0];
    expect(where.AND).toContainEqual({
      orders: {
        none: { tenantId: TENANT_A, createdAt: { gt: reorderCutoff(NOW, 90) } },
      },
    });
  });
});

// ── 6. Content ───────────────────────────────────────────────────────────────

describe("the reminder body", () => {
  it("is shell-wrapped marketing HTML carrying the unsubscribe slot", async () => {
    const html = await renderReorderReminderHtml({
      businessName: "Healing Buds",
      subdomain: "healingbuds",
      customDomain: "shop.example",
      settings: { businessAddress: "1 Sample Street" },
    });

    expect(html).toContain(UNSUBSCRIBE_URL_SLOT);
    expect(html).toContain("1 Sample Street");
    // Buttons are styled anchors, never <button> — the sanitizer's rule.
    expect(html).toContain("Browse the store");
    expect(html).not.toContain("<button");
  });

  it("addresses somebody with no name as 'there' rather than blank", () => {
    const variables = reorderReminderVariables({
      tenant: {
        businessName: "Healing Buds",
        subdomain: "healingbuds",
        customDomain: "shop.example",
      },
      email: "jane@example.com",
      name: "   ",
      unsubscribeUrl: "https://shop.example/u?token=x",
    });

    expect(variables.userName).toBe("there");
    expect(variables.storeUrl).toBe("https://shop.example");
    expect(variables.businessAddress).toBe("");
  });
});

// ── 7. Getting off the list ──────────────────────────────────────────────────

describe("unsubscribeByToken, reorder-reminder token", () => {
  beforeEach(() => {
    prismaMock.newsletter_subscribers.findFirst.mockResolvedValue(null);
    prismaMock.campaign_recipients.findFirst.mockResolvedValue(null);
    prismaMock.newsletter_subscribers.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.email_suppressions.create.mockResolvedValue({});
  });

  it("suppresses the address and withdraws the consent it was sent under", async () => {
    prismaMock.users.findFirst.mockResolvedValue({
      id: "user-1",
      email: "Jane@Example.com",
    });

    expect(await unsubscribeByToken("reorder-token", TENANT_A, NOW)).toBe(
      "unsubscribe",
    );

    expect(prismaMock.email_suppressions.create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT_A,
        email: "jane@example.com",
        reason: "unsubscribed",
      },
    });
    expect(prismaMock.users.updateMany).toHaveBeenCalledWith({
      where: { id: "user-1", tenantId: TENANT_A, marketingConsentAt: { not: null } },
      data: { marketingConsentAt: null, updatedAt: NOW },
    });
  });

  it("looks the token up inside the tenant whose host served the request", async () => {
    prismaMock.users.findFirst.mockResolvedValue(null);

    expect(await unsubscribeByToken("someone-elses", TENANT_A, NOW)).toBe(
      "invalid",
    );
    expect(prismaMock.users.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reorderReminderToken: "someone-elses", tenantId: TENANT_A },
      }),
    );
  });
});
