import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// US-006 — test-send. Three layers under test:
//   1. the shared Handlebars helper set (the worker's contract, now shared),
//   2. the canned sample-variable sets,
//   3. the tenant-admin route: permission gate, rate cap, tenant scoping.
//
// Module-boundary mocks only (getCurrentUser, prisma, rate limiter, the queue).
// The real auth wrapper, permission gate and render pipeline all execute.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const { sendEmail } = vi.hoisted(() => ({ sendEmail: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
  email_templates: { findFirst: vi.fn(), findUnique: vi.fn() },
  email_event_mappings: { findFirst: vi.fn() },
  tenants: { findFirst: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit }));
vi.mock("@/lib/email/email", () => ({ sendEmail }));

import {
  maxBlockDepth,
  renderEmailTemplate,
} from "@/lib/email/handlebars-helpers";
import { isReservedEventType } from "@/lib/email/reserved-event-types";
import { sampleVariablesForEvent } from "@/lib/email/sample-variables";
import {
  MAX_TEMPLATE_BLOCK_DEPTH,
  queueTestSend,
  TEST_SEND_RATE_LIMIT,
} from "@/lib/email/test-send";
import { ALL_FALSE } from "@/lib/permissions/permission-keys";
import { POST as tenantTestSend } from "@/app/api/tenant-admin/email-templates/[id]/test-send/route";
import { POST as superAdminTestSend } from "@/app/api/super-admin/email-templates/[id]/test-send/route";

const TENANT_A = "tenant-a";
const TEMPLATE_UUID = "11111111-1111-1111-1111-111111111111";
const ADMIN_EMAIL = "admin@store.dev";

function adminUser(over: Record<string, unknown> = {}) {
  return {
    id: "admin_1",
    email: ADMIN_EMAIL,
    name: "Admin",
    image: "",
    role: "TENANT_ADMIN",
    tenantId: TENANT_A,
    clerkOrgId: null,
    ...over,
  };
}

function testSendRequest() {
  return new NextRequest(
    `http://store.dev/api/tenant-admin/email-templates/${TEMPLATE_UUID}/test-send`,
    { method: "POST" },
  );
}

const callRoute = () =>
  tenantTestSend(testSendRequest(), { params: { id: TEMPLATE_UUID } });

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(adminUser());
  resolveUserPermissions.mockResolvedValue({
    teamRole: "manager",
    permissions: { ...ALL_FALSE, canEditEmails: true },
  });
  checkRateLimit.mockResolvedValue({ success: true });
  sendEmail.mockResolvedValue(undefined);
  prismaMock.email_templates.findFirst.mockResolvedValue({
    id: TEMPLATE_UUID,
    subject: "Order {{orderNumber}}",
    contentHtml: "<p>Hi {{userName}}, you owe {{toFixed total}}</p>",
  });
  prismaMock.email_templates.findUnique.mockResolvedValue({
    id: TEMPLATE_UUID,
    subject: "Order {{orderNumber}}",
    contentHtml: "<p>Hi {{userName}}</p>",
    tenantId: null,
  });
  prismaMock.email_event_mappings.findFirst.mockResolvedValue({
    eventType: "orderConfirmation",
  });
  prismaMock.tenants.findFirst.mockResolvedValue({ businessName: "Live Store" });
});

describe("renderEmailTemplate — the worker's helper set, shared", () => {
  it("applies toFixed and multiply exactly as the worker registers them", () => {
    expect(renderEmailTemplate("{{toFixed n}}", { n: 3.14159 })).toBe("3.14");
    expect(renderEmailTemplate("{{multiply a b}}", { a: 2, b: 24.5 })).toBe("49.00");
  });

  it("iterates {{#each items}} with the helpers applied per row", () => {
    const html = renderEmailTemplate(
      "{{#each items}}{{name}}:{{multiply price quantity}};{{/each}}",
      { items: [{ name: "A", price: 10, quantity: 2 }, { name: "B", price: 1.5, quantity: 3 }] },
    );
    expect(html).toBe("A:20.00;B:4.50;");
  });

  it("HTML-escapes interpolated values (default {{ }} stash)", () => {
    expect(renderEmailTemplate("<p>{{name}}</p>", { name: "<script>x</script>" })).toBe(
      "<p>&lt;script&gt;x&lt;/script&gt;</p>",
    );
  });

  it("renders a missing variable as empty rather than throwing", () => {
    expect(renderEmailTemplate("<p>{{nope}}</p>", {})).toBe("<p></p>");
  });
});

