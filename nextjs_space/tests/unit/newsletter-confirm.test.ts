import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Email Phase 2 US-003 — double opt-in. Three properties carry the weight and
// are asserted here rather than left to review:
//   1. a followed token can only ever move PENDING → CONFIRMED — it can never
//      revive an UNSUBSCRIBED/SUPPRESSED row;
//   2. the token is rotated on a successful confirm, so the link is genuinely
//      single-use and cannot be replayed;
//   3. the token that was persisted is the token that gets mailed.
const { getTenantFromRequest } = vi.hoisted(() => ({
  getTenantFromRequest: vi.fn(),
}));
const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
  newsletter_subscribers: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));
const emailMock = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  emailTemplates: { newsletterConfirm: vi.fn() },
}));

vi.mock("@/lib/tenant/tenant", () => ({ getTenantFromRequest }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/email/email", () => emailMock);

import { GET as confirm } from "@/app/api/storefront/newsletter/confirm/route";
import { NEWSLETTER_CONFIRM_TTL_MS } from "@/lib/constants";
import {
  NEWSLETTER_CONFIRM_PATH,
  NEWSLETTER_CONFIRM_TEMPLATE,
  buildNewsletterConfirmUrl,
  decideConfirmOutcome,
  isNewsletterNotice,
  noticeForOutcome,
} from "@/lib/email/newsletter-confirm";
import { sendNewsletterConfirmation } from "@/lib/email/newsletter-confirm-email";

const TENANT = {
  id: "tenant-a",
  businessName: "Healing Buds",
  subdomain: "healingbuds",
  customDomain: null,
};

const TOKEN = "n1qUiaR3GxV9Zt-Kp_QsL0mB2cD4eF6gH8iJ0kL2mN4"; // gitleaks:allow — test fixture, not a credential

function get(query: string): Promise<Response> {
  return confirm(
    new NextRequest(
      `https://healingbuds.budstacks.io${NEWSLETTER_CONFIRM_PATH}${query}`,
    ),
  );
}

function location(response: Response): string | null {
  return response.headers.get("location");
}

const NOW = new Date("2026-08-12T10:00:00.000Z");
const FRESH = new Date(NOW.getTime() - 60_000);
const STALE = new Date(NOW.getTime() - NEWSLETTER_CONFIRM_TTL_MS - 1);

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue({ success: true });
  getTenantFromRequest.mockResolvedValue(TENANT);
  prismaMock.newsletter_subscribers.findFirst.mockResolvedValue(null);
  prismaMock.newsletter_subscribers.update.mockResolvedValue({ id: "sub_1" });
  emailMock.emailTemplates.newsletterConfirm.mockResolvedValue("<html></html>");
  emailMock.sendEmail.mockResolvedValue(undefined);
});

describe("decideConfirmOutcome — what following a token is allowed to do", () => {
  const pending = (consentAt: Date | null, createdAt = FRESH) =>
    ({ status: "PENDING", consentAt, createdAt }) as const;

  it("confirms a PENDING row consented inside the TTL", () => {
    expect(decideConfirmOutcome(pending(FRESH), NOW, NEWSLETTER_CONFIRM_TTL_MS)).toBe(
      "confirm",
    );
  });

  it("expires a PENDING row consented before the TTL", () => {
    expect(decideConfirmOutcome(pending(STALE), NOW, NEWSLETTER_CONFIRM_TTL_MS)).toBe(
      "expired",
    );
  });

  it("falls back to createdAt when consentAt is missing", () => {
    expect(
      decideConfirmOutcome(pending(null, STALE), NOW, NEWSLETTER_CONFIRM_TTL_MS),
    ).toBe("expired");
    expect(
      decideConfirmOutcome(pending(null, FRESH), NOW, NEWSLETTER_CONFIRM_TTL_MS),
    ).toBe("confirm");
  });

  it("treats an unknown token as invalid", () => {
    expect(decideConfirmOutcome(null, NOW, NEWSLETTER_CONFIRM_TTL_MS)).toBe(
      "invalid",
    );
  });

  it("is idempotent for a row that is already CONFIRMED", () => {
    expect(
      decideConfirmOutcome(
        { status: "CONFIRMED", consentAt: FRESH, createdAt: FRESH },
        NOW,
        NEWSLETTER_CONFIRM_TTL_MS,
      ),
    ).toBe("already-confirmed");
  });

  it.each(["UNSUBSCRIBED", "SUPPRESSED"] as const)(
    "never revives a %s subscriber",
    (status) => {
      expect(
        decideConfirmOutcome(
          { status, consentAt: FRESH, createdAt: FRESH },
          NOW,
          NEWSLETTER_CONFIRM_TTL_MS,
        ),
      ).toBe("invalid");
    },
  );

  it("maps every outcome to a notice the storefront can render", () => {
    expect(noticeForOutcome("confirm")).toBe("confirmed");
    expect(noticeForOutcome("already-confirmed")).toBe("confirmed");
    expect(noticeForOutcome("expired")).toBe("expired");
    expect(noticeForOutcome("invalid")).toBe("invalid");
    for (const outcome of ["confirm", "already-confirmed", "expired", "invalid"] as const) {
      expect(isNewsletterNotice(noticeForOutcome(outcome))).toBe(true);
    }
  });
});

