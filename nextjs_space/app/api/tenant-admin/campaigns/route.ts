import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, apiValidationError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { resolveCampaignContent } from "@/lib/email/campaign-content";
import {
  CAMPAIGN_BODY_MAX_BYTES,
  CAMPAIGN_DETAIL_SELECT,
  CAMPAIGN_NAME_MAX,
  CAMPAIGN_SUBJECT_MAX,
  CAMPAIGN_SUMMARY_SELECT,
  EMPTY_SUBJECT_MESSAGE,
  summariseCampaigns,
  type CampaignRecipientCountRow,
  type CampaignSummaryRow,
} from "@/lib/email/campaign-fields";
import { emailContentJsonSchema } from "@/lib/email/email-content-json";
import { requirePermission } from "@/lib/permissions/require-permission";
import { sanitizeEmailSubject } from "@/lib/security/email-sanitize";
import { parseJsonBody } from "@/lib/validation/body";

const LIST_ROUTE = "GET /api/tenant-admin/campaigns";
const CREATE_ROUTE = "POST /api/tenant-admin/campaigns";

/**
 * US-017 — a campaign is created from a composer document, never raw HTML.
 *
 * `contentJson` is required because the unsubscribe footer is applied by the
 * shell the pipeline wraps the document in; accepting hand-written HTML would
 * mean accepting a marketing email whose only compliance guarantee is that the
 * author remembered. `status` is absent on purpose — a campaign is created as a
 * DRAFT and only US-021's scheduling moves it on.
 */
const campaignCreateSchema = z.object({
  name: z.string().trim().min(1).max(CAMPAIGN_NAME_MAX),
  subject: z.string().trim().min(1).max(CAMPAIGN_SUBJECT_MAX),
  contentJson: emailContentJsonSchema,
});

// Reading a campaign exposes its subject lines and audience the same way a
// template exposes its authored content, so the list follows US-009: viewing on
// canViewEmails, every mutation on canEditEmails.
export const GET = requirePermission("canViewEmails", async (_req, { tenantId }) => {
  try {
    // Annotated because `prisma` is exported as `any` (lib/db.ts) — without it
    // the fold below would run unchecked against whatever the select returns.
    const campaigns: CampaignSummaryRow[] = await prisma.campaigns.findMany({
      where: { tenantId },
      // Most-recently-touched first, which is the column the list shows: a
      // draft edited this morning belongs at the top, not wherever it was
      // created. Ordering by createdAt while labelling the column "Last
      // Updated" would be a table that quietly disagrees with itself.
      orderBy: [{ updatedAt: "desc" }],
      select: CAMPAIGN_SUMMARY_SELECT,
    });

    // `campaign_recipients` carries no tenantId and is not in the $extends
    // scope set (lib/db.ts) — it is reachable only through its campaign. The
    // ids below came from the scoped query above, which is what keeps this
    // count inside the tenant.
    const counts: CampaignRecipientCountRow[] = campaigns.length
      ? await prisma.campaign_recipients.groupBy({
          by: ["campaignId", "status"],
          where: { campaignId: { in: campaigns.map((campaign) => campaign.id) } },
          _count: { _all: true },
        })
      : [];

    return NextResponse.json(summariseCampaigns(campaigns, counts));
  } catch (error) {
    return apiError(error, { route: LIST_ROUTE });
  }
});

export const POST = requirePermission("canEditEmails", async (req, { tenantId }) => {
  try {
    const { name, subject, contentJson } = await parseJsonBody(
      req,
      campaignCreateSchema,
      { maxBytes: CAMPAIGN_BODY_MAX_BYTES },
    );

    // Sanitize first, then check: the subject is tag-stripped, so a body of
    // nothing but markup arrives non-empty and leaves empty, and a campaign
    // with a blank subject line is not one anybody meant to send.
    const safeSubject = sanitizeEmailSubject(subject);
    if (!safeSubject.trim()) {
      return apiValidationError(EMPTY_SUBJECT_MESSAGE, CREATE_ROUTE);
    }

    // Renders through the US-011 pipeline as marketing, and refuses to return
    // HTML without an unsubscribe link — so nothing is written when it fails.
    const content = await resolveCampaignContent(contentJson, tenantId);

    const campaign = await prisma.campaigns.create({
      data: {
        tenantId,
        // Already trimmed and length-capped by the schema — Zod's `.trim()`
        // runs before `.min`/`.max`, so a whitespace-only name never gets here.
        name,
        subject: safeSubject,
        status: "DRAFT",
        ...content,
      },
      select: CAMPAIGN_DETAIL_SELECT,
    });

    return NextResponse.json(campaign);
  } catch (error) {
    return apiError(error, { route: CREATE_ROUTE });
  }
});
