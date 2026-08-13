import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Email Phase 2 US-011 — the contentJson wiring on the four handlers that
// persist email content. What is asserted here is the DECISION each one makes,
// not the pipeline itself (tests/unit/email-render-pipeline.test.ts owns that):
//
//   document present -> contentHtml is DERIVED and overrides raw HTML
//   document is null -> the column is cleared with a SQL NULL
//   no document      -> the pre-US-011 raw path, byte for byte
//
// Module-boundary mocks only; the real auth wrappers, the real permission gate
// and the real pipeline all run, so a break in any of them fails here.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  email_templates: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
  },
  tenants: { findFirst: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));

import { POST as tenantCreate } from "@/app/api/tenant-admin/email-templates/route";
import { PUT as tenantUpdate } from "@/app/api/tenant-admin/email-templates/[id]/route";
import { POST as superCreate } from "@/app/api/super-admin/email-templates/route";
import { PUT as superUpdate } from "@/app/api/super-admin/email-templates/[id]/route";
import { BUSINESS_NAME_SLOT } from "@/lib/email/email-render-pipeline";
import { resolvePermissions } from "@/lib/permissions/resolve";

const TENANT_A = "tenant-a";
const TEMPLATE_UUID = "11111111-1111-1111-1111-111111111111";

const TENANT_ROW = {
  id: TENANT_A,
  businessName: "Healing Buds",
  subdomain: "healingbuds",
  customDomain: "shop.example",
  settings: null,
  businessAddress1: "1 Sample Street",
  businessAddress2: null,
  businessCity: "Dublin",
  businessState: null,
  businessPostalCode: null,
  businessCountry: null,
  tenant_branding: { logoUrl: null, primaryColor: "#7c3aed" },
};

const DOC = {
  type: "doc",
  content: [
    { type: "paragraph", content: [{ type: "text", text: "Hi {{userName}}" }] },
  ],
};

