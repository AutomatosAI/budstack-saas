import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Email Phase 2 US-027 — the two public tracking routes and the tenant switch.
//
// Module-boundary mocks only (prisma, tenant resolution, the rate limiter, and
// getCurrentUser for the admin route). The REAL auth wrapper and the REAL
// permission resolver execute, so the gates below are asserted against
// production's own matrix rather than a stub of it.
//
// The two properties the public routes are held to:
//
//   - THE PIXEL ALWAYS ARRIVES. A forged token, an unknown host, a store that
//     turned tracking off, a throttled caller, a database that throws — every
//     one of them still gets 200 image/gif. A recipient reading their mail is
//     not making a request they can act on the answer to.
//   - A LINK IS NEVER FOLLOWED UNVERIFIED. Anything this platform did not sign
//     for THIS tenant gets a 400 page and no redirect: forwarding it would be
//     an open redirect wearing the store's own domain.

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const { getTenantFromRequest } = vi.hoisted(() => ({
  getTenantFromRequest: vi.fn(),
}));
const { createAuditLog } = vi.hoisted(() => ({ createAuditLog: vi.fn() }));

const prismaMock = vi.hoisted(() => ({
  tenants: { findFirst: vi.fn(), update: vi.fn() },
  campaign_recipients: { findFirst: vi.fn(), updateMany: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit }));
vi.mock("@/lib/tenant/tenant", () => ({ getTenantFromRequest }));
vi.mock("@/lib/audit-log", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/audit-log")>();
  return { ...actual, createAuditLog, getClientInfo: () => ({}) };
});

import { GET as clickRoute } from "@/app/api/storefront/email/click/route";
import { GET as openRoute } from "@/app/api/storefront/email/open/route";
import {
  GET as readSettings,
  PATCH as writeSettings,
} from "@/app/api/tenant-admin/email-settings/route";
import { EMAIL_TRACKING_SETTING } from "@/lib/email/email-tracking";
import {
  encodeClickTarget,
  signClickTarget,
  signRecipientToken,
} from "@/lib/email/tracking-token";
import { buildPermissionSet } from "@/lib/permissions/permission-keys";
import { resolvePermissions } from "@/lib/permissions/resolve";

const TENANT_ID = "tenant-a";
const OTHER_TENANT_ID = "tenant-b";
const RECIPIENT_ID = "11111111-1111-1111-1111-111111111111";
const DESTINATION = "https://shop.example/products/blue-dream";
const HOST = "https://shop.example";

const TRACKING_ON = { [EMAIL_TRACKING_SETTING]: true };

function request(path: string) {
  return new NextRequest(`${HOST}${path}`);
}

function openUrl(token: string) {
  return `/api/storefront/email/open?t=${encodeURIComponent(token)}`;
}

function clickUrl(
  token: string,
  target = encodeClickTarget(DESTINATION),
  signature = signClickTarget(TENANT_ID, DESTINATION),
) {
  return `/api/storefront/email/click?u=${target}&s=${signature}&t=${encodeURIComponent(token)}`;
}

/** The store the request host resolves to, and what its settings say. */
function storefront(settings: unknown = TRACKING_ON) {
  getTenantFromRequest.mockResolvedValue({ id: TENANT_ID, businessName: "HB" });
  prismaMock.tenants.findFirst.mockResolvedValue({ settings });
}

/** A recipient row this tenant owns. */
function recipientExists(owned = true) {
  prismaMock.campaign_recipients.findFirst.mockResolvedValue(
    owned ? { id: RECIPIENT_ID } : null,
  );
  prismaMock.campaign_recipients.updateMany.mockResolvedValue({ count: 1 });
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue({ success: true });
});

// ── The open pixel ──────────────────────────────────────────────────────────

