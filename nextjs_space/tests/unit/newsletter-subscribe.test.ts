import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Email Phase 2 US-002 — the public storefront signup endpoint. Two properties
// carry the security weight and are asserted here rather than left to review:
//   1. a public POST can never move a subscriber BACKWARDS (CONFIRMED →
//      PENDING, or UNSUBSCRIBED/SUPPRESSED → PENDING);
//   2. the response is byte-identical whatever the address's prior state, so
//      the endpoint is not a subscriber-enumeration oracle.
const { getTenantFromRequest } = vi.hoisted(() => ({
  getTenantFromRequest: vi.fn(),
}));
const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
  newsletter_subscribers: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/tenant/tenant", () => ({ getTenantFromRequest }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST as subscribe } from "@/app/api/storefront/newsletter/subscribe/route";
import { decideSubscribeAction } from "@/lib/email/newsletter-subscriptions";
import {
  NEWSLETTER_SUBSCRIBE_ERROR,
  NEWSLETTER_SUBSCRIBE_PATH,
  subscribeToNewsletter,
} from "@/lib/email/newsletter-signup";

const TENANT = { id: "tenant-a", subdomain: "healingbuds" };

function post(body: unknown): Promise<Response> {
  return subscribe(
    new NextRequest("https://healingbuds.budstacks.io/api/storefront/newsletter/subscribe", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

const validBody = { email: "Visitor@Example.COM ", source: "storefront-cta" };

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue({ success: true });
  getTenantFromRequest.mockResolvedValue(TENANT);
  prismaMock.newsletter_subscribers.findFirst.mockResolvedValue(null);
  prismaMock.newsletter_subscribers.create.mockResolvedValue({ id: "sub_1" });
  prismaMock.newsletter_subscribers.update.mockResolvedValue({ id: "sub_1" });
});

describe("decideSubscribeAction — a public signup never downgrades a subscriber", () => {
  it("creates when the address is unknown", () => {
    expect(decideSubscribeAction(null)).toBe("create");
  });

  it("refreshes a PENDING row so a fresh confirmation link can be issued", () => {
    expect(decideSubscribeAction("PENDING")).toBe("refresh");
  });

  it.each(["CONFIRMED", "UNSUBSCRIBED", "SUPPRESSED"] as const)(
    "leaves a %s subscriber untouched",
    (status) => {
      expect(decideSubscribeAction(status)).toBe("ignore");
    },
  );
});

describe("POST /api/storefront/newsletter/subscribe", () => {
  it("creates a PENDING row with a fresh token and a normalised email", async () => {
    const response = await post(validBody);

    expect(response.status).toBe(200);
    expect(prismaMock.newsletter_subscribers.create).toHaveBeenCalledTimes(1);
    const { data } = prismaMock.newsletter_subscribers.create.mock.calls[0][0];
    expect(data.email).toBe("visitor@example.com");
    expect(data.status).toBe("PENDING");
    expect(data.source).toBe("storefront-cta");
    expect(data.consentAt).toBeInstanceOf(Date);
    expect(data.token).toEqual(expect.any(String));
    expect(data.token.length).toBeGreaterThan(20);
    // tenantId is never taken from the body — the lib/db.ts scope layer stamps
    // it from the bound context the route resolved off the request host.
    expect(data.tenantId).toBeUndefined();
  });

  it("refreshes the token of a PENDING row without touching its status", async () => {
    prismaMock.newsletter_subscribers.findFirst.mockResolvedValue({
      id: "sub_pending",
      status: "PENDING",
    });

    await post(validBody);

    expect(prismaMock.newsletter_subscribers.create).not.toHaveBeenCalled();
    const call = prismaMock.newsletter_subscribers.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: "sub_pending" });
    expect(call.data.token).toEqual(expect.any(String));
    expect(call.data).not.toHaveProperty("status");
  });

  it.each(["CONFIRMED", "UNSUBSCRIBED", "SUPPRESSED"] as const)(
    "writes nothing for a %s subscriber",
    async (status) => {
      prismaMock.newsletter_subscribers.findFirst.mockResolvedValue({
        id: "sub_x",
        status,
      });

      const response = await post(validBody);

      expect(response.status).toBe(200);
      expect(prismaMock.newsletter_subscribers.create).not.toHaveBeenCalled();
      expect(prismaMock.newsletter_subscribers.update).not.toHaveBeenCalled();
    },
  );

  it("answers identically for a new address and an already-CONFIRMED one", async () => {
    const fresh = await (await post(validBody)).json();

    prismaMock.newsletter_subscribers.findFirst.mockResolvedValue({
      id: "sub_known",
      status: "CONFIRMED",
    });
    const known = await (await post(validBody)).json();

    expect(known).toEqual(fresh);
  });

  it("treats a lost create race (P2002) as success without clobbering the row", async () => {
    prismaMock.newsletter_subscribers.create.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    const response = await post(validBody);

    expect(response.status).toBe(200);
    expect(prismaMock.newsletter_subscribers.update).not.toHaveBeenCalled();
  });

  it("rejects an invalid email before any query runs", async () => {
    const response = await post({ email: "not-an-email", source: "storefront-cta" });

    expect(response.status).toBe(400);
    expect(prismaMock.newsletter_subscribers.findFirst).not.toHaveBeenCalled();
  });

  it("rejects an unknown source value", async () => {
    const response = await post({ email: "a@b.com", source: "../../admin" });

    expect(response.status).toBe(400);
    expect(prismaMock.newsletter_subscribers.create).not.toHaveBeenCalled();
  });

  it("returns the rate limiter's response and never reaches the database", async () => {
    checkRateLimit.mockResolvedValue({
      success: false,
      response: new Response(null, { status: 429 }),
    });

    const response = await post(validBody);

    expect(response.status).toBe(429);
    expect(prismaMock.newsletter_subscribers.findFirst).not.toHaveBeenCalled();
  });

  it("404s rather than guessing when the host resolves to no tenant", async () => {
    getTenantFromRequest.mockResolvedValue(null);

    const response = await post(validBody);

    expect(response.status).toBe(404);
    expect(prismaMock.newsletter_subscribers.create).not.toHaveBeenCalled();
  });

  it("rejects a body slug that disagrees with the host's tenant", async () => {
    const response = await post({ ...validBody, tenantSlug: "someone-else" });

    expect(response.status).toBe(400);
    expect(prismaMock.newsletter_subscribers.create).not.toHaveBeenCalled();
  });
});

