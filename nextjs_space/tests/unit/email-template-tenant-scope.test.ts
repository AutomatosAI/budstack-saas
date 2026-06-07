import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// PRD-203 follow-up (PR #115 review) — tenant-scoping hardening for the email
// template + mapping routes. The marquee fix is the cross-tenant clone-by-id
// leak: findUnique({where:{id}}) bypasses the Prisma tenant middleware, so an
// admin could clone another tenant's private template by guessing its id.
//
// Module-boundary mocks: getCurrentUser + prisma. The real wrappers and
// runWithTenantContextAsync run, so each handler executes under a genuine bound
// tenant; we assert the explicit `where` scoping the handlers now carry. Real-DB
// row filtering is proven separately in the Docker-gated integration suite.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
  email_templates: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  email_event_mappings: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST as clonePost } from "@/app/api/tenant-admin/email-templates/clone/route";
import { POST as createTemplate } from "@/app/api/tenant-admin/email-templates/route";
import { DELETE as deleteTemplate } from "@/app/api/tenant-admin/email-templates/[id]/route";
import { DELETE as resetMapping } from "@/app/api/tenant-admin/email-mappings/route";

const TENANT_A = "tenant-a";
const TEMPLATE_UUID = "11111111-1111-1111-1111-111111111111";

function adminUser(over: Record<string, unknown> = {}) {
  return {
    id: "admin_1",
    email: "admin@store.dev",
    name: "Admin",
    image: "",
    role: "TENANT_ADMIN",
    tenantId: TENANT_A,
    clerkOrgId: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(adminUser());
});

describe("POST email-templates/clone — tenant-scoped source (HIGH leak)", () => {
  const cloneReq = () =>
    new NextRequest("http://store.dev/api/tenant-admin/email-templates/clone", {
      method: "POST",
      body: JSON.stringify({
        originalTemplateId: "tmpl_foreign",
        eventType: "welcome",
      }),
    });

  it("scopes the source lookup to system-or-own templates", async () => {
    prismaMock.email_templates.findFirst.mockResolvedValue(null);

    await clonePost(cloneReq());

    expect(prismaMock.email_templates.findFirst).toHaveBeenCalledWith({
      where: {
        id: "tmpl_foreign",
        OR: [{ isSystem: true }, { tenantId: TENANT_A }],
      },
    });
  });

  it("returns 404 and never clones an id that belongs to another tenant", async () => {
    prismaMock.email_templates.findFirst.mockResolvedValue(null);

    const res = await clonePost(cloneReq());

    expect(res.status).toBe(404);
    expect(prismaMock.email_templates.create).not.toHaveBeenCalled();
    expect(prismaMock.email_event_mappings.upsert).not.toHaveBeenCalled();
  });

  it("clones a system/own template into the caller's tenant", async () => {
    prismaMock.email_templates.findFirst.mockResolvedValue({
      id: "tmpl_sys",
      name: "Welcome",
      subject: "Hi",
      contentHtml: "<div>hi</div>",
      category: "Transactional",
    });
    prismaMock.email_templates.create.mockResolvedValue({ id: "tmpl_new" });
    prismaMock.email_event_mappings.upsert.mockResolvedValue({});

    const res = await clonePost(cloneReq());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({ success: true, newTemplateId: "tmpl_new" });
    expect(prismaMock.email_templates.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: TENANT_A }),
      }),
    );
  });
});

describe("POST email-templates — tenant-scoped sourceTemplateId", () => {
  it("scopes the source-template lookup to system-or-own", async () => {
    prismaMock.email_templates.findFirst.mockResolvedValue(null);
    prismaMock.email_templates.create.mockResolvedValue({ id: "t1" });

    const req = new NextRequest(
      "http://store.dev/api/tenant-admin/email-templates",
      {
        method: "POST",
        body: JSON.stringify({
          name: "X",
          subject: "S",
          contentHtml: "<div>x</div>",
          sourceTemplateId: "src_foreign",
        }),
      },
    );

    await createTemplate(req);

    expect(prismaMock.email_templates.findFirst).toHaveBeenCalledWith({
      where: {
        id: "src_foreign",
        OR: [{ isSystem: true }, { tenantId: TENANT_A }],
      },
    });
  });
});

describe("DELETE email-templates/[id] — removes ALL mappings before delete", () => {
  it("deleteMany's every mapping for the template, not just the first", async () => {
    prismaMock.email_templates.findFirst.mockResolvedValue({
      id: TEMPLATE_UUID,
      tenantId: TENANT_A,
    });
    prismaMock.email_event_mappings.deleteMany.mockResolvedValue({ count: 3 });
    prismaMock.email_templates.delete.mockResolvedValue({});

    const req = new NextRequest(
      `http://store.dev/api/tenant-admin/email-templates/${TEMPLATE_UUID}`,
      { method: "DELETE" },
    );
    const res = await deleteTemplate(req, { params: { id: TEMPLATE_UUID } });

    expect(res.status).toBe(200);
    expect(prismaMock.email_event_mappings.deleteMany).toHaveBeenCalledWith({
      where: { templateId: TEMPLATE_UUID },
    });
    expect(prismaMock.email_templates.delete).toHaveBeenCalledWith({
      where: { id: TEMPLATE_UUID },
    });
  });
});

describe("DELETE email-mappings — template kept while still referenced", () => {
  const resetReq = () =>
    new NextRequest(
      "http://store.dev/api/tenant-admin/email-mappings?eventType=welcome",
      { method: "DELETE" },
    );

  it("does NOT delete the template when another mapping still references it", async () => {
    prismaMock.email_event_mappings.findFirst.mockResolvedValue({
      id: "map_1",
      template: { id: "tmpl_shared", tenantId: TENANT_A },
    });
    prismaMock.email_event_mappings.delete.mockResolvedValue({});
    prismaMock.email_event_mappings.count.mockResolvedValue(2);

    await resetMapping(resetReq());

    expect(prismaMock.email_event_mappings.count).toHaveBeenCalledWith({
      where: { templateId: "tmpl_shared" },
    });
    expect(prismaMock.email_templates.delete).not.toHaveBeenCalled();
  });

  it("deletes the orphaned template only when no mapping references it", async () => {
    prismaMock.email_event_mappings.findFirst.mockResolvedValue({
      id: "map_1",
      template: { id: "tmpl_orphan", tenantId: TENANT_A },
    });
    prismaMock.email_event_mappings.delete.mockResolvedValue({});
    prismaMock.email_event_mappings.count.mockResolvedValue(0);
    prismaMock.email_templates.delete.mockResolvedValue({});

    await resetMapping(resetReq());

    expect(prismaMock.email_templates.delete).toHaveBeenCalledWith({
      where: { id: "tmpl_orphan" },
    });
  });
});
