import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, apiError, apiValidationError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { resolveCampaignContent } from "@/lib/email/campaign-content";
import {
  CAMPAIGN_DETAIL_SELECT,
  EMPTY_SUBJECT_MESSAGE,
} from "@/lib/email/campaign-fields";
import { buildPostNewsletterDraft } from "@/lib/email/post-newsletter";
import { requirePermission } from "@/lib/permissions/require-permission";
import { sanitizeEmailSubject } from "@/lib/security/email-sanitize";
import { getTenantBaseUrl } from "@/lib/tenant/tenant-utils";
import { parseJsonBody } from "@/lib/validation/body";

/**
 * US-022 — "Send as newsletter": one click from a Wire post to a campaign DRAFT.
 *
 * It lives under `campaigns` rather than under `posts` because a campaign is
 * what it creates: the gate is `canEditEmails` (authoring email, US-009), the
 * body it writes is checked by `resolveCampaignContent` exactly as a composed
 * one is, and the response is the campaign the author is redirected into. A
 * post-shaped route would have put an email permission on the blog surface and
 * left two places that know how a campaign is created.
 *
 * IT NEVER SENDS. `status: "DRAFT"` and no `audience` — the author still has to
 * choose a list and press send in the composer. That is deliberate: a button on
 * a blog list that mails the customer base would be one misclick from an
 * unrecoverable mistake.
 */
const ROUTE = "POST /api/tenant-admin/campaigns/from-post";

const fromPostSchema = z.object({
  postId: z.string().uuid(),
});

const NOT_FOUND_MESSAGE = "Article not found or access denied";
const UNPUBLISHED_MESSAGE =
  "Publish this article before sending it as a newsletter — the email links to the published page.";
const STORE_NOT_FOUND_MESSAGE = "Store not found";

export const POST = requirePermission("canEditEmails", async (req, { tenantId }) => {
  try {
    const { postId } = await parseJsonBody(req, fromPostSchema);

    // findFirst with flat fields, tenant-scoped: the id arrives in a request
    // body, so the tenantId in the `where` is the only thing standing between
    // an admin and another store's unpublished drafts.
    const post = await prisma.posts.findFirst({
      where: { id: postId, tenantId },
      select: {
        title: true,
        slug: true,
        content: true,
        excerpt: true,
        coverImage: true,
        published: true,
      },
    });

    if (!post) {
      return apiError(new Error(NOT_FOUND_MESSAGE), {
        route: ROUTE,
        status: 404,
        safeMessage: NOT_FOUND_MESSAGE,
      });
    }

    // The newsletter's call to action points at the storefront page, which
    // 404s while the post is a draft. Refusing here is the difference between
    // an author noticing now and a recipient noticing later.
    if (!post.published) {
      return apiValidationError(UNPUBLISHED_MESSAGE, ROUTE);
    }

    // Only the two URL columns. `loadEmailShellTenant` would answer the same
    // question, but it also reads `settings` — which holds SMTP credentials —
    // and that value has no business outside the render path.
    const tenant = await prisma.tenants.findFirst({
      where: { id: tenantId },
      select: { subdomain: true, customDomain: true },
    });
    if (!tenant) throw new ApiError(STORE_NOT_FOUND_MESSAGE, 404);

    const draft = buildPostNewsletterDraft(post, getTenantBaseUrl(tenant));

    // A title is `min(1)` on the posts schema, but it is tag-stripped here for
    // the same reason the composer's subject is: markup in a subject line is
    // never presentational and may be all that a title contains.
    const safeSubject = sanitizeEmailSubject(draft.subject);
    if (!safeSubject.trim()) {
      return apiValidationError(EMPTY_SUBJECT_MESSAGE, ROUTE);
    }

    // The US-011 pipeline, as marketing — including the unsubscribe assertion,
    // so a post that renders without a footer link is never stored.
    const content = await resolveCampaignContent(draft.contentJson, tenantId);

    const campaign = await prisma.campaigns.create({
      data: {
        tenantId,
        name: draft.name,
        subject: safeSubject,
        status: "DRAFT",
        ...content,
      },
      select: CAMPAIGN_DETAIL_SELECT,
    });

    return NextResponse.json(campaign);
  } catch (error) {
    return apiError(error, { route: ROUTE });
  }
});
