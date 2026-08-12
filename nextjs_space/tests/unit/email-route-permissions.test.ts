import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// US-009 — the granular permission gate on the tenant-admin email surface.
// `canViewEmails` governs every read, `canEditEmails` every mutation, across
// email-templates (list/detail/clone/test-send), email-mappings and email-logs.
//
// Module-boundary mocks only (getCurrentUser, prisma, permission resolution).
// The real auth wrapper, the real permission gate and the real pure resolver
// all execute — so this asserts the shipped precedence rules, not a hand-made
// permission set.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  email_templates: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  email_event_mappings: {
    findFirst: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  email_logs: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));

import { resolvePermissions, type RolePermissionRow } from "@/lib/permissions/resolve";
import {
  GET as listTemplates,
  POST as createTemplate,
} from "@/app/api/tenant-admin/email-templates/route";
import {
  GET as getTemplate,
  PUT as updateTemplate,
  DELETE as deleteTemplate,
} from "@/app/api/tenant-admin/email-templates/[id]/route";
import { POST as cloneTemplate } from "@/app/api/tenant-admin/email-templates/clone/route";
import {
  GET as listMappings,
  POST as bindMapping,
  DELETE as resetMapping,
} from "@/app/api/tenant-admin/email-mappings/route";
import { GET as listEmailLogs } from "@/app/api/tenant-admin/email-logs/route";

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

/** Run the REAL pure resolver — no I/O — so the fixtures can't drift from prod. */
function resolvedAs(teamRole: string | null, storedRow?: RolePermissionRow) {
  return {
    teamRole,
    permissions: resolvePermissions({ role: "TENANT_ADMIN", teamRole }, storedRow),
  };
}

/** A manager whose matrix was customised down to read-only email access. */
const VIEW_ONLY = () => resolvedAs("manager", { canViewEmails: true });
/** The `editor` preset grants neither email key. */
const NO_EMAIL_ACCESS = () => resolvedAs("editor");
/** The owner's own role — always all-true, never editable. */
const OWNER_ADMIN = () => resolvedAs("admin");
/** Pre-teams user with a null teamRole — legacy full-access admin. */
const LEGACY_ADMIN = () => resolvedAs(null);

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

interface RouteCall {
  name: string;
  run: () => Promise<Response>;
}

const READS: RouteCall[] = [
  {
    name: "GET email-templates",
    run: () => listTemplates(request("GET", "/api/tenant-admin/email-templates")),
  },
  {
    name: "GET email-templates/[id]",
    run: () =>
      getTemplate(
        request("GET", `/api/tenant-admin/email-templates/${TEMPLATE_UUID}`),
        { params: { id: TEMPLATE_UUID } },
      ),
  },
  {
    name: "GET email-mappings",
    run: () => listMappings(request("GET", "/api/tenant-admin/email-mappings")),
  },
  {
    name: "GET email-logs",
    run: () => listEmailLogs(request("GET", "/api/tenant-admin/email-logs")),
  },
];

const WRITES: RouteCall[] = [
  {
    name: "POST email-templates",
    run: () =>
      createTemplate(
        request("POST", "/api/tenant-admin/email-templates", {
          name: "New",
          subject: "Hi",
          contentHtml: "<p>Hi</p>",
        }),
      ),
  },
  {
    name: "PUT email-templates/[id]",
    run: () =>
      updateTemplate(
        request("PUT", `/api/tenant-admin/email-templates/${TEMPLATE_UUID}`, {
          subject: "Rewritten by a viewer",
        }),
        { params: { id: TEMPLATE_UUID } },
      ),
  },
  {
    name: "DELETE email-templates/[id]",
    run: () =>
      deleteTemplate(
        request("DELETE", `/api/tenant-admin/email-templates/${TEMPLATE_UUID}`),
        { params: { id: TEMPLATE_UUID } },
      ),
  },
  {
    name: "POST email-templates/clone",
    run: () =>
      cloneTemplate(
        request("POST", "/api/tenant-admin/email-templates/clone", {
          originalTemplateId: TEMPLATE_UUID,
          eventType: "welcome",
        }),
      ),
  },
  {
    name: "POST email-mappings",
    run: () =>
      bindMapping(
        request("POST", "/api/tenant-admin/email-mappings", {
          eventType: "welcome",
          templateId: TEMPLATE_UUID,
        }),
      ),
  },
  {
    name: "DELETE email-mappings",
    run: () =>
      resetMapping(
        request("DELETE", "/api/tenant-admin/email-mappings?eventType=welcome"),
      ),
  },
];

