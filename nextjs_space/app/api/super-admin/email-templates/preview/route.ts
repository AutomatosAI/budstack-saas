import { NextResponse } from "next/server";

import { withSuperAdmin } from "@/lib/api-auth";
import { ApiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import {
  EMAIL_PREVIEW_RATE_LIMIT,
  emailPreviewBodySchema,
  emailPreviewRateLimitKey,
  renderEmailPreview,
} from "@/lib/email/email-preview";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { parseJsonBody } from "@/lib/validation/body";

// Same 512KB lift the save routes take: a max-size contentHtml exceeds the
// 256KB default once JSON-escaped.
const EMAIL_BODY_MAX_BYTES = 512 * 1024;

/**
 * US-015 — the super-admin preview.
 *
 * A super-admin can edit a TENANT-owned template as well as a platform one, and
 * `PUT /api/super-admin/email-templates/[id]` builds the shell from the row's
 * own owner. This reads the owner the same way rather than assuming systemwide,
 * so the preview and the save cannot show different chrome. With no template id
 * (the create screen) it renders the system shell, whose business name is the
 * `{{businessName}}` slot the sample set fills.
 *
 * Metered per admin, since there is no tenant to meter.
 */
export const POST = withSuperAdmin(async (req, { user }) => {
  const limit = await checkRateLimit(
    emailPreviewRateLimitKey(`super-admin:${user.id}`),
    EMAIL_PREVIEW_RATE_LIMIT,
  );
  if (!limit.success) return limit.response;

  const { templateId, contentHtml, contentJson, category, eventType } =
    await parseJsonBody(req, emailPreviewBodySchema, {
      maxBytes: EMAIL_BODY_MAX_BYTES,
    });

  const owner = templateId
    ? await prisma.email_templates.findUnique({
        where: { id: templateId },
        select: { tenantId: true, category: true },
      })
    : null;

  if (templateId && !owner) {
    throw new ApiError("Template not found", 404);
  }

  const tenant = owner?.tenantId
    ? await prisma.tenants.findFirst({
        where: { id: owner.tenantId },
        select: { businessName: true },
      })
    : null;

  const html = await renderEmailPreview({
    contentHtml,
    contentJson,
    eventType,
    // The form may be changing the category in the same edit; that wins, the
    // way PUT lets it win, including when it clears it.
    category: category !== undefined ? category : owner?.category,
    tenantId: owner?.tenantId ?? null,
    businessName: tenant?.businessName,
    // Same reason as the tenant route: the srcdoc pane inherits the admin CSP.
    baseUrlOverride: req.nextUrl.origin,
  });

  return NextResponse.json({ html });
});