describe("maxBlockDepth — the request-path cost bound", () => {
  it("counts nested block helpers, including whitespace-control forms", () => {
    expect(maxBlockDepth("<p>no blocks</p>")).toBe(0);
    expect(maxBlockDepth("{{#each items}}{{name}}{{/each}}")).toBe(1);
    expect(
      maxBlockDepth("{{#each a}}{{~#each b}}{{#if c}}x{{/if}}{{/each}}{{/each}}"),
    ).toBe(3);
  });

  it("reports the deepest branch, not the last one", () => {
    expect(
      maxBlockDepth("{{#if a}}{{#each b}}x{{/each}}{{/if}}{{#if c}}y{{/if}}"),
    ).toBe(2);
  });
});

describe("sampleVariablesForEvent", () => {
  it("always supplies the base set, even for an unmapped template", () => {
    const vars = sampleVariablesForEvent(null);
    expect(vars).toMatchObject({
      businessName: expect.any(String),
      userName: expect.any(String),
      orderNumber: expect.any(String),
    });
    expect(Array.isArray(vars.items)).toBe(true);
  });

  it("layers the event-specific set over the base set", () => {
    const vars = sampleVariablesForEvent("order-status-update");
    expect(vars.status).toBe("SHIPPED");
    expect(vars.trackingUrl).toEqual(expect.stringContaining("tracking"));
    expect(vars.businessName).toEqual(expect.any(String));
  });

  it("falls back to the base set for an unknown event type", () => {
    expect(sampleVariablesForEvent("not-a-real-event")).toEqual(
      sampleVariablesForEvent(null),
    );
  });

  it("prefers live overrides for business name and recipient", () => {
    const vars = sampleVariablesForEvent("welcome", {
      businessName: "Live Store",
      email: ADMIN_EMAIL,
    });
    expect(vars.businessName).toBe("Live Store");
    expect(vars.tenantName).toBe("Live Store");
    expect(vars.email).toBe(ADMIN_EMAIL);
  });
});