/** Nothing may reach the database on a denied mutation. */
function expectNoWrites() {
  expect(prismaMock.email_templates.create).not.toHaveBeenCalled();
  expect(prismaMock.email_templates.update).not.toHaveBeenCalled();
  expect(prismaMock.email_templates.delete).not.toHaveBeenCalled();
  expect(prismaMock.email_event_mappings.upsert).not.toHaveBeenCalled();
  expect(prismaMock.email_event_mappings.delete).not.toHaveBeenCalled();
  expect(prismaMock.email_event_mappings.deleteMany).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(adminUser());
  resolveUserPermissions.mockResolvedValue(OWNER_ADMIN());

  prismaMock.email_templates.findMany.mockResolvedValue([]);
  prismaMock.email_templates.findFirst.mockResolvedValue({
    id: TEMPLATE_UUID,
    name: "Welcome",
    subject: "Hi",
    contentHtml: "<p>Hi</p>",
    category: "Transactional",
    description: null,
    tenantId: TENANT_A,
  });
  prismaMock.email_templates.count.mockResolvedValue(1);
  prismaMock.email_templates.create.mockResolvedValue({ id: TEMPLATE_UUID });
  prismaMock.email_templates.update.mockResolvedValue({ id: TEMPLATE_UUID });
  prismaMock.email_templates.delete.mockResolvedValue({ id: TEMPLATE_UUID });
  prismaMock.email_event_mappings.findFirst.mockResolvedValue({
    id: "mapping-1",
    eventType: "welcome",
    template: { id: TEMPLATE_UUID, tenantId: TENANT_A },
  });
  prismaMock.email_event_mappings.upsert.mockResolvedValue({ id: "mapping-1" });
  prismaMock.email_event_mappings.delete.mockResolvedValue({ id: "mapping-1" });
  prismaMock.email_event_mappings.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.email_event_mappings.count.mockResolvedValue(1);
  prismaMock.email_logs.findMany.mockResolvedValue([]);
  prismaMock.email_logs.count.mockResolvedValue(0);
});

describe("permission fixtures resolve the way PRD-301 says they do", () => {
  it("gives the owner-admin role — and legacy null-teamRole users — both email keys", () => {
    for (const subject of [OWNER_ADMIN(), LEGACY_ADMIN()]) {
      expect(subject.permissions.canViewEmails).toBe(true);
      expect(subject.permissions.canEditEmails).toBe(true);
    }
  });

  it("gives the editor preset neither email key", () => {
    expect(NO_EMAIL_ACCESS().permissions.canViewEmails).toBe(false);
    expect(NO_EMAIL_ACCESS().permissions.canEditEmails).toBe(false);
  });

  it("honours a stored matrix row that grants view without edit", () => {
    expect(VIEW_ONLY().permissions.canViewEmails).toBe(true);
    expect(VIEW_ONLY().permissions.canEditEmails).toBe(false);
  });
});

describe("canEditEmails gates every email mutation", () => {
  // The headline AC: a member holding canViewEmails only must not be able to
  // rewrite a template — nor clone, delete, or rebind an event mapping.
  it.each(WRITES)("403s a canViewEmails-only member on $name", async ({ run }) => {
    resolveUserPermissions.mockResolvedValue(VIEW_ONLY());

    const res = await run();

    expect(res.status).toBe(403);
    expectNoWrites();
  });

  it("returns the standard error shape on denial, with no internals", async () => {
    resolveUserPermissions.mockResolvedValue(VIEW_ONLY());

    const res = await WRITES[1].run(); // PUT email-templates/[id]
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json).toEqual({ error: expect.any(String) });
    expect(json.error).not.toMatch(/prisma|tenant-a|stack/i);
  });

  it.each(WRITES)("lets the owner-admin through on $name", async ({ run }) => {
    resolveUserPermissions.mockResolvedValue(OWNER_ADMIN());

    const res = await run();

    expect(res.status).toBe(200);
  });
});

describe("canViewEmails gates every email read", () => {
  it.each(READS)("403s a member without canViewEmails on $name", async ({ run }) => {
    resolveUserPermissions.mockResolvedValue(NO_EMAIL_ACCESS());

    const res = await run();

    expect(res.status).toBe(403);
    expect(prismaMock.email_templates.findMany).not.toHaveBeenCalled();
    expect(prismaMock.email_logs.findMany).not.toHaveBeenCalled();
  });

  it.each(READS)("lets a canViewEmails-only member read $name", async ({ run }) => {
    resolveUserPermissions.mockResolvedValue(VIEW_ONLY());

    const res = await run();

    expect(res.status).toBe(200);
  });

  it.each(READS)("lets the owner-admin read $name", async ({ run }) => {
    resolveUserPermissions.mockResolvedValue(OWNER_ADMIN());

    expect((await run()).status).toBe(200);
  });
});

describe("the gate sits behind authentication, not in front of it", () => {
  it.each([...READS, ...WRITES])(
    "401s an unauthenticated caller on $name — before resolving permissions",
    async ({ run }) => {
      getCurrentUser.mockResolvedValue(null);

      const res = await run();

      expect(res.status).toBe(401);
      expect(resolveUserPermissions).not.toHaveBeenCalled();
      expectNoWrites();
    },
  );

  it("resolves permissions against the caller's OWN tenant", async () => {
    resolveUserPermissions.mockResolvedValue(OWNER_ADMIN());

    await READS[0].run();

    expect(resolveUserPermissions).toHaveBeenCalledWith(
      expect.objectContaining({ id: "admin_1" }),
      TENANT_A,
    );
  });
});
