import { NextResponse } from "next/server";

import { apiError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import {
  EMAIL_PREVIEW_RATE_LIMIT,
  emailPreviewBodySchema,
  emailPreviewRateLimitKey,
  renderEmailPreview,
} from "@/lib/email/email-preview";
import { requirePermission } from "@/lib/permissions/require-permission";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { parseJsonBody } from "@/lib/validation/body";

const ROUTE = "POST /api/tenant-admin/email-templates/preview";

// Same 512KB lift the save routes take: a max-size contentHtml exceeds the
// 256KB default once JSON-escaped.
const EMAIL_BODY_MAX_BYTES = 512 * 1024;

/**
 * US-015 — render the email the author is editing exactly as the save pipeline
 * would store it, with sample values filled in, for the preview iframe.
 *
 * Gated on `canEditEmails` rather than `canViewEmails`: it renders content the
 * CALLER supplies rather than anything stored, so it belongs with authoring.
 */
export const POST = requirePermission(
  "canEditEmails",
  async (req, { user, tenantId }) => {
    try {
      const limit = await checkRateLimit(
        emailPreviewRateLimitKey(user.id),
        EMAIL_PREVIEW_RATE_LIMIT,
      );
      if (!limit.success) return limit.response;

      const { templateId, contentHtml, contentJson, category, eventType } =
        await parseJsonBody(req, emailPreviewBodySchema, {
          maxBytes: EMAIL_BODY_MAX_BYTES,
        });

      const [existing, tenant] = await Promise.all([
        templateId
          ? prisma.email_templates.findFirst({
              // Tenant-scoped, so a templateId from the body cannot reach
              // another tenant's row — the same 404 either way.
              where: { id: templateId, tenantId },
              select: { category: true },
            })
          : null,
        prisma.tenants.findFirst({
          where: { id: tenantId },
          select: { businessName: true },
        }),
      ]);

      if (templateId && !existing) {
        return apiError(new Error("Template not found or access denied"), {
          route: ROUTE,
          status: 404,
          safeMessage: "Template not found or access denied",
        });
      }

      const html = await renderEmailPreview({
        contentHtml,
        contentJson,
        // The STORED category on an existing template: PUT ignores a submitted
        // one, so honouring the form here would preview an unsubscribe footer
        // the save would not write. A template that does not exist yet has only
        // the form's value to go on.
        eventType,
        category: existing ? existing.category : category,
        tenantId,
        businessName: tenant?.businessName,
      });

      return NextResponse.json({ html });
    } catch (error) {
      return apiError(error, { route: ROUTE });
    }
  },
);