describe("GET /api/storefront/email/open", () => {
  /**
   * Asserted on the GIF's own structure rather than a byte count: what matters
   * is that a mail client receives a decodable 1×1, and a magic number would
   * fail for a pixel that was merely re-encoded.
   */
  async function expectPixel(response: Response) {
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/gif");
    expect(response.headers.get("cache-control")).toContain("no-store");

    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes.subarray(0, 6).toString("latin1")).toBe("GIF89a");
    expect(bytes.readUInt16LE(6)).toBe(1); // width
    expect(bytes.readUInt16LE(8)).toBe(1); // height
    expect(bytes[bytes.length - 1]).toBe(0x3b); // trailer
  }

  it("stamps the first open and returns the pixel", async () => {
    storefront();
    recipientExists();

    await expectPixel(await openRoute(request(openUrl(signRecipientToken(RECIPIENT_ID)))));

    expect(prismaMock.campaign_recipients.updateMany).toHaveBeenCalledWith({
      // The null guard is what makes it FIRST-open-wins: an inbox re-fetches
      // images on every scroll, and a counter here would be a behavioural log.
      where: { id: RECIPIENT_ID, openedAt: null },
      data: { openedAt: expect.any(Date) },
    });
  });

  it("scopes the lookup to the store whose host served the request", async () => {
    storefront();
    recipientExists();

    await openRoute(request(openUrl(signRecipientToken(RECIPIENT_ID))));

    expect(prismaMock.campaign_recipients.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: RECIPIENT_ID, campaigns: { tenantId: TENANT_ID } },
      }),
    );
  });

  it("records nothing for a forged or absent token, and still answers", async () => {
    storefront();
    recipientExists();

    for (const token of [`${RECIPIENT_ID}.forged`, "", RECIPIENT_ID]) {
      await expectPixel(await openRoute(request(openUrl(token))));
    }
    expect(prismaMock.campaign_recipients.findFirst).not.toHaveBeenCalled();
  });

  it("records nothing once the store turns tracking off", async () => {
    // The artifacts are already in somebody's inbox and cannot be un-sent —
    // this is what makes them inert.
    storefront({});
    recipientExists();

    await expectPixel(await openRoute(request(openUrl(signRecipientToken(RECIPIENT_ID)))));

    expect(prismaMock.campaign_recipients.updateMany).not.toHaveBeenCalled();
  });

  it("records nothing when no store answers for this host", async () => {
    getTenantFromRequest.mockResolvedValue(null);

    await expectPixel(await openRoute(request(openUrl(signRecipientToken(RECIPIENT_ID)))));

    expect(prismaMock.campaign_recipients.findFirst).not.toHaveBeenCalled();
  });

  it("serves the pixel to a throttled caller, writing nothing", async () => {
    storefront();
    recipientExists();
    checkRateLimit.mockResolvedValue({ success: false, response: null });

    await expectPixel(await openRoute(request(openUrl(signRecipientToken(RECIPIENT_ID)))));

    expect(prismaMock.campaign_recipients.updateMany).not.toHaveBeenCalled();
  });

  it("cannot be given a fresh rate-limit bucket by a forged forwarded-for", async () => {
    storefront();
    recipientExists();

    const forged = new NextRequest(
      `${HOST}${openUrl(signRecipientToken(RECIPIENT_ID))}`,
      { headers: { "x-forwarded-for": "1.2.3.4, 203.0.113.9" } },
    );
    await openRoute(forged);

    // Rightmost public hop — the one the trusted edge appended.
    expect(checkRateLimit).toHaveBeenCalledWith(
      "email-open:203.0.113.9",
      expect.anything(),
    );
  });

  it("serves the pixel when the limiter never answers", async () => {
    storefront();
    recipientExists();
    checkRateLimit.mockReturnValue(new Promise(() => {}));

    await expectPixel(await openRoute(request(openUrl(signRecipientToken(RECIPIENT_ID)))));
  }, 10_000);

  it("serves the pixel when the database throws", async () => {
    storefront();
    prismaMock.campaign_recipients.findFirst.mockRejectedValue(
      new Error("connection lost"),
    );

    await expectPixel(await openRoute(request(openUrl(signRecipientToken(RECIPIENT_ID)))));
  });
});

// ── The click redirect ──────────────────────────────────────────────────────

