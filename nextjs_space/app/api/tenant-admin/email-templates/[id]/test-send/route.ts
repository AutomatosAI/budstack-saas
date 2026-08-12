import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, apiValidationError } from "@/lib/api-error";
import { requirePermissionParams } from "@/lib/permissions/require-permission";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { parseUuid } from "@/lib/validation/parse-uuid";
import {
  queueTestSend,
  TEST_SEND_RATE_LIMIT,
  testSendRateLimitKey,
} from "@/lib/email/test-send";

const ROUTE = "POST /api/tenant-admin/email-templates/[id]/test-send";

/**
 * US-006 — queue the SAVED version of a template to the caller's own address,
 * rendered with the worker's Handlebars helpers and a canned sample variable
 * set. No request body: the only input is the template id in the path.
 */
export const POST = requirePermissionParams(
  "canEditEmails",
  async (_req, { user, tenantId }, params) => {
    try {
      const id = parseUuid(params.id);

      // Metered before the lookup so a burst can't be used to probe ids.
      const limit = await checkRateLimit(
        testSendRateLimitKey(tenantId),
        TEST_SEND_RATE_LIMIT,
      );
      if (!limit.success) return limit.response;

      if (!user.email) {
        return apiValidationError(
          "Your account has no email address to send a test to.",
          ROUTE,
        );
      }

      const template = await prisma.email_templates.findFirst({
        where: { id, tenantId },
        select: { id: true, subject: true, contentHtml: true },
      });

      if (!template) {
        return apiError(new Error("Template not found or access denied"), {
          route: ROUTE,
          status: 404,
          safeMessage: "Template not found or access denied",
        });
      }

      const [mapping, tenant] = await Promise.all([
        prisma.email_event_mappings.findFirst({
          where: { templateId: template.id, tenantId },
          select: { eventType: true },
        }),
        prisma.tenants.findFirst({
          where: { id: tenantId },
          select: { businessName: true },
        }),
      ]);

      await queueTestSend({
        template,
        eventType: mapping?.eventType ?? null,
        recipient: user.email,
        tenantId,
        businessName: tenant?.businessName,
      });

      return NextResponse.json({ success: true, sentTo: user.email });
    } catch (error) {
      return apiError(error, { route: ROUTE });
    }
  },
);