describe("queueTestSend", () => {
  it("queues ONE rendered message under the test-send template name", async () => {
    await queueTestSend({
      template: {
        id: TEMPLATE_UUID,
        subject: "Order {{orderNumber}}",
        contentHtml: "<p>{{userName}} — {{toFixed total}}</p>",
      },
      eventType: "orderConfirmation",
      recipient: ADMIN_EMAIL,
      tenantId: TENANT_A,
      businessName: "Live Store",
    });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const arg = sendEmail.mock.calls[0][0];
    expect(arg.to).toBe(ADMIN_EMAIL);
    expect(arg.templateName).toBe("test-send");
    expect(arg.tenantId).toBe(TENANT_A);
    expect(arg.category).toBeUndefined(); // transactional — never suppression-gated
    expect(arg.subject).toMatch(/^Order ORD-/);
    expect(arg.html).toContain("88.99");
    expect(arg.metadata).toMatchObject({ testSend: true, templateId: TEMPLATE_UUID });
  });

  it("refuses a template nested past the depth cap, queueing nothing", async () => {
    const bomb =
      "{{#each items}}".repeat(MAX_TEMPLATE_BLOCK_DEPTH + 1) +
      "x" +
      "{{/each}}".repeat(MAX_TEMPLATE_BLOCK_DEPTH + 1);

    await expect(
      queueTestSend({
        template: { id: TEMPLATE_UUID, subject: "Hi", contentHtml: bomb },
        recipient: ADMIN_EMAIL,
        tenantId: TENANT_A,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("turns a malformed template into a 400, not a 500", async () => {
    await expect(
      queueTestSend({
        template: {
          id: TEMPLATE_UUID,
          subject: "Hi",
          contentHtml: "{{#each items}}unclosed",
        },
        recipient: ADMIN_EMAIL,
        tenantId: TENANT_A,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("reserved event types", () => {
  it("reserves the test-send templateName the worker would otherwise override", () => {
    expect(isReservedEventType("test-send")).toBe(true);
    expect(isReservedEventType("  Test-Send ")).toBe(true);
    expect(isReservedEventType("orderConfirmation")).toBe(false);
  });
});

describe("POST email-templates/[id]/test-send", () => {
  it("queues to the caller's own address and reports it back", async () => {
    const res = await callRoute();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, sentTo: ADMIN_EMAIL });
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: ADMIN_EMAIL, templateName: "test-send" }),
    );
  });

  it("scopes the template lookup to the caller's tenant", async () => {
    await callRoute();

    expect(prismaMock.email_templates.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEMPLATE_UUID, tenantId: TENANT_A },
      }),
    );
  });

  it("404s — and queues nothing — for a template the tenant does not own", async () => {
    prismaMock.email_templates.findFirst.mockResolvedValue(null);

    const res = await callRoute();

    expect(res.status).toBe(404);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("meters 5/min per tenant, before any template lookup", async () => {
    checkRateLimit.mockResolvedValue({
      success: false,
      response: new Response(null, { status: 429 }),
    });

    const res = await callRoute();

    expect(res.status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith(
      `email-test-send:${TENANT_A}`,
      TEST_SEND_RATE_LIMIT,
    );
    // Fails closed: a Redis outage must not turn the cap off on a sending route.
    expect(TEST_SEND_RATE_LIMIT).toEqual({
      maxRequests: 5,
      windowMs: 60_000,
      failMode: "closed",
    });
    expect(prismaMock.email_templates.findFirst).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("403s a caller without canEditEmails", async () => {
    resolveUserPermissions.mockResolvedValue({
      teamRole: "viewer",
      permissions: { ...ALL_FALSE },
    });

    const res = await callRoute();

    expect(res.status).toBe(403);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("401s an unauthenticated caller", async () => {
    getCurrentUser.mockResolvedValue(null);

    const res = await callRoute();

    expect(res.status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});

describe("POST super-admin email-templates/[id]/test-send", () => {
  const superAdmin = () =>
    adminUser({ id: "super_1", role: "SUPER_ADMIN", tenantId: null });

  const callSuperRoute = () =>
    superAdminTestSend(
      new NextRequest(
        `http://app.dev/api/super-admin/email-templates/${TEMPLATE_UUID}/test-send`,
        { method: "POST" },
      ),
      { params: { id: TEMPLATE_UUID } },
    );

  beforeEach(() => {
    getCurrentUser.mockResolvedValue(superAdmin());
  });

  it("sends a platform template as SYSTEM (no tenant to bill it to)", async () => {
    const res = await callSuperRoute();

    expect(res.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ADMIN_EMAIL,
        tenantId: "SYSTEM",
        templateName: "test-send",
      }),
    );
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
  });

  it("sends a tenant-owned template through that tenant", async () => {
    prismaMock.email_templates.findUnique.mockResolvedValue({
      id: TEMPLATE_UUID,
      subject: "Hi",
      contentHtml: "<p>{{businessName}}</p>",
      tenantId: TENANT_A,
    });

    const res = await callSuperRoute();
    expect(res.status).toBe(200);

    const arg = sendEmail.mock.calls[0][0];
    expect(arg.tenantId).toBe(TENANT_A);
    expect(arg.html).toContain("Live Store");
  });

  it("404s a template that does not exist", async () => {
    prismaMock.email_templates.findUnique.mockResolvedValue(null);

    const res = await callSuperRoute();

    expect(res.status).toBe(404);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("meters per admin, not per tenant — there is no tenant here", async () => {
    await callSuperRoute();

    expect(checkRateLimit).toHaveBeenCalledWith(
      "email-test-send:super-admin:super_1",
      TEST_SEND_RATE_LIMIT,
    );
  });

  it("401s a tenant admin reaching for the platform route", async () => {
    getCurrentUser.mockResolvedValue(adminUser());

    const res = await callSuperRoute();

    expect(res.status).toBe(401);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
