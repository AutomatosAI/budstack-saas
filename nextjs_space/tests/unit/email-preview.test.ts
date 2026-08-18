import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Email Phase 2 US-015 — the preview.
//
// The claim the pane makes is "this is the email that will be sent", and three
// things have to hold for that not to be a lie:
//
//   1. IT IS THE SAVE PIPELINE. `renderEmailPreview` runs the same
//      `resolveTemplateContent` a save runs — shell, inlined CSS, sanitized —
//      so a preview cannot show chrome or markup the save would not store.
//   2. THE TAGS ARE FILLED. US-006's canned sample set, through the worker's own
//      Handlebars helpers, so what is previewed is what the worker produces.
//   3. THE CONTENT IS THE CALLER'S, THE TENANT IS NOT. Both routes take the
//      body's content and the SESSION's tenant; a templateId in the body only
//      selects a row the caller already owns.
//
// Module-boundary mocks only (getCurrentUser, prisma, rate limiter). The real
// auth wrapper, permission gate, render pipeline and sanitizer all execute.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));
const prismaMock = vi.hoisted(() => ({
  email_templates: { findFirst: vi.fn(), findUnique: vi.fn() },
  tenants: { findFirst: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimit }));

import {
  DEFAULT_EMAIL_PREVIEW_WIDTH,
  EMAIL_PREVIEW_FAILED_MESSAGE,
  EMAIL_PREVIEW_WIDTHS,
  emailPreviewErrorMessage,
  emailPreviewRequest,
} from "@/components/admin/email/email-preview-request";
import { EMPTY_EMAIL_DOC } from "@/components/admin/email/email-editor-mode";
import type { EmailContentJson } from "@/lib/email/email-content-json";
import {
  EMAIL_PREVIEW_RATE_LIMIT,
  emailPreviewBodySchema,
  emailPreviewRateLimitKey,
  renderEmailPreview,
} from "@/lib/email/email-preview";
import { MAX_TEMPLATE_BLOCK_DEPTH } from "@/lib/email/render-template-field";
import { sampleVariablesForEvent } from "@/lib/email/sample-variables";
import { ALL_FALSE } from "@/lib/permissions/permission-keys";
import { POST as tenantPreview } from "@/app/api/tenant-admin/email-templates/preview/route";
import { POST as superAdminPreview } from "@/app/api/super-admin/email-templates/preview/route";

const TENANT_A = "tenant-a";
const TEMPLATE_UUID = "11111111-1111-1111-1111-111111111111";

const TENANT_ROW = {
  id: TENANT_A,
  businessName: "Live Store",
  subdomain: "live-store",
  customDomain: "shop.example",
  settings: null,
  businessAddress1: "1 Sample Street",
  businessCity: "Dublin",
  tenant_branding: { logoUrl: null, primaryColor: "#7c3aed" },
};

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

/** A one-paragraph composer document carrying a merge tag. */
function docWith(text: string): EmailContentJson {
  return {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

function previewRequest(body: unknown, path: string) {
  return new NextRequest(`http://store.dev${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const callTenantRoute = (body: unknown) =>
  tenantPreview(
    previewRequest(body, "/api/tenant-admin/email-templates/preview"),
  );

const callSuperRoute = (body: unknown) =>
  superAdminPreview(
    previewRequest(body, "/api/super-admin/email-templates/preview"),
  );

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue(adminUser());
  resolveUserPermissions.mockResolvedValue({
    teamRole: "manager",
    permissions: { ...ALL_FALSE, canEditEmails: true },
  });
  checkRateLimit.mockResolvedValue({ success: true });
  prismaMock.tenants.findFirst.mockResolvedValue(TENANT_ROW);
  prismaMock.email_templates.findFirst.mockResolvedValue({
    category: "transactional",
  });
  prismaMock.email_templates.findUnique.mockResolvedValue({
    tenantId: null,
    category: "transactional",
  });
});

describe("emailPreviewRequest — what the pane asks for", () => {
  const doc = docWith("Hello");

  it("previews the DOCUMENT in simple mode, never the stale HTML beside it", () => {
    const body = emailPreviewRequest({
      mode: "simple",
      contentHtml: "<p>left over from the HTML tab</p>",
      contentJson: doc,
    });

    expect(body.contentJson).toEqual(doc);
    expect(body.contentHtml).toBeUndefined();
  });

  it("sends the empty document for a composer nobody has typed into", () => {
    // Mirrors the save path: sending nothing would preview whatever raw HTML
    // the form still carries — for a new template, the starter sample.
    expect(
      emailPreviewRequest({ mode: "simple", contentHtml: "<p>x</p>", contentJson: null })
        .contentJson,
    ).toEqual(EMPTY_EMAIL_DOC);
  });

  it("previews the HTML in advanced mode, with an explicit null document", () => {
    const body = emailPreviewRequest({
      mode: "advanced",
      contentHtml: "<p>hand written</p>",
      contentJson: doc,
    });

    expect(body.contentHtml).toBe("<p>hand written</p>");
    expect(body.contentJson).toBeNull();
  });

  it("carries the template id, category and event when the screen has them", () => {
    expect(
      emailPreviewRequest({
        mode: "simple",
        contentHtml: "",
        contentJson: doc,
        category: "marketing",
        eventType: "welcome",
        templateId: TEMPLATE_UUID,
      }),
    ).toMatchObject({
      templateId: TEMPLATE_UUID,
      category: "marketing",
      eventType: "welcome",
    });
  });

  it("offers exactly the two widths the story specifies", () => {
    expect(EMAIL_PREVIEW_WIDTHS.map((w) => w.value)).toEqual([375, 800]);
    expect(EMAIL_PREVIEW_WIDTHS.map((w) => w.value)).toContain(
      DEFAULT_EMAIL_PREVIEW_WIDTH,
    );
  });
});

describe("emailPreviewBodySchema — one contract, two routes", () => {
  // Both routes validate with THIS schema, so the builder and the boundary
  // cannot drift. Feeding the builder's own output through it is the check that
  // matters: a field added to one and not the other fails here.
  it("accepts what the pane actually builds, in both modes", () => {
    for (const mode of ["simple", "advanced"] as const) {
      const built = emailPreviewRequest({
        mode,
        contentHtml: "<p>hand written</p>",
        contentJson: docWith("Hi {{userName}}"),
        category: "marketing",
        eventType: "welcome",
        templateId: TEMPLATE_UUID,
      });

      expect(emailPreviewBodySchema.safeParse(built).success).toBe(true);
    }
  });

  it("has no tenantId field, so a body cannot name one", () => {
    const parsed = emailPreviewBodySchema.parse({
      contentJson: docWith("Hi"),
      tenantId: "tenant-b",
    });

    expect(parsed).not.toHaveProperty("tenantId");
  });

  it("rejects a templateId that is not a uuid", () => {
    expect(
      emailPreviewBodySchema.safeParse({
        contentJson: docWith("Hi"),
        templateId: "not-a-uuid",
      }).success,
    ).toBe(false);
  });
});

describe("emailPreviewErrorMessage — what the pane's banner says", () => {
  it("keeps the retry-after detail a 429 puts in `message`", () => {
    // The rate limiter is the one recoverable failure the pane can hit, and it
    // is the only responder that sends both keys: `error` is the bare "Too many
    // requests", `message` is the part that tells the author when to try again.
    expect(
      emailPreviewErrorMessage({
        error: "Too many requests",
        message: "Rate limit exceeded. Please try again in 12 seconds.",
      }),
    ).toContain("12 seconds");
  });

  it("uses the standard apiError envelope, which carries no `message`", () => {
    expect(
      emailPreviewErrorMessage({
        error: "There is nothing to preview yet — add some content first.",
        correlationId: "abc",
      }),
    ).toBe("There is nothing to preview yet — add some content first.");
  });

  it("falls back when the body is unparseable, empty or the wrong shape", () => {
    for (const payload of [null, undefined, {}, { error: "" }, { error: 42 }]) {
      expect(emailPreviewErrorMessage(payload)).toBe(
        EMAIL_PREVIEW_FAILED_MESSAGE,
      );
    }
  });
});

describe("renderEmailPreview — the save pipeline, with sample values", () => {
  it("wraps a document in the tenant's shell and fills its merge tags", async () => {
    const html = await renderEmailPreview({
      contentJson: docWith("Hi {{userName}}, order {{orderNumber}} is on its way"),
      tenantId: TENANT_A,
      businessName: "Live Store",
    });

    const samples = sampleVariablesForEvent(null);
    expect(html).toContain(samples.userName);
    expect(html).toContain(samples.orderNumber);
    // The shell came with it — a preview of the body alone would hide the
    // header and footer an author is signing off on.
    expect(html).toContain("Live Store");
    expect(html).toContain("1 Sample Street");
    // Nothing unfilled survives into the pane.
    expect(html).not.toContain("{{");
  });

  it("inlines CSS and sanitizes it LAST — style attributes survive, script does not", async () => {
    const html = await renderEmailPreview({
      contentJson: docWith("Inlined"),
      tenantId: TENANT_A,
    });

    expect(html).toMatch(/style="/);
    expect(html).not.toMatch(/<script/i);
  });

  it("substitutes the event's own sample set when the template is mapped", async () => {
    const html = await renderEmailPreview({
      contentJson: docWith("Status: {{status}}"),
      tenantId: TENANT_A,
      eventType: "order-status-update",
    });

    expect(html).toContain("SHIPPED");
  });

  it("renders an unsubscribe footer only for a marketing template", async () => {
    const marketing = await renderEmailPreview({
      contentJson: docWith("Newsletter"),
      tenantId: TENANT_A,
      category: "marketing",
    });
    const transactional = await renderEmailPreview({
      contentJson: docWith("Receipt"),
      tenantId: TENANT_A,
      category: "transactional",
    });

    expect(marketing).toMatch(/unsubscribe/i);
    // The per-recipient token only exists at fan-out, so the preview shows the
    // sample link rather than a footer with a dead href.
    expect(marketing).toContain("sample-token");
    expect(transactional).not.toMatch(/unsubscribe/i);
  });

  it("sanitizes raw HTML from the advanced editor, and fills its tags too", async () => {
    const html = await renderEmailPreview({
      contentHtml:
        '<p>Hi {{userName}}</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>',
      contentJson: null,
      tenantId: TENANT_A,
    });

    expect(html).toContain("Sample Customer");
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/javascript:/i);
  });

  it("uses the {{businessName}} slot for a system template with no tenant", async () => {
    const html = await renderEmailPreview({
      contentJson: docWith("Platform notice"),
      tenantId: null,
    });

    // The slot is filled by the sample set, exactly as the worker fills it from
    // the variables bag at send time.
    expect(html).toContain("Sample Store");
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
  });

  it("400s when the request carries neither a document nor HTML", async () => {
    await expect(
      renderEmailPreview({ tenantId: TENANT_A }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("400s a template nested past the request-path depth cap", async () => {
    const bomb =
      "{{#each items}}".repeat(MAX_TEMPLATE_BLOCK_DEPTH + 1) +
      "x" +
      "{{/each}}".repeat(MAX_TEMPLATE_BLOCK_DEPTH + 1);

    await expect(
      renderEmailPreview({ contentHtml: bomb, contentJson: null, tenantId: TENANT_A }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("POST tenant-admin email-templates/preview", () => {
  it("returns the rendered document for the content in the body", async () => {
    const res = await callTenantRoute({
      contentJson: docWith("Hi {{userName}}"),
      category: "transactional",
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.html).toContain("Sample Customer");
    expect(json.html).toContain("Live Store");
  });

  it("renders through the SESSION's tenant, ignoring anything the body claims", async () => {
    const res = await callTenantRoute({
      contentJson: docWith("Hi"),
      tenantId: "tenant-b",
    });

    expect(res.status).toBe(200);
    expect(prismaMock.tenants.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TENANT_A } }),
    );
  });

  it("scopes a templateId to the caller's tenant and 404s anything else", async () => {
    prismaMock.email_templates.findFirst.mockResolvedValue(null);

    const res = await callTenantRoute({
      contentJson: docWith("Hi"),
      templateId: TEMPLATE_UUID,
    });

    expect(res.status).toBe(404);
    expect(prismaMock.email_templates.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TEMPLATE_UUID, tenantId: TENANT_A } }),
    );
  });

  it("previews the STORED category, not one the form submitted", async () => {
    // PUT ignores a submitted category, so honouring it here would preview an
    // unsubscribe footer the save would never write.
    prismaMock.email_templates.findFirst.mockResolvedValue({
      category: "transactional",
    });

    const res = await callTenantRoute({
      contentJson: docWith("Newsletter"),
      templateId: TEMPLATE_UUID,
      category: "marketing",
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.html).not.toMatch(/unsubscribe/i);
  });

  it("meters per admin, before any render", async () => {
    checkRateLimit.mockResolvedValue({
      success: false,
      response: new Response(null, { status: 429 }),
    });

    const res = await callTenantRoute({ contentJson: docWith("Hi") });

    expect(res.status).toBe(429);
    expect(checkRateLimit).toHaveBeenCalledWith(
      emailPreviewRateLimitKey("admin_1"),
      EMAIL_PREVIEW_RATE_LIMIT,
    );
    // Fails open: nothing leaves the building here, so a Redis outage must not
    // take the editor's preview down with it.
    expect(EMAIL_PREVIEW_RATE_LIMIT.failMode).toBe("open");
  });

  it("403s a caller without canEditEmails", async () => {
    resolveUserPermissions.mockResolvedValue({
      teamRole: "viewer",
      permissions: { ...ALL_FALSE, canViewEmails: true },
    });

    const res = await callTenantRoute({ contentJson: docWith("Hi") });

    expect(res.status).toBe(403);
  });

  it("401s an unauthenticated caller", async () => {
    getCurrentUser.mockResolvedValue(null);

    const res = await callTenantRoute({ contentJson: docWith("Hi") });

    expect(res.status).toBe(401);
    expect(resolveUserPermissions).not.toHaveBeenCalled();
  });

  it("400s a body that is not a valid composer document", async () => {
    const res = await callTenantRoute({ contentJson: { type: "not-a-doc" } });

    expect(res.status).toBe(400);
  });
});

describe("POST super-admin email-templates/preview", () => {
  const superAdmin = () =>
    adminUser({ id: "super_1", role: "SUPER_ADMIN", tenantId: null });

  beforeEach(() => {
    getCurrentUser.mockResolvedValue(superAdmin());
  });

  it("renders a platform template with no tenant at all", async () => {
    const res = await callSuperRoute({ contentJson: docWith("Platform notice") });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.html).toContain("Sample Store");
    expect(prismaMock.tenants.findFirst).not.toHaveBeenCalled();
  });

  it("renders a TENANT-owned template through that tenant's shell", async () => {
    // The same owner lookup PUT does — otherwise the preview shows platform
    // chrome for a template the save would brand.
    prismaMock.email_templates.findUnique.mockResolvedValue({
      tenantId: TENANT_A,
      category: "transactional",
    });

    const res = await callSuperRoute({
      contentJson: docWith("Hi"),
      templateId: TEMPLATE_UUID,
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.html).toContain("Live Store");
  });

  it("404s a template id that does not exist", async () => {
    prismaMock.email_templates.findUnique.mockResolvedValue(null);

    const res = await callSuperRoute({
      contentJson: docWith("Hi"),
      templateId: TEMPLATE_UUID,
    });

    expect(res.status).toBe(404);
  });

  it("401s a tenant admin reaching for the platform route", async () => {
    getCurrentUser.mockResolvedValue(adminUser());

    const res = await callSuperRoute({ contentJson: docWith("Hi") });

    expect(res.status).toBe(401);
  });
});

// The lekkerweed report (2026-08-18): uploaded images rendered fine in the
// composer but broken in the preview pane. The pipeline absolutises image srcs
// against the TENANT's domain, and the pane's srcdoc iframe inherits the admin
// page's CSP — whose img-src carries no tenant hosts — so the browser blocked
// exactly the URLs a real inbox loads happily. The routes now pass the
// request's own origin as `baseUrlOverride`, making preview assets same-origin
// with the admin page ('self') while stored/mailed HTML keeps the tenant host.
describe("renderEmailPreview — baseUrlOverride", () => {
  const UPLOADED_SRC =
    "/api/public/images/development/tenants/tenant-a/uploads/1-banner.png";

  const docWithImage = (): EmailContentJson => ({
    type: "doc",
    content: [
      { type: "image", attrs: { src: UPLOADED_SRC } },
      { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
    ],
  });

  it("absolutises an uploaded image against the admin origin, not the tenant domain", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue(TENANT_ROW);

    const html = await renderEmailPreview({
      contentJson: docWithImage(),
      tenantId: TENANT_A,
      baseUrlOverride: "https://app.budstacks.io",
    });

    expect(html).toContain(`https://app.budstacks.io${UPLOADED_SRC}`);
    expect(html).not.toContain(`https://shop.example${UPLOADED_SRC}`);
  });

  it("keeps the tenant domain when no override is given (the save-path shape)", async () => {
    prismaMock.tenants.findFirst.mockResolvedValue(TENANT_ROW);

    const html = await renderEmailPreview({
      contentJson: docWithImage(),
      tenantId: TENANT_A,
    });

    expect(html).toContain(`https://shop.example${UPLOADED_SRC}`);
  });
});
