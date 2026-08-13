import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Email Phase 2 US-023 — marketing consent capture. The load-bearing property
// everywhere is the POPIA one: consent is NEVER set by default and never
// inferred. Only an explicit tick (signup / checkout), or an explicit admin
// action, writes users.marketingConsentAt — and only unsubscribe, an unticked
// signup CANNOT clear an earlier grant, an admin withdrawal, or GDPR erasure
// take it away.
//
// Module-boundary mocks only, following newsletter-unsubscribe.test.ts: the
// real route handlers, the real auth wrappers, the real permission gate and
// the real audit util all execute against a mocked Prisma.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { getTenantFromRequest, getCurrentTenant } = vi.hoisted(() => ({
  getTenantFromRequest: vi.fn(),
  getCurrentTenant: vi.fn(),
}));
const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const { sendEmail, emailTemplates } = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  emailTemplates: { welcome: vi.fn() },
}));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const { getTenantDrGreenConfig } = vi.hoisted(() => ({
  getTenantDrGreenConfig: vi.fn(),
}));
const { checkUserKycStatus } = vi.hoisted(() => ({
  checkUserKycStatus: vi.fn(),
}));
const { submitOrder, createDirectCheckout } = vi.hoisted(() => ({
  submitOrder: vi.fn(),
  createDirectCheckout: vi.fn(),
}));
const { fetchProducts } = vi.hoisted(() => ({ fetchProducts: vi.fn() }));
const { syncOrderById } = vi.hoisted(() => ({ syncOrderById: vi.fn() }));
const { isDirectPaySupported } = vi.hoisted(() => ({
  isDirectPaySupported: vi.fn(),
}));
const { triggerWebhook } = vi.hoisted(() => ({ triggerWebhook: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
  users: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  newsletter_subscribers: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  email_suppressions: {
    create: vi.fn(),
  },
  audit_logs: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/tenant/tenant", () => ({ getTenantFromRequest, getCurrentTenant }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit }));
vi.mock("@/lib/email/email", () => ({ sendEmail, emailTemplates }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));
vi.mock("@/lib/tenant/tenant-config", () => ({ getTenantDrGreenConfig }));
vi.mock("@/app/actions/kyc-check", () => ({ checkUserKycStatus }));
vi.mock("@/lib/drgreen/drgreen-orders", () => ({
  submitOrder,
  createDirectCheckout,
}));
vi.mock("@/lib/drgreen/doctor-green-api", () => ({ fetchProducts }));
vi.mock("@/lib/orders/storefront-orders", () => ({ syncOrderById }));
vi.mock("@/lib/payments/direct-pay", () => ({ isDirectPaySupported }));
vi.mock("@/lib/integrations/webhook", () => ({
  triggerWebhook,
  WEBHOOK_EVENTS: { ORDER_CREATED: "order.created" },
}));

import { POST as signupPost } from "@/app/api/signup/route";
import { POST as orderSubmitPost } from "@/app/api/store/[slug]/orders/submit/route";
import { PATCH as consentPatch } from "@/app/api/tenant-admin/customers/[id]/marketing-consent/route";
import { unsubscribeNewsletterSubscriber } from "@/lib/email/newsletter-subscriptions";
import { buildPermissionSet } from "@/lib/permissions/permission-keys";

const TENANT = {
  id: "tenant-a",
  businessName: "Healing Buds",
  subdomain: "healingbuds",
  customDomain: null,
  countryCode: "ZA",
  settings: {},
};

const CUSTOMER_ID = "user_2abcDEF456";

function jsonRequest(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRateLimit.mockResolvedValue({ success: true });
  getTenantFromRequest.mockResolvedValue(TENANT);
  getCurrentTenant.mockResolvedValue(TENANT);
  prismaMock.users.findUnique.mockResolvedValue(null);
  prismaMock.users.findFirst.mockResolvedValue(null);
  prismaMock.users.create.mockResolvedValue({
    id: "u1",
    email: "new@example.com",
    name: "New Customer",
  });
  prismaMock.users.update.mockResolvedValue({ id: "u1" });
  prismaMock.users.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.audit_logs.create.mockResolvedValue({ id: "audit_1" });
  prismaMock.newsletter_subscribers.findFirst.mockResolvedValue(null);
  prismaMock.newsletter_subscribers.update.mockResolvedValue({ id: "sub_1" });
  prismaMock.email_suppressions.create.mockResolvedValue({ id: "sup_1" });
  emailTemplates.welcome.mockResolvedValue("<html>welcome</html>");
  sendEmail.mockResolvedValue(undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// Storefront signup — /api/signup
// ─────────────────────────────────────────────────────────────────────────────

function signupBody(extra: Record<string, unknown> = {}) {
  return {
    email: "new@example.com",
    password: "s3cret-password",
    firstName: "New",
    lastName: "Customer",
    acceptTerms: true,
    ...extra,
  };
}

function signup(extra: Record<string, unknown> = {}): Promise<Response> {
  return signupPost(
    jsonRequest("https://healingbuds.budstacks.io/api/signup", "POST", signupBody(extra)),
  );
}

describe("signup — consent comes only from the ticked checkbox", () => {
  it("records marketingConsentAt when the box was ticked", async () => {
    const response = await signup({ marketingConsent: true });

    expect(response.status).toBe(200);
    const create = prismaMock.users.create.mock.calls[0][0];
    expect(create.data.marketingConsentAt).toBeInstanceOf(Date);
  });

  it("stores null when the box was explicitly unticked", async () => {
    const response = await signup({ marketingConsent: false });

    expect(response.status).toBe(200);
    const create = prismaMock.users.create.mock.calls[0][0];
    expect(create.data.marketingConsentAt).toBeNull();
  });

  it("NEVER sets consent by default — an absent field stores null", async () => {
    const response = await signup();

    expect(response.status).toBe(200);
    const create = prismaMock.users.create.mock.calls[0][0];
    expect(create.data.marketingConsentAt).toBeNull();
  });

  it("rejects a non-boolean consent value before any write", async () => {
    const response = await signup({ marketingConsent: "yes" });

    expect(response.status).toBe(400);
    expect(prismaMock.users.create).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Checkout — /api/store/[slug]/orders/submit
// ─────────────────────────────────────────────────────────────────────────────

const DB_USER = { id: "dbuser_1", email: "buyer@example.com", drGreenClientId: "dg_1" };
const ORDER_RESULT = {
  orderId: "order_1",
  drGreenOrderId: "dg_order_1",
  orderNumber: "HB-1001",
  total: 420,
};

function checkoutBody(extra: Record<string, unknown> = {}) {
  return {
    shippingInfo: {
      address1: "1 Test Street",
      city: "Cape Town",
      state: "WC",
      postalCode: "8001",
      country: "South Africa",
    },
    ...extra,
  };
}

function submitCheckout(extra: Record<string, unknown> = {}): Promise<Response> {
  return orderSubmitPost(
    jsonRequest(
      "https://healingbuds.budstacks.io/api/store/healingbuds/orders/submit",
      "POST",
      checkoutBody(extra),
    ),
    { params: { slug: "healingbuds" } },
  );
}

describe("checkout — consent rides along without touching the order flow", () => {
  beforeEach(() => {
    getCurrentUser.mockResolvedValue({
      id: "clerk_1",
      email: DB_USER.email,
      role: "PATIENT",
      tenantId: TENANT.id,
    });
    prismaMock.users.findFirst.mockResolvedValue(DB_USER);
    getTenantDrGreenConfig.mockResolvedValue({
      apiUrl: "https://api.example",
      apiKey: "k",
      secretKey: "s",
    });
    checkUserKycStatus.mockResolvedValue({ status: "ACTIVE", kycVerified: true });
    submitOrder.mockResolvedValue(ORDER_RESULT);
    isDirectPaySupported.mockReturnValue(false);
    syncOrderById.mockResolvedValue({});
    triggerWebhook.mockResolvedValue(undefined);
  });

  it("ticked → stamps marketingConsentAt on the buyer's users row and still places the order", async () => {
    const response = await submitCheckout({ marketingConsent: true });

    expect(response.status).toBe(200);
    expect(prismaMock.users.update).toHaveBeenCalledWith({
      where: { id: DB_USER.id },
      data: {
        marketingConsentAt: expect.any(Date),
        updatedAt: expect.any(Date),
      },
    });
    expect(submitOrder).toHaveBeenCalledTimes(1);
  });

  it("unticked → no consent write at all (and no clearing of an earlier grant)", async () => {
    const response = await submitCheckout({ marketingConsent: false });

    expect(response.status).toBe(200);
    expect(prismaMock.users.update).not.toHaveBeenCalled();
    expect(submitOrder).toHaveBeenCalledTimes(1);
  });

  it("absent field (pre-US-023 client) → validates and writes nothing", async () => {
    const response = await submitCheckout();

    expect(response.status).toBe(200);
    expect(prismaMock.users.update).not.toHaveBeenCalled();
  });

  it("a failed consent write can NEVER fail the order", async () => {
    prismaMock.users.update.mockRejectedValue(new Error("connection reset"));

    const response = await submitCheckout({ marketingConsent: true });

    expect(response.status).toBe(200);
    expect(submitOrder).toHaveBeenCalledTimes(1);
    const data = await response.json();
    expect(data.order.orderId).toBe(ORDER_RESULT.orderId);
  });

  it("records consent before the order submission, not inside the payment flow", async () => {
    const callOrder: string[] = [];
    prismaMock.users.update.mockImplementation(async () => {
      callOrder.push("consent");
      return { id: DB_USER.id };
    });
    submitOrder.mockImplementation(async () => {
      callOrder.push("order");
      return ORDER_RESULT;
    });

    await submitCheckout({ marketingConsent: true });

    expect(callOrder).toEqual(["consent", "order"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Admin toggle — PATCH /api/tenant-admin/customers/[id]/marketing-consent
// ─────────────────────────────────────────────────────────────────────────────

const ADMIN = {
  id: "admin_1",
  email: "admin@store.dev",
  name: "Admin",
  image: "",
  role: "TENANT_ADMIN",
  tenantId: TENANT.id,
  clerkOrgId: null,
};

function grantAdmin(canEdit: boolean) {
  getCurrentUser.mockResolvedValue(ADMIN);
  resolveUserPermissions.mockResolvedValue({
    teamRole: "manager",
    permissions: buildPermissionSet(canEdit ? ["canEditCustomers"] : []),
  });
}

function toggleConsent(consent: unknown, id: string = CUSTOMER_ID): Promise<Response> {
  return consentPatch(
    jsonRequest(
      `https://budstacks.io/api/tenant-admin/customers/${id}/marketing-consent`,
      "PATCH",
      { consent },
    ),
    { params: { id } },
  );
}

describe("admin toggle — writes/clears the timestamp with an audit entry", () => {
  beforeEach(() => {
    grantAdmin(true);
    prismaMock.users.findFirst.mockResolvedValue({
      id: CUSTOMER_ID,
      email: "customer@example.com",
      marketingConsentAt: null,
    });
  });

  it("grant: sets marketingConsentAt and audits customer.marketing_consent_granted", async () => {
    const response = await toggleConsent(true);

    expect(response.status).toBe(200);
    expect(prismaMock.users.update).toHaveBeenCalledWith({
      where: { id: CUSTOMER_ID },
      data: {
        marketingConsentAt: expect.any(Date),
        updatedAt: expect.any(Date),
      },
    });
    expect(prismaMock.audit_logs.create).toHaveBeenCalledTimes(1);
    expect(prismaMock.audit_logs.create.mock.calls[0][0].data).toMatchObject({
      action: "customer.marketing_consent_granted",
      entityType: "User",
      entityId: CUSTOMER_ID,
      userId: ADMIN.id,
      tenantId: TENANT.id,
    });
    expect((await response.json()).marketingConsentAt).not.toBeNull();
  });

  it("withdraw: clears the timestamp and audits customer.marketing_consent_revoked", async () => {
    prismaMock.users.findFirst.mockResolvedValue({
      id: CUSTOMER_ID,
      email: "customer@example.com",
      marketingConsentAt: new Date("2026-08-01T10:00:00Z"),
    });

    const response = await toggleConsent(false);

    expect(response.status).toBe(200);
    expect(prismaMock.users.update).toHaveBeenCalledWith({
      where: { id: CUSTOMER_ID },
      data: { marketingConsentAt: null, updatedAt: expect.any(Date) },
    });
    expect(prismaMock.audit_logs.create.mock.calls[0][0].data).toMatchObject({
      action: "customer.marketing_consent_revoked",
      entityId: CUSTOMER_ID,
    });
    expect((await response.json()).marketingConsentAt).toBeNull();
  });

  it("scopes the customer lookup to the admin's tenant and to PATIENT rows", async () => {
    await toggleConsent(true);

    expect(prismaMock.users.findFirst).toHaveBeenCalledWith({
      where: { id: CUSTOMER_ID, tenantId: TENANT.id, role: "PATIENT" },
      select: { id: true, email: true, marketingConsentAt: true },
    });
  });

  it("403s a member without canEditCustomers before reading or writing anything", async () => {
    grantAdmin(false);

    const response = await toggleConsent(true);

    expect(response.status).toBe(403);
    expect(prismaMock.users.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.users.update).not.toHaveBeenCalled();
    expect(prismaMock.audit_logs.create).not.toHaveBeenCalled();
  });

  it("404s an unknown customer without writing or auditing", async () => {
    prismaMock.users.findFirst.mockResolvedValue(null);

    const response = await toggleConsent(true);

    expect(response.status).toBe(404);
    expect(prismaMock.users.update).not.toHaveBeenCalled();
    expect(prismaMock.audit_logs.create).not.toHaveBeenCalled();
  });

  it("400s a non-boolean consent without writing", async () => {
    const response = await toggleConsent("yes");

    expect(response.status).toBe(400);
    expect(prismaMock.users.update).not.toHaveBeenCalled();
    expect(prismaMock.audit_logs.create).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unsubscribe — clears consent for the matching (tenantId, email) only
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN = "n1qUiaR3GxV9Zt-Kp_QsL0mB2cD4eF6gH8iJ0kL2mN4"; // gitleaks:allow — test fixture, not a credential
const SUBSCRIBER = {
  id: "sub_1",
  tenantId: TENANT.id,
  email: "reader@example.com",
  status: "CONFIRMED" as const,
};

describe("unsubscribe — consent withdrawal is tenant-scoped", () => {
  it("clears marketingConsentAt for the subscriber's (tenantId, email) pair", async () => {
    prismaMock.newsletter_subscribers.findFirst.mockResolvedValue(SUBSCRIBER);
    const now = new Date("2026-08-13T09:00:00Z");

    const outcome = await unsubscribeNewsletterSubscriber(TOKEN, now);

    expect(outcome).toBe("unsubscribe");
    expect(prismaMock.users.updateMany).toHaveBeenCalledWith({
      where: {
        tenantId: SUBSCRIBER.tenantId,
        email: SUBSCRIBER.email,
        marketingConsentAt: { not: null },
      },
      data: { marketingConsentAt: null, updatedAt: now },
    });
  });

  it("cannot touch another tenant's users row with the same email — tenantId is in the predicate", async () => {
    prismaMock.newsletter_subscribers.findFirst.mockResolvedValue({
      ...SUBSCRIBER,
      tenantId: "tenant-b",
    });

    await unsubscribeNewsletterSubscriber(TOKEN);

    // The ONLY consent write issued carries tenant-b; there is no unscoped
    // variant that could reach tenant-a's row for the same address.
    expect(prismaMock.users.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.users.updateMany.mock.calls[0][0].where).toMatchObject({
      tenantId: "tenant-b",
      email: SUBSCRIBER.email,
    });
  });

  it("still clears consent when the subscriber row is already terminal (repair semantics)", async () => {
    prismaMock.newsletter_subscribers.findFirst.mockResolvedValue({
      ...SUBSCRIBER,
      status: "UNSUBSCRIBED",
    });

    const outcome = await unsubscribeNewsletterSubscriber(TOKEN);

    expect(outcome).toBe("already-unsubscribed");
    expect(prismaMock.users.updateMany).toHaveBeenCalledTimes(1);
  });

  it("an unknown token clears nothing", async () => {
    prismaMock.newsletter_subscribers.findFirst.mockResolvedValue(null);

    const outcome = await unsubscribeNewsletterSubscriber(TOKEN);

    expect(outcome).toBe("invalid");
    expect(prismaMock.users.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.email_suppressions.create).not.toHaveBeenCalled();
  });
});
