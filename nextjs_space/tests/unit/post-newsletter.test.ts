import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Email Phase 2 US-022 — "Send as newsletter".
//
// Two halves, tested at the level each one decides something: the pure builder
// (what a post becomes) and the route (what is written, and what is refused).
// Module-boundary mocks only, so the REAL US-011 pipeline runs and the draft the
// route stores is checked against the shell, juice and the sanitizer rather than
// against a stub of them.
const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
const { resolveUserPermissions } = vi.hoisted(() => ({
  resolveUserPermissions: vi.fn(),
}));
const prismaMock = vi.hoisted(() => ({
  campaigns: { create: vi.fn() },
  posts: { findFirst: vi.fn() },
  tenants: { findFirst: vi.fn() },
}));

vi.mock("@/lib/auth-helper", () => ({ getCurrentUser }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/permissions/current-user-permissions", () => ({
  resolveUserPermissions,
}));

import { POST as campaignFromPost } from "@/app/api/tenant-admin/campaigns/from-post/route";
import { createCampaignFromPost } from "@/components/admin/email/campaign-from-post";
import { EMAIL_BUTTON_NAME } from "@/lib/email/email-button-node";
import type { EmailDocNode } from "@/lib/email/email-content-json";
import { EMAIL_IMAGE_NAME } from "@/lib/email/email-image-node";
import { EMAIL_CONTENT_WIDTH_PX } from "@/lib/email/email-layout";
import {
  buildPostNewsletterDraft,
  POST_NEWSLETTER_READ_MORE_LABEL,
  postStorefrontUrl,
} from "@/lib/email/post-newsletter";
import { resolvePermissions } from "@/lib/permissions/resolve";

const TENANT_A = "tenant-a";
const POST_UUID = "33333333-3333-3333-3333-333333333333";
const CAMPAIGN_UUID = "44444444-4444-4444-4444-444444444444";
const BASE_URL = "https://shop.example";

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

const POST_ROW = {
  title: "Harvest notes",
  slug: "harvest-notes",
  content: "<h2>What changed</h2><p>A calmer cure this season.</p>",
  excerpt: "Slower drying, softer smoke.",
  coverImage: "development/tenants/tenant-a/uploads/1712-cover.png",
  published: true,
};

function request(body: unknown) {
  return new NextRequest("http://store.dev/api/tenant-admin/campaigns/from-post", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

/** Data handed to the single create this test performed. */
function writtenData(fn: { mock: { calls: unknown[][] } }) {
  expect(fn.mock.calls).toHaveLength(1);
  return (fn.mock.calls[0][0] as { data: Record<string, unknown> }).data;
}

function signInAs(teamRole: string | null) {
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
    teamRole,
    // The REAL pure resolver, so the fixture cannot drift from production.
    permissions: resolvePermissions({ role: "TENANT_ADMIN", teamRole }),
  });
}

const nodeTypes = (nodes: readonly EmailDocNode[]) => nodes.map((n) => n.type);

beforeEach(() => {
  vi.clearAllMocks();
  signInAs("admin");
  prismaMock.posts.findFirst.mockResolvedValue(POST_ROW);
  prismaMock.tenants.findFirst.mockResolvedValue(TENANT_ROW);
  prismaMock.campaigns.create.mockImplementation(
    async (args: { data: Record<string, unknown> }) => ({
      id: CAMPAIGN_UUID,
      ...args.data,
    }),
  );
});

describe("buildPostNewsletterDraft", () => {
  it("orders the document cover, excerpt, article, call to action", () => {
    const draft = buildPostNewsletterDraft(POST_ROW, BASE_URL);
    const content = draft.contentJson.content ?? [];

    expect(nodeTypes(content)).toEqual([
      EMAIL_IMAGE_NAME,
      "paragraph",
      "heading",
      "paragraph",
      EMAIL_BUTTON_NAME,
    ]);
    expect(draft.contentJson.type).toBe("doc");
  });

  it("takes the subject and the campaign name from the post title", () => {
    const draft = buildPostNewsletterDraft(POST_ROW, BASE_URL);

    expect(draft.subject).toBe("Harvest notes");
    expect(draft.name).toBe("Harvest notes");
  });

  it("clamps a title past the campaign column limits", () => {
    const draft = buildPostNewsletterDraft(
      { ...POST_ROW, title: "x".repeat(600) },
      BASE_URL,
    );

    // 200 (name) and 500 (subject) — the campaigns table's own ceilings.
    expect(draft.name).toHaveLength(200);
    expect(draft.subject).toHaveLength(500);
  });

  it("sizes the cover image to the column and captions it with the title", () => {
    const [cover] = buildPostNewsletterDraft(POST_ROW, BASE_URL).contentJson
      .content!;

    expect(cover.attrs).toEqual({
      src: POST_ROW.coverImage,
      alt: POST_ROW.title,
      // Outlook renders through Word, which ignores max-width — see
      // lib/email/email-image-node.ts.
      width: EMAIL_CONTENT_WIDTH_PX,
    });
  });

  it("omits the cover and the standfirst when the post has neither", () => {
    const draft = buildPostNewsletterDraft(
      { ...POST_ROW, coverImage: null, excerpt: "   " },
      BASE_URL,
    );

    expect(nodeTypes(draft.contentJson.content ?? [])).toEqual([
      "heading",
      "paragraph",
      EMAIL_BUTTON_NAME,
    ]);
  });

  it("always ends on a Read more button pointing at the published post", () => {
    const content = buildPostNewsletterDraft(POST_ROW, BASE_URL).contentJson
      .content!;
    const button = content[content.length - 1];

    expect(button.type).toBe(EMAIL_BUTTON_NAME);
    expect(button.attrs).toEqual({
      href: `${BASE_URL}/the-wire/harvest-notes`,
      label: POST_NEWSLETTER_READ_MORE_LABEL,
      textAlign: "center",
    });
    expect(postStorefrontUrl("a b", BASE_URL)).toBe(`${BASE_URL}/the-wire/a%20b`);
  });

  it("drops what the email schema has no node for instead of carrying it into an inbox", () => {
    const draft = buildPostNewsletterDraft(
      {
        ...POST_ROW,
        coverImage: null,
        excerpt: null,
        content:
          '<p>Watch this</p><iframe src="https://video.example/x"></iframe><p>Then read on</p>',
      },
      BASE_URL,
    );
    const content = draft.contentJson.content ?? [];

    expect(nodeTypes(content)).toEqual(["paragraph", "paragraph", EMAIL_BUTTON_NAME]);
    expect(JSON.stringify(content)).not.toContain("video.example");
  });
});

