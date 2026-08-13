import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError, apiValidationError } from "@/lib/api-error";
import { withSuperAdminParams } from "@/lib/api-auth";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { parseUuid } from "@/lib/validation/parse-uuid";
import {
  queueTestSend,
  TEST_SEND_RATE_LIMIT,
  testSendRateLimitKey,
} from "@/lib/email/test-send";

const ROUTE = "POST /api/super-admin/email-templates/[id]/test-send";

/**
 * US-006 — super-admin equivalent of the tenant test send. A platform template
 * carries no tenantId, so it goes out as "SYSTEM" (platform SMTP), the same
 * fallback every other system email uses. Metered per admin, since there is no
 * tenant to meter.
 */
export const POST = withSuperAdminParams(async (_req, { user }, params) => {
  try {
    const id = parseUuid(params.id);

    const limit = await checkRateLimit(
      testSendRateLimitKey(`super-admin:${user.id}`),
      TEST_SEND_RATE_LIMIT,
    );
    if (!limit.success) return limit.response;

    if (!user.email) {
      return apiValidationError(
        "Your account has no email address to send a test to.",
        ROUTE,
      );
    }

    const template = await prisma.email_templates.findUnique({
      where: { id },
      select: { id: true, subject: true, contentHtml: true, tenantId: true },
    });

    if (!template) {
      return apiError(new Error("Template not found"), {
        route: ROUTE,
        status: 404,
        safeMessage: "Template not found",
      });
    }

    const mapping = await prisma.email_event_mappings.findFirst({
      where: { templateId: template.id },
      select: { eventType: true },
    });

    // A tenant-owned template still sends through its own tenant so the
    // email_logs row keeps a valid tenant reference.
    const tenant = template.tenantId
      ? await prisma.tenants.findFirst({
          where: { id: template.tenantId },
          select: { businessName: true },
        })
      : null;

    await queueTestSend({
      template,
      eventType: mapping?.eventType ?? null,
      recipient: user.email,
      tenantId: template.tenantId ?? "SYSTEM",
      businessName: tenant?.businessName,
    });

    return NextResponse.json({ success: true, sentTo: user.email });
  } catch (error) {
    return apiError(error, { route: ROUTE });
  }
});
