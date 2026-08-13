import { beforeEach, describe, expect, it, vi } from "vitest";

// Email Phase 2 US-019 — fan-out against a fake queue transport.
//
// THE ASSERTION THAT MATTERS: three recipients produce three DISCRETE messages
// with three distinct `To:` values, never one message addressed to all three.
// A single sendMail with `to: string[]` would put the store's whole mailing
// list in every recipient's headers, and that cannot be walked back once it has
// been delivered.

const prismaMock = vi.hoisted(() => ({
  campaign_recipients: { createMany: vi.fn() },
  email_logs: { createMany: vi.fn() },
}));

const queueMock = vi.hoisted(() => ({ addBulk: vi.fn() }));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/queue", () => ({ getEmailQueue: () => queueMock }));

import { fanOutCampaign } from "@/lib/email/campaign-fan-out";
import { CAMPAIGN_TEMPLATE_NAME } from "@/lib/email/reserved-event-types";

const CAMPAIGN = {
  id: "campaign-1",
  tenantId: "tenant-a",
  subject: "October at {{businessName}}",
};

const TENANT = {
  businessName: "Healing Buds",
  subdomain: "healingbuds",
  customDomain: null,
};

const RECIPIENTS = [
  { email: "jane@example.com", userId: "user-1", name: "Jane Doe" },
  { email: "sam@example.com", userId: null, name: null },
  { email: "ravi@example.com", userId: "user-2", name: "Ravi" },
];

/** The jobs handed to the queue by the single addBulk this fan-out performs. */
function enqueuedJobs(): {
  name: string;
  data: Record<string, any>;
  opts: { delay: number };
}[] {
  expect(queueMock.addBulk).toHaveBeenCalledTimes(1);
  return queueMock.addBulk.mock.calls[0][0];
}

function writtenRows(fn: { mock: { calls: any[][] } }): Record<string, any>[] {
  expect(fn.mock.calls).toHaveLength(1);
  return fn.mock.calls[0][0].data;
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.campaign_recipients.createMany.mockResolvedValue({ count: 3 });
  prismaMock.email_logs.createMany.mockResolvedValue({ count: 3 });
  queueMock.addBulk.mockResolvedValue([]);
});

describe("fanOutCampaign", () => {
  it("enqueues one discrete message per recipient with distinct To: addresses", async () => {
    const result = await fanOutCampaign({
      campaign: CAMPAIGN,
      tenant: TENANT,
      recipients: RECIPIENTS,
    });

    expect(result.queued).toBe(3);

    const jobs = enqueuedJobs();
    expect(jobs).toHaveLength(3);

    const addresses = jobs.map((job) => job.data.to);
    expect(addresses).toEqual([
      "jane@example.com",
      "sam@example.com",
      "ravi@example.com",
    ]);
    expect(new Set(addresses).size).toBe(3);

    // One address per message, as a STRING. An array here is the leak.
    for (const job of jobs) {
      expect(typeof job.data.to).toBe("string");
      expect(Array.isArray(job.data.to)).toBe(false);
    }
  });

  it("marks every job as marketing so the worker checks suppression at send time", async () => {
    await fanOutCampaign({
      campaign: CAMPAIGN,
      tenant: TENANT,
      recipients: RECIPIENTS,
    });

    for (const job of enqueuedJobs()) {
      expect(job.data.category).toBe("marketing");
      // Reserved templateName: no event mapping can swap a campaign the author
      // approved for some other template.
      expect(job.data.templateName).toBe(CAMPAIGN_TEMPLATE_NAME);
    }
  });

  it("carries the linkage the worker writes outcomes through, and no HTML", async () => {
    await fanOutCampaign({
      campaign: CAMPAIGN,
      tenant: TENANT,
      recipients: RECIPIENTS,
    });

    const rows = writtenRows(prismaMock.campaign_recipients.createMany);
    const logs = writtenRows(prismaMock.email_logs.createMany);
    const jobs = enqueuedJobs();

    expect(jobs.map((job) => job.data.recipientId)).toEqual(
      rows.map((row) => row.id),
    );
    expect(jobs.map((job) => job.data.logId)).toEqual(logs.map((log) => log.id));
    expect(jobs.every((job) => job.data.campaignId === CAMPAIGN.id)).toBe(true);

    // The body is resolved from campaigns.contentHtml by the worker — shipping
    // a copy per recipient would put megabytes of identical HTML into Redis.
    expect(jobs.every((job) => job.data.html === undefined)).toBe(true);
  });

  it("gives every recipient their own unsubscribe token and link", async () => {
    await fanOutCampaign({
      campaign: CAMPAIGN,
      tenant: TENANT,
      recipients: RECIPIENTS,
    });

    const tokens = writtenRows(prismaMock.campaign_recipients.createMany).map(
      (row) => row.unsubscribeToken as string,
    );
    expect(new Set(tokens).size).toBe(3);
    expect(tokens.every((token) => token.length >= 20)).toBe(true);

    const links = enqueuedJobs().map((job) => job.data.variables.unsubscribeUrl);
    expect(new Set(links).size).toBe(3);
    links.forEach((link: string, index: number) => {
      // Built against the store's own canonical host, so a token minted here
      // cannot be redeemed on another store.
      expect(link).toContain("https://healingbuds.");
      expect(link).toContain(encodeURIComponent(tokens[index]));
    });
  });

  it("personalises the greeting per recipient", async () => {
    await fanOutCampaign({
      campaign: CAMPAIGN,
      tenant: TENANT,
      recipients: RECIPIENTS,
    });

    const names = enqueuedJobs().map((job) => job.data.variables.userName);
    expect(names[0]).toBe("Jane Doe");
    expect(names[1]).toBe("there");
    expect(names[2]).toBe("Ravi");
  });

  it("spaces the send to the per-tenant rate cap", async () => {
    const { ratePerMinute } = await fanOutCampaign({
      campaign: CAMPAIGN,
      tenant: TENANT,
      recipients: RECIPIENTS,
    });

    const delays = enqueuedJobs().map((job) => job.opts.delay);
    expect(delays[0]).toBe(0);
    expect(delays[1]).toBe(60_000 / ratePerMinute);
    expect(delays[2]).toBe((2 * 60_000) / ratePerMinute);
  });

  it("materialises the recipient rows as QUEUED with their customer linkage", async () => {
    await fanOutCampaign({
      campaign: CAMPAIGN,
      tenant: TENANT,
      recipients: RECIPIENTS,
    });

    const rows = writtenRows(prismaMock.campaign_recipients.createMany);
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.status === "QUEUED")).toBe(true);
    expect(rows.map((row) => row.userId)).toEqual(["user-1", null, "user-2"]);
    expect(
      prismaMock.campaign_recipients.createMany.mock.calls[0][0].skipDuplicates,
    ).toBe(true);
  });
});