describe("GET /api/storefront/email/click", () => {
  it("redirects to the signed destination and stamps the click", async () => {
    storefront();
    recipientExists();

    const response = await clickRoute(
      request(clickUrl(signRecipientToken(RECIPIENT_ID))),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(DESTINATION);
    expect(prismaMock.campaign_recipients.updateMany).toHaveBeenCalledWith({
      where: { id: RECIPIENT_ID, clickedAt: null },
      data: { clickedAt: expect.any(Date) },
    });
  });

  it("refuses a destination this platform did not sign — the open redirect", async () => {
    storefront();

    const response = await clickRoute(
      request(
        clickUrl(
          signRecipientToken(RECIPIENT_ID),
          encodeClickTarget("https://phishing.example/login"),
        ),
      ),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("location")).toBeNull();
    expect(await response.text()).toContain("can't confirm it is one we sent");
  });

  it("refuses one store's link replayed on another store's host", async () => {
    storefront();

    const response = await clickRoute(
      request(
        clickUrl(
          signRecipientToken(RECIPIENT_ID),
          encodeClickTarget(DESTINATION),
          signClickTarget(OTHER_TENANT_ID, DESTINATION),
        ),
      ),
    );

    expect(response.status).toBe(400);
  });

  it("refuses everything when no store answers for this host", async () => {
    getTenantFromRequest.mockResolvedValue(null);

    const response = await clickRoute(
      request(clickUrl(signRecipientToken(RECIPIENT_ID))),
    );

    expect(response.status).toBe(400);
  });

  it("still follows the link when the token is empty or forged", async () => {
    // A message compiled after tracking was switched off carries `t=`. The
    // author's link has to keep working regardless of what we can measure.
    storefront();

    for (const token of ["", `${RECIPIENT_ID}.forged`]) {
      const response = await clickRoute(request(clickUrl(token)));
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(DESTINATION);
    }
    expect(prismaMock.campaign_recipients.findFirst).not.toHaveBeenCalled();
  });

  it("still follows the link once the store turns tracking off", async () => {
    storefront({});
    recipientExists();

    const response = await clickRoute(
      request(clickUrl(signRecipientToken(RECIPIENT_ID))),
    );

    expect(response.status).toBe(302);
    expect(prismaMock.campaign_recipients.updateMany).not.toHaveBeenCalled();
  });

  it("still follows the link when the write throws", async () => {
    storefront();
    prismaMock.campaign_recipients.findFirst.mockRejectedValue(
      new Error("connection lost"),
    );

    const response = await clickRoute(
      request(clickUrl(signRecipientToken(RECIPIENT_ID))),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(DESTINATION);
  });

  // Ordering: structure, then Redis, then Postgres. An unauthenticated flood
  // must not be able to buy a tenant lookup per request on the connection pool
  // every store on the platform shares.
  describe("costs nothing for a request that cannot be one of ours", () => {
    it("refuses a bare request without resolving a tenant or metering", async () => {
      storefront();

      const response = await clickRoute(request("/api/storefront/email/click"));

      expect(response.status).toBe(400);
      expect(getTenantFromRequest).not.toHaveBeenCalled();
      expect(checkRateLimit).not.toHaveBeenCalled();
    });

    it("refuses junk, a non-canonical encoding and an oversized signature first", async () => {
      storefront();

      const cases = [
        "?u=%%%&s=x",
        // A destination no redirect may follow, however it is signed.
        `?u=${encodeClickTarget("javascript:alert(1)")}&s=x`,
        `?u=${encodeClickTarget("//evil.example/x")}&s=x`,
        // Padded: decodes to the same URL, but is not the string that was
        // signed, so honouring it would widen what a signature covers.
        `?u=${encodeClickTarget(DESTINATION)}=&s=x`,
        `?u=${encodeClickTarget(DESTINATION)}&s=${"x".repeat(500)}`,
      ];

      for (const query of cases) {
        const response = await clickRoute(
          request(`/api/storefront/email/click${query}`),
        );
        expect(response.status).toBe(400);
      }
      expect(getTenantFromRequest).not.toHaveBeenCalled();
    });

    it("meters before the database, and refuses rather than guessing", async () => {
      storefront();
      checkRateLimit.mockResolvedValue({ success: false, response: null });

      const response = await clickRoute(
        request(clickUrl(signRecipientToken(RECIPIENT_ID))),
      );

      expect(response.status).toBe(400);
      expect(getTenantFromRequest).not.toHaveBeenCalled();
    });

    it("follows the link anyway when the limiter never answers", async () => {
      // Observed for real with no local Redis: `checkRateLimit`'s fail-open is
      // a catch, but ioredis is built with `maxRetriesPerRequest: null` and
      // queues commands forever while disconnected, so the await never settles.
      // Unabandoned, that is every link in every campaign hanging.
      storefront();
      recipientExists();
      checkRateLimit.mockReturnValue(new Promise(() => {}));

      const response = await clickRoute(
        request(clickUrl(signRecipientToken(RECIPIENT_ID))),
      );

      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(DESTINATION);
    }, 10_000);

    it("cannot be given a fresh rate-limit bucket by a forged forwarded-for", async () => {
      storefront();
      recipientExists();

      // The leading hop is client-supplied. Keying on it would let one caller
      // mint a bucket per request and make the cap decorative.
      const forged = new NextRequest(
        `${HOST}${clickUrl(signRecipientToken(RECIPIENT_ID))}`,
        {
          headers: {
            "x-forwarded-for": "1.2.3.4, 203.0.113.9",
            "cf-connecting-ip": "203.0.113.9",
          },
        },
      );
      await clickRoute(forged);

      expect(checkRateLimit).toHaveBeenCalledWith(
        "email-click:203.0.113.9",
        expect.anything(),
      );
    });
  });
});

// ── The tenant switch ───────────────────────────────────────────────────────

describe("/api/tenant-admin/email-settings", () => {
  function signInAs(permissions: ReturnType<typeof buildPermissionSet>) {
    getCurrentUser.mockResolvedValue({
      id: "admin_1",
      email: "admin@store.dev",
      name: "Admin",
      image: "",
      role: "TENANT_ADMIN",
      tenantId: TENANT_ID,
      clerkOrgId: null,
    });
    resolveUserPermissions.mockResolvedValue({ teamRole: null, permissions });
  }

  function signInAsOwner() {
    signInAs(resolvePermissions({ role: "TENANT_ADMIN", teamRole: null }));
  }

  function patch(body: unknown) {
    return new NextRequest(`${HOST}/api/tenant-admin/email-settings`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("reads the flag, defaulting a silent settings blob to off", async () => {
    signInAsOwner();
    prismaMock.tenants.findFirst.mockResolvedValue({ settings: {} });

    const response = await readSettings(
      request("/api/tenant-admin/email-settings"),
    );

    expect(response.status).toBe(200);
    // US-028 put the reorder-reminder rule on the same endpoint, so the body
    // carries every email switch. The property that matters here is unchanged:
    // a blob that never mentioned tracking reads as off.
    expect(await response.json()).toMatchObject({
      [EMAIL_TRACKING_SETTING]: false,
    });
  });

  it("turns tracking on without disturbing the rest of the blob", async () => {
    signInAsOwner();
    // The blob also holds SMTP credentials and branding — this route knows
    // about exactly one key and must not flatten the others.
    prismaMock.tenants.findFirst.mockResolvedValue({
      settings: { smtp: { host: "smtp.example" }, primaryColor: "#7c3aed" },
    });
    prismaMock.tenants.update.mockResolvedValue({});

    const response = await writeSettings(
      patch({ [EMAIL_TRACKING_SETTING]: true }),
    );

    expect(response.status).toBe(200);
    expect(prismaMock.tenants.update).toHaveBeenCalledWith({
      where: { id: TENANT_ID },
      data: {
        settings: {
          smtp: { host: "smtp.example" },
          primaryColor: "#7c3aed",
          [EMAIL_TRACKING_SETTING]: true,
        },
      },
    });
  });

  it("writes an audit row naming the transition", async () => {
    signInAsOwner();
    prismaMock.tenants.findFirst.mockResolvedValue({ settings: TRACKING_ON });
    prismaMock.tenants.update.mockResolvedValue({});

    await writeSettings(patch({ [EMAIL_TRACKING_SETTING]: false }));

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entityId: TENANT_ID,
        metadata: expect.objectContaining({
          // US-028: the route now writes several switches, so the row names the
          // keys this request touched and carries every switch either side of
          // it — a superset of the single `setting` it named before.
          settings: [EMAIL_TRACKING_SETTING],
          previous: expect.objectContaining({ [EMAIL_TRACKING_SETTING]: true }),
          next: expect.objectContaining({ [EMAIL_TRACKING_SETTING]: false }),
        }),
      }),
    );
  });

  it("rejects a body that is not a boolean flag", async () => {
    signInAsOwner();
    prismaMock.tenants.findFirst.mockResolvedValue({ settings: {} });

    const response = await writeSettings(
      patch({ [EMAIL_TRACKING_SETTING]: "yes" }),
    );

    expect(response.status).toBe(400);
    expect(prismaMock.tenants.update).not.toHaveBeenCalled();
  });

  it("404s when the store row has gone", async () => {
    signInAsOwner();
    prismaMock.tenants.findFirst.mockResolvedValue(null);

    expect(
      (await readSettings(request("/api/tenant-admin/email-settings"))).status,
    ).toBe(404);
  });

  it("lets a viewer read but not write", async () => {
    signInAs(buildPermissionSet(["canViewEmails"]));
    prismaMock.tenants.findFirst.mockResolvedValue({ settings: {} });

    expect(
      (await readSettings(request("/api/tenant-admin/email-settings"))).status,
    ).toBe(200);

    const write = await writeSettings(patch({ [EMAIL_TRACKING_SETTING]: true }));
    expect(write.status).toBe(403);
    expect(prismaMock.tenants.update).not.toHaveBeenCalled();
  });

  it("refuses a role with no email rights at all", async () => {
    signInAs(buildPermissionSet(["canViewCustomers"]));

    expect(
      (await readSettings(request("/api/tenant-admin/email-settings"))).status,
    ).toBe(403);
  });
});