function request(method: string, path: string, body?: unknown) {
  return new NextRequest(`http://store.dev${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }),
  });
}

/** Data handed to the single create/update this test performed. */
function writtenData(fn: { mock: { calls: unknown[][] } }) {
  expect(fn.mock.calls).toHaveLength(1);
  return (fn.mock.calls[0][0] as { data: Record<string, unknown> }).data;
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue({
    id: "admin_1",
    email: "admin@store.dev",
    name: "Admin",
    image: "",
    role: "TENANT_ADMIN",
    tenantId: TENANT_A,
    clerkOrgId: null,
  });
  resolveUserPermissions.mockResolvedValue({
    teamRole: "admin",
    permissions: resolvePermissions({ role: "TENANT_ADMIN", teamRole: "admin" }),
  });
  prismaMock.tenants.findFirst.mockResolvedValue(TENANT_ROW);
  prismaMock.email_templates.create.mockImplementation(async (args: { data: unknown }) => args.data);
  prismaMock.email_templates.update.mockImplementation(async (args: { data: unknown }) => args.data);
  prismaMock.email_templates.findFirst.mockResolvedValue({ category: "Marketing" });
  prismaMock.email_templates.findUnique.mockResolvedValue({
    tenantId: null,
    category: "Transactional",
  });
});

describe("tenant-admin POST /email-templates", () => {
  it("derives contentHtml from a document and stores both", async () => {
    const response = await tenantCreate(
      request("POST", "/api/tenant-admin/email-templates", {
        name: "Welcome",
        subject: "Hi",
        contentJson: DOC,
        category: "Marketing",
      }),
    );

    expect(response.status).toBe(200);
    const data = writtenData(prismaMock.email_templates.create);
    expect(data.contentJson).toEqual(DOC);
    expect(data.contentHtml).toContain("Healing Buds");
    expect(data.contentHtml).toContain("Hi {{userName}}");
    // Marketing category on the row => the shell's unsubscribe line is there.
    expect(data.contentHtml).toContain("{{unsubscribeUrl}}");
  });

  it("lets the document beat raw HTML sent in the same request", async () => {
    await tenantCreate(
      request("POST", "/api/tenant-admin/email-templates", {
        name: "Welcome",
        subject: "Hi",
        contentHtml: "<p>Stale HTML the composer did not produce</p>",
        contentJson: DOC,
      }),
    );

    const data = writtenData(prismaMock.email_templates.create);
    expect(data.contentHtml).not.toContain("Stale HTML");
    expect(data.contentHtml).toContain("Hi {{userName}}");
  });

  it("leaves the raw contentHtml-only path exactly as it was", async () => {
    await tenantCreate(
      request("POST", "/api/tenant-admin/email-templates", {
        name: "Raw",
        subject: "Hi",
        contentHtml: "<p>Hand written</p><script>alert(1)</script>",
      }),
    );

    const data = writtenData(prismaMock.email_templates.create);
    expect(data.contentHtml).toBe("<p>Hand written</p>");
    expect(data).not.toHaveProperty("contentJson");
    // No shell, no tenant lookup — nothing about this path changed.
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
  });

  it("rejects an oversize pasted image before anything is written", async () => {
    const oversize = `data:image/png;base64,${Buffer.alloc(20_000, 0x41).toString("base64")}`;
    const response = await tenantCreate(
      request("POST", "/api/tenant-admin/email-templates", {
        name: "Pasted",
        subject: "Hi",
        contentJson: {
          type: "doc",
          content: [{ type: "image", attrs: { src: oversize } }],
        },
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: expect.stringContaining("Upload it instead"),
    });
    expect(prismaMock.email_templates.create).not.toHaveBeenCalled();
  });
});

describe("tenant-admin PUT /email-templates/[id]", () => {
  const params = { params: { id: TEMPLATE_UUID } };

  it("re-renders from the document using the row's own category", async () => {
    await tenantUpdate(
      request("PUT", `/api/tenant-admin/email-templates/${TEMPLATE_UUID}`, {
        contentJson: DOC,
      }),
      params,
    );

    const data = writtenData(prismaMock.email_templates.update);
    expect(data.contentJson).toEqual(DOC);
    expect(data.contentHtml).toContain("Hi {{userName}}");
    // The row is Marketing; the request body cannot say otherwise.
    expect(data.contentHtml).toContain("{{unsubscribeUrl}}");
  });

  it("clears the document with a SQL NULL when the author moves to raw HTML", async () => {
    await tenantUpdate(
      request("PUT", `/api/tenant-admin/email-templates/${TEMPLATE_UUID}`, {
        contentHtml: "<p>Hand written now</p>",
        contentJson: null,
      }),
      params,
    );

    const data = writtenData(prismaMock.email_templates.update);
    expect(data.contentJson).toBe(Prisma.DbNull);
    expect(data.contentHtml).toBe("<p>Hand written now</p>");
  });

  it("drops a stale document when raw HTML is written without one", async () => {
    // The row may already carry a composer document from an earlier save. Raw
    // HTML IS the divergence, so the document goes with it even though this
    // request never mentioned contentJson — otherwise the two columns disagree
    // and the next composer save re-derives contentHtml from the stale document,
    // silently throwing this HTML away.
    await tenantUpdate(
      request("PUT", `/api/tenant-admin/email-templates/${TEMPLATE_UUID}`, {
        contentHtml: "<p>Written in the Advanced tab</p>",
      }),
      params,
    );

    const data = writtenData(prismaMock.email_templates.update);
    expect(data.contentHtml).toBe("<p>Written in the Advanced tab</p>");
    expect(data.contentJson).toBe(Prisma.DbNull);
  });

  it("touches neither column when the request carries neither", async () => {
    await tenantUpdate(
      request("PUT", `/api/tenant-admin/email-templates/${TEMPLATE_UUID}`, {
        subject: "Just a new subject",
      }),
      params,
    );

    const data = writtenData(prismaMock.email_templates.update);
    expect(data).not.toHaveProperty("contentHtml");
    expect(data).not.toHaveProperty("contentJson");
  });

  it("404s on another tenant's template without rendering anything", async () => {
    prismaMock.email_templates.findFirst.mockResolvedValue(null);

    const response = await tenantUpdate(
      request("PUT", `/api/tenant-admin/email-templates/${TEMPLATE_UUID}`, {
        contentJson: DOC,
      }),
      params,
    );

    expect(response.status).toBe(404);
    expect(prismaMock.email_templates.update).not.toHaveBeenCalled();
  });
});

describe("super-admin email-templates", () => {
  beforeEach(() => {
    getCurrentUser.mockResolvedValue({
      id: "root_1",
      email: "root@budstacks.dev",
      name: "Root",
      image: "",
      role: "SUPER_ADMIN",
      tenantId: null,
      clerkOrgId: null,
    });
  });

  it("accepts a document with no contentHtml and wraps it in the system shell", async () => {
    const response = await superCreate(
      request("POST", "/api/super-admin/email-templates", {
        name: "System welcome",
        subject: "Welcome",
        contentJson: DOC,
      }),
    );

    expect(response.status).toBe(200);
    const data = writtenData(prismaMock.email_templates.create);
    expect(data.contentJson).toEqual(DOC);
    // No tenant to brand with, so the name is a slot the worker fills.
    expect(data.contentHtml).toContain(BUSINESS_NAME_SLOT);
    expect(data.contentHtml).toContain("Hi {{userName}}");
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
  });

  it("keeps the raw contentHtml-only create sanitizing exactly as before", async () => {
    // The create schema changed shape for US-011 (contentHtml went from
    // required to optional behind a refine), so the unchanged path is pinned.
    const response = await superCreate(
      request("POST", "/api/super-admin/email-templates", {
        name: "Raw system template",
        subject: "Hi",
        contentHtml: "<p>Hand written</p><script>alert(1)</script>",
      }),
    );

    expect(response.status).toBe(200);
    const data = writtenData(prismaMock.email_templates.create);
    expect(data.contentHtml).toBe("<p>Hand written</p>");
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a create carrying neither HTML nor a document", async () => {
    const response = await superCreate(
      request("POST", "/api/super-admin/email-templates", {
        name: "Empty",
        subject: "Nothing",
      }),
    );

    expect(response.status).toBe(400);
    expect(prismaMock.email_templates.create).not.toHaveBeenCalled();
  });

  it("brands a TENANT-owned template with that tenant, not the system shell", async () => {
    prismaMock.email_templates.findUnique.mockResolvedValue({
      tenantId: TENANT_A,
      category: "Marketing",
    });

    await superUpdate(
      request("PUT", `/api/super-admin/email-templates/${TEMPLATE_UUID}`, {
        contentJson: DOC,
      }),
      { params: { id: TEMPLATE_UUID } },
    );

    const data = writtenData(prismaMock.email_templates.update);
    expect(data.contentHtml).toContain("Healing Buds");
    expect(data.contentHtml).not.toContain(BUSINESS_NAME_SLOT);
    expect(prismaMock.tenants.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TENANT_A } }),
    );
  });

  it("keeps the raw-HTML update a single blind write", async () => {
    await superUpdate(
      request("PUT", `/api/super-admin/email-templates/${TEMPLATE_UUID}`, {
        contentHtml: "<p>Hand written</p>",
      }),
      { params: { id: TEMPLATE_UUID } },
    );

    const data = writtenData(prismaMock.email_templates.update);
    expect(data.contentHtml).toBe("<p>Hand written</p>");
    // No document, so no ownership read was needed and none was made.
    expect(prismaMock.email_templates.findUnique).not.toHaveBeenCalled();
  });
});