describe("POST /api/tenant-admin/campaigns/from-post", () => {
  it("creates a DRAFT with no audience and never sends", async () => {
    const response = await campaignFromPost(request({ postId: POST_UUID }));

    expect(response.status).toBe(200);
    const data = writtenData(prismaMock.campaigns.create);
    expect(data.tenantId).toBe(TENANT_A);
    expect(data.status).toBe("DRAFT");
    expect(data.subject).toBe("Harvest notes");
    // Absent, not empty: US-019 only fans out to an audience the author chose.
    expect(data.audience).toBeUndefined();
  });

  it("renders the article, the durable cover and the unsubscribe slot into the stored HTML", async () => {
    await campaignFromPost(request({ postId: POST_UUID }));
    const html = writtenData(prismaMock.campaigns.create).contentHtml as string;

    expect(html).toContain("A calmer cure this season.");
    expect(html).toContain(`${BASE_URL}/the-wire/harvest-notes`);
    expect(html).toContain(POST_NEWSLETTER_READ_MORE_LABEL);
    // US-005's durable route, absolutised against the tenant's own host — a
    // presigned link would be dead an hour after the campaign was drafted.
    expect(html).toContain(
      `${BASE_URL}/api/public/images/development/tenants/tenant-a/uploads/1712-cover.png`,
    );
    // The marketing footer the shell always emits; the worker fills it per
    // recipient at send time.
    expect(html).toContain("{{unsubscribeUrl}}");
  });

  it("scopes the lookup to the caller's tenant", async () => {
    await campaignFromPost(request({ postId: POST_UUID }));

    expect(prismaMock.posts.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: POST_UUID, tenantId: TENANT_A },
      }),
    );
  });

  it("404s when the post belongs to another store", async () => {
    prismaMock.posts.findFirst.mockResolvedValue(null);

    const response = await campaignFromPost(request({ postId: POST_UUID }));

    expect(response.status).toBe(404);
    expect(prismaMock.campaigns.create).not.toHaveBeenCalled();
  });

  it("refuses an unpublished article — the newsletter would link to a 404", async () => {
    prismaMock.posts.findFirst.mockResolvedValue({ ...POST_ROW, published: false });

    const response = await campaignFromPost(request({ postId: POST_UUID }));

    expect(response.status).toBe(400);
    expect(prismaMock.campaigns.create).not.toHaveBeenCalled();
  });

  it("refuses a caller who may not author email (US-009)", async () => {
    signInAs("support");

    const response = await campaignFromPost(request({ postId: POST_UUID }));

    expect(response.status).toBe(403);
    expect(prismaMock.posts.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.campaigns.create).not.toHaveBeenCalled();
  });

  it("rejects a body that is not a post id", async () => {
    const response = await campaignFromPost(request({ postId: "not-a-uuid" }));

    expect(response.status).toBe(400);
    expect(prismaMock.campaigns.create).not.toHaveBeenCalled();
  });
});

// The Wire list's half of the action. The button itself is a one-line guard
// (`canSendAsNewsletter && post.published`) left to visual review — this covers
// the request it makes and, more importantly, what the author is told when it
// fails: the endpoint's refusals each name the fix, and a generic message would
// throw that away.
describe("createCampaignFromPost", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  // Nothing else in this file goes near the network, but a stub left standing is
  // a trap for whatever is appended below it.
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the article id and returns the campaign to open", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: CAMPAIGN_UUID }),
    });

    await expect(createCampaignFromPost(POST_UUID)).resolves.toEqual({
      id: CAMPAIGN_UUID,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/tenant-admin/campaigns/from-post",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ postId: POST_UUID }),
      }),
    );
  });

  it("surfaces the server's own sentence rather than a generic failure", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Publish this article before sending it." }),
    });

    await expect(createCampaignFromPost(POST_UUID)).rejects.toThrow(
      "Publish this article before sending it.",
    );
  });

  it("reports a dropped connection in our words, not the browser's", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(createCampaignFromPost(POST_UUID)).rejects.toThrow(
      "Failed to create the newsletter draft",
    );
  });

  it("treats a 200 with no campaign id as a failure", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    await expect(createCampaignFromPost(POST_UUID)).rejects.toThrow(
      "Failed to create the newsletter draft",
    );
  });
});