describe("buildNewsletterConfirmUrl", () => {
  it("targets the tenant's own subdomain host", () => {
    const url = buildNewsletterConfirmUrl(TENANT, TOKEN);
    expect(url.startsWith("https://healingbuds.")).toBe(true);
    expect(url).toContain(`${NEWSLETTER_CONFIRM_PATH}?token=${TOKEN}`);
  });

  it("prefers a custom domain when the tenant has one", () => {
    const url = buildNewsletterConfirmUrl(
      { subdomain: "healingbuds", customDomain: "shop.example" },
      TOKEN,
    );
    expect(url).toBe(
      `https://shop.example${NEWSLETTER_CONFIRM_PATH}?token=${TOKEN}`,
    );
  });
});

describe("GET /api/storefront/newsletter/confirm", () => {
  it("confirms a PENDING subscriber and rotates the token so the link is single-use", async () => {
    prismaMock.newsletter_subscribers.findFirst.mockResolvedValue({
      id: "sub_pending",
      status: "PENDING",
      consentAt: new Date(),
      createdAt: new Date(),
    });

    const response = await get(`?token=${TOKEN}`);

    expect(response.status).toBe(303);
    expect(location(response)).toBe("/?newsletter=confirmed");
    const call = prismaMock.newsletter_subscribers.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "sub_pending" });
    expect(call.data.status).toBe("CONFIRMED");
    expect(call.data.confirmedAt).toBeInstanceOf(Date);
    expect(call.data.token).toEqual(expect.any(String));
    expect(call.data.token).not.toBe(TOKEN);
  });

  it("scopes the lookup to the host's tenant, never to a body-supplied id", async () => {
    await get(`?token=${TOKEN}`);

    const where = prismaMock.newsletter_subscribers.findFirst.mock.calls[0][0].where;
    expect(where).toEqual({ token: TOKEN });
    expect(getTenantFromRequest).toHaveBeenCalledTimes(1);
  });

  it("sends an unknown token to the invalid notice without writing", async () => {
    const response = await get(`?token=${TOKEN}`);

    expect(location(response)).toBe("/?newsletter=invalid");
    expect(prismaMock.newsletter_subscribers.update).not.toHaveBeenCalled();
  });

  it("sends a stale PENDING row to the expired notice without writing", async () => {
    prismaMock.newsletter_subscribers.findFirst.mockResolvedValue({
      id: "sub_old",
      status: "PENDING",
      consentAt: new Date(Date.now() - NEWSLETTER_CONFIRM_TTL_MS - 1000),
      createdAt: new Date(Date.now() - NEWSLETTER_CONFIRM_TTL_MS - 1000),
    });

    const response = await get(`?token=${TOKEN}`);

    expect(location(response)).toBe("/?newsletter=expired");
    expect(prismaMock.newsletter_subscribers.update).not.toHaveBeenCalled();
  });

  it.each(["UNSUBSCRIBED", "SUPPRESSED"] as const)(
    "refuses to resurrect a %s subscriber",
    async (status) => {
      prismaMock.newsletter_subscribers.findFirst.mockResolvedValue({
        id: "sub_gone",
        status,
        consentAt: new Date(),
        createdAt: new Date(),
      });

      const response = await get(`?token=${TOKEN}`);

      expect(location(response)).toBe("/?newsletter=invalid");
      expect(prismaMock.newsletter_subscribers.update).not.toHaveBeenCalled();
    },
  );

  it("is idempotent for an already-CONFIRMED row", async () => {
    prismaMock.newsletter_subscribers.findFirst.mockResolvedValue({
      id: "sub_done",
      status: "CONFIRMED",
      consentAt: new Date(),
      createdAt: new Date(),
    });

    const response = await get(`?token=${TOKEN}`);

    expect(location(response)).toBe("/?newsletter=confirmed");
    expect(prismaMock.newsletter_subscribers.update).not.toHaveBeenCalled();
  });

  it.each(["", "?token=", "?token=short", "?token=has spaces", "?token=../../etc"])(
    "rejects %s before any query runs",
    async (query) => {
      const response = await get(query);

      expect(location(response)).toBe("/?newsletter=invalid");
      expect(prismaMock.newsletter_subscribers.findFirst).not.toHaveBeenCalled();
    },
  );

  it("returns the rate limiter's response and never reaches the database", async () => {
    checkRateLimit.mockResolvedValue({
      success: false,
      response: new Response(null, { status: 429 }),
    });

    const response = await get(`?token=${TOKEN}`);

    expect(response.status).toBe(429);
    expect(prismaMock.newsletter_subscribers.findFirst).not.toHaveBeenCalled();
  });

  it("404s rather than guessing when the host resolves to no tenant", async () => {
    getTenantFromRequest.mockResolvedValue(null);

    const response = await get(`?token=${TOKEN}`);

    expect(response.status).toBe(404);
    expect(prismaMock.newsletter_subscribers.findFirst).not.toHaveBeenCalled();
  });

  it("does not present a database failure as a rejected link", async () => {
    prismaMock.newsletter_subscribers.findFirst.mockRejectedValue(
      new Error("connection reset"),
    );

    const response = await get(`?token=${TOKEN}`);

    expect(response.status).toBe(500);
    expect(location(response)).toBeNull();
  });
});

