import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Email Phase 2 US-004 — unsubscribe. Four properties carry the weight:
//   1. GET only ASKS; nothing is written, because mail scanners follow links;
//   2. POST works with no cookies and no headers (RFC 8058 one-click target);
//   3. unsubscribing writes BOTH the subscriber flip and the suppression row —
//      the row is what every future marketing send is actually checked against;
//   4. the token is never rotated (it lives in already-delivered footers) and a
//      terminal row is never downgraded.
const { getTenantFromRequest } = vi.hoisted(() => ({
  getTenantFromRequest: vi.fn(),
}));
const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
  newsletter_subscribers: {
    findFirst: vi.fn(),
    update: vi.fn(),
    // US-019 reaches this one when a campaign token is redeemed: the recipient
    // may have no subscriber row of their own, but if one exists for the same
    // address it must not be left looking mailable.
    updateMany: vi.fn(),
  },
  campaign_recipients: {
    // The second token shape the same URL accepts (US-019).
    findFirst: vi.fn(),
  },
  email_suppressions: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/tenant/tenant", () => ({ getTenantFromRequest }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import {
  GET as unsubscribeGet,
  POST as unsubscribePost,
} from "@/app/api/storefront/newsletter/unsubscribe/route";
import {
  NEWSLETTER_UNSUBSCRIBE_PATH,
  buildNewsletterUnsubscribeUrl,
  decideUnsubscribeOutcome,
} from "@/lib/email/newsletter-unsubscribe";

const TENANT = {
  id: "tenant-a",
  businessName: "Healing Buds",
  subdomain: "healingbuds",
  customDomain: null,
};

const TOKEN = "n1qUiaR3GxV9Zt-Kp_QsL0mB2cD4eF6gH8iJ0kL2mN4";
const SUBSCRIBER = {
  id: "sub_1",
  tenantId: TENANT.id,
  email: "reader@example.com",
  status: "CONFIRMED" as const,
};

function url(query: string): string {
  return `https://healingbuds.budstacks.io${NEWSLETTER_UNSUBSCRIBE_PATH}${query}`;
}

function get(query: string): Promise<Response> {
  return unsubscribeGet(new NextRequest(url(query)));
}

/**
 * Deliberately built with NOTHING but a method — no cookies, no origin, no
 * content-type. This is the shape a mail provider's one-click POST arrives in,
 * and the route has to answer it.
 */