// The storefront call sites (Newsletter.tsx, educational-content.tsx) render
// success or an error purely off this helper's result, so its failure mapping
// is what stops the success copy lying again.
describe("subscribeToNewsletter — the storefront's success/error signal", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  it("POSTs the signup to the shared endpoint path", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true })));

    const result = await subscribeToNewsletter({
      email: "visitor@example.com",
      source: "storefront-cta",
      tenantSlug: "healingbuds",
    });

    expect(result.ok).toBe(true);
    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe(NEWSLETTER_SUBSCRIBE_PATH);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      email: "visitor@example.com",
      source: "storefront-cta",
      tenantSlug: "healingbuds",
    });
  });

  it("surfaces the server's vetted message on a rejected signup", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "Please enter a valid email address." }), {
        status: 400,
      }),
    );

    expect(await subscribeToNewsletter({ email: "x", source: "storefront-cta" })).toEqual({
      ok: false,
      message: "Please enter a valid email address.",
    });
  });

  it("falls back to generic copy when the failure carries no message", async () => {
    fetchMock.mockResolvedValue(new Response("<html>gateway</html>", { status: 502 }));

    expect(await subscribeToNewsletter({ email: "a@b.com", source: "checkout" })).toEqual({
      ok: false,
      message: NEWSLETTER_SUBSCRIBE_ERROR,
    });
  });

  it("reports failure — never success — when the request never lands", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    expect(await subscribeToNewsletter({ email: "a@b.com", source: "checkout" })).toEqual({
      ok: false,
      message: NEWSLETTER_SUBSCRIBE_ERROR,
    });
  });
});