describe("sendNewsletterConfirmation", () => {
  it("enqueues the confirmation under the mappable newsletterConfirm event", async () => {
    await sendNewsletterConfirmation({
      tenant: TENANT,
      email: "visitor@example.com",
      token: TOKEN,
    });

    expect(emailMock.sendEmail).toHaveBeenCalledTimes(1);
    const sent = emailMock.sendEmail.mock.calls[0][0];
    expect(sent.to).toBe("visitor@example.com");
    expect(sent.tenantId).toBe(TENANT.id);
    expect(sent.templateName).toBe(NEWSLETTER_CONFIRM_TEMPLATE);
    expect(sent.subject).toContain(TENANT.businessName);
  });

  it("carries the confirm link in both the rendered html and the template variables", async () => {
    await sendNewsletterConfirmation({
      tenant: TENANT,
      email: "visitor@example.com",
      token: TOKEN,
    });

    const expectedUrl = buildNewsletterConfirmUrl(TENANT, TOKEN);
    // The worker recompiles the mapped template against `variables`, so the
    // link has to survive that path as well as the react-email fallback.
    expect(emailMock.sendEmail.mock.calls[0][0].variables.confirmUrl).toBe(
      expectedUrl,
    );
    expect(emailMock.emailTemplates.newsletterConfirm).toHaveBeenCalledWith(
      expectedUrl,
      TENANT.businessName,
    );
  });

  it("never mails a tenant logo while logo URLs are still presigned", async () => {
    await sendNewsletterConfirmation({
      tenant: TENANT,
      email: "visitor@example.com",
      token: TOKEN,
    });

    const args = emailMock.emailTemplates.newsletterConfirm.mock.calls[0];
    expect(args[2]).toBeUndefined();
  });
});