function postOneClick(query: string): Promise<Response> {
  return unsubscribePost(new NextRequest(url(query), { method: "POST" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue({ success: true });
  getTenantFromRequest.mockResolvedValue(TENANT);
  prismaMock.newsletter_subscribers.findFirst.mockResolvedValue(null);
  prismaMock.newsletter_subscribers.update.mockResolvedValue({ id: "sub_1" });
  prismaMock.newsletter_subscribers.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.campaign_recipients.findFirst.mockResolvedValue(null);
  prismaMock.email_suppressions.create.mockResolvedValue({ id: "sup_1" });
});

describe("decideUnsubscribeOutcome — what following a token may do", () => {
  it.each(["PENDING", "CONFIRMED"] as const)(
    "unsubscribes a %s subscriber",
    (status) => {
      expect(decideUnsubscribeOutcome({ status })).toBe("unsubscribe");
    },
  );

  it.each(["UNSUBSCRIBED", "SUPPRESSED"] as const)(
    "treats an already-terminal %s row as done, not as an error",
    (status) => {
      expect(decideUnsubscribeOutcome({ status })).toBe("already-unsubscribed");
    },
  );

  it("treats an unknown token as invalid", () => {
    expect(decideUnsubscribeOutcome(null)).toBe("invalid");
  });
});

describe("buildNewsletterUnsubscribeUrl", () => {
  it("targets the tenant's own subdomain host", () => {
    expect(buildNewsletterUnsubscribeUrl(TENANT, TOKEN)).toContain(
      `${NEWSLETTER_UNSUBSCRIBE_PATH}?token=${TOKEN}`,
    );
  });

  it("prefers a custom domain when the tenant has one", () => {
    expect(
      buildNewsletterUnsubscribeUrl(
        { subdomain: "healingbuds", customDomain: "shop.example" },
        TOKEN,
      ),
    ).toBe(`https://shop.example${NEWSLETTER_UNSUBSCRIBE_PATH}?token=${TOKEN}`);
  });
});

describe("GET — the confirmation page", () => {
  it("renders a POST form back to itself carrying the token", async () => {
    const response = await get(`?token=${TOKEN}`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(html).toContain('method="post"');
    expect(html).toContain(`${NEWSLETTER_UNSUBSCRIBE_PATH}?token=${TOKEN}`);
    expect(html).toContain(TENANT.businessName);
  });

  it("writes nothing — a mail scanner following the link must not unsubscribe anyone", async () => {
    prismaMock.newsletter_subscribers.findFirst.mockResolvedValue(SUBSCRIBER);

    await get(`?token=${TOKEN}`);

    expect(prismaMock.newsletter_subscribers.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.newsletter_subscribers.update).not.toHaveBeenCalled();
    expect(prismaMock.email_suppressions.create).not.toHaveBeenCalled();
  });

  it("is never cached or indexed", async () => {
    const response = await get(`?token=${TOKEN}`);

    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("escapes a hostile store name rather than reflecting it", async () => {
    getTenantFromRequest.mockResolvedValue({
      ...TENANT,
      businessName: '<script>alert("x")</script>',
    });

    const html = await (await get(`?token=${TOKEN}`)).text();

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it.each(["", "?token=", "?token=short", "?token=has spaces", "?token=../../etc"])(
    "shows the invalid page for %s without querying",
    async (query) => {
      const html = await (await get(query)).text();

      expect(html).toContain("no longer valid");
      expect(prismaMock.newsletter_subscribers.findFirst).not.toHaveBeenCalled();
    },
  );

  it("404s rather than guessing when the host resolves to no tenant", async () => {
    getTenantFromRequest.mockResolvedValue(null);

    expect((await get(`?token=${TOKEN}`)).status).toBe(404);
  });
});

describe("POST — the RFC 8058 one-click target", () => {
  it("unsubscribes a confirmed subscriber with no cookies or headers at all", async () => {
    prismaMock.newsletter_subscribers.findFirst.mockResolvedValue(SUBSCRIBER);

    const response = await postOneClick(`?token=${TOKEN}`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("You're unsubscribed");

    const update = prismaMock.newsletter_subscribers.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: SUBSCRIBER.id });
    expect(update.data.status).toBe("UNSUBSCRIBED");
    expect(update.data.unsubscribedAt).toBeInstanceOf(Date);
  });

  it("writes the suppression row that gates every future marketing send", async () => {
    prismaMock.newsletter_subscribers.findFirst.mockResolvedValue(SUBSCRIBER);

    await postOneClick(`?token=${TOKEN}`);

    expect(prismaMock.email_suppressions.create).toHaveBeenCalledWith({
      data: {
        tenantId: TENANT.id,
        email: SUBSCRIBER.email,
        reason: "unsubscribed",
      },
    });
  });

  it("does NOT rotate the token — the link lives in already-delivered footers", async () => {
    prismaMock.newsletter_subscribers.findFirst.mockResolvedValue(SUBSCRIBER);

    await postOneClick(`?token=${TOKEN}`);

    const update = prismaMock.newsletter_subscribers.update.mock.calls[0][0];
    expect(update.data).not.toHaveProperty("token");
  });

  it("scopes the lookup to the host's tenant, never to a request-supplied id", async () => {
    await postOneClick(`?token=${TOKEN}`);

    expect(
      prismaMock.newsletter_subscribers.findFirst.mock.calls[0][0].where,
    ).toEqual({ token: TOKEN });
    expect(getTenantFromRequest).toHaveBeenCalledTimes(1);
  });

  it("is idempotent: a second click neither errors nor rewrites the row", async () => {
    prismaMock.newsletter_subscribers.findFirst.mockResolvedValue({
      ...SUBSCRIBER,
      status: "UNSUBSCRIBED",
    });

    const response = await postOneClick(`?token=${TOKEN}`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("You're unsubscribed");
    expect(prismaMock.newsletter_subscribers.update).not.toHaveBeenCalled();
    // …but the suppression row is still asserted, so a row that reached
    // UNSUBSCRIBED by some other path is repaired rather than left mailable.
    expect(prismaMock.email_suppressions.create).toHaveBeenCalledTimes(1);
  });

  it("never downgrades a SUPPRESSED row to UNSUBSCRIBED", async () => {
    prismaMock.newsletter_subscribers.findFirst.mockResolvedValue({
      ...SUBSCRIBER,
      status: "SUPPRESSED",
    });

    await postOneClick(`?token=${TOKEN}`);

    expect(prismaMock.newsletter_subscribers.update).not.toHaveBeenCalled();
    expect(prismaMock.email_suppressions.create).toHaveBeenCalledTimes(1);
  });

  it("answers an unknown token calmly and writes nothing", async () => {
    const response = await postOneClick(`?token=${TOKEN}`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain("no longer valid");
    expect(prismaMock.newsletter_subscribers.update).not.toHaveBeenCalled();
    expect(prismaMock.email_suppressions.create).not.toHaveBeenCalled();
  });

  it("does not claim success when the write failed", async () => {
    prismaMock.newsletter_subscribers.findFirst.mockResolvedValue(SUBSCRIBER);
    prismaMock.newsletter_subscribers.update.mockRejectedValue(
      new Error("connection reset"),
    );

    const response = await postOneClick(`?token=${TOKEN}`);

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("unsubscribed");
  });

  it("returns the rate limiter's response and never reaches the database", async () => {
    checkRateLimit.mockResolvedValue({
      success: false,
      response: new Response(null, { status: 429 }),
    });

    const response = await postOneClick(`?token=${TOKEN}`);

    expect(response.status).toBe(429);
    expect(prismaMock.newsletter_subscribers.findFirst).not.toHaveBeenCalled();
  });
});
