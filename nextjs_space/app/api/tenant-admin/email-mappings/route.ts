import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenantAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { apiError, apiValidationError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";

const emailMappingSchema = z
  .object({
    eventType: z.string().min(1).max(100),
    templateId: z.string().min(1).max(200),
  })
  .strict();

const SYSTEM_EVENTS = [
  "welcome",
  "passwordReset",
  "tenantWelcome",
  "orderConfirmation",
  "userInvite",
  "paymentFailed",
  "subscriptionUpdated",
];

export const GET = withTenantAuth(async (_request, { tenantId }) => {
  try {
    const results = [];

    for (const event of SYSTEM_EVENTS) {
      // 1. Check for Tenant Override
      let mapping = await prisma.email_event_mappings.findFirst({
        where: {
          tenantId: tenantId,
          eventType: event,
          isActive: true,
        },
        include: { template: true },
      });

      if (mapping && mapping.template) {
        results.push({
          eventType: event,
          isCustom: true,
          template: mapping.template,
        });
        continue;
      }

      // 2. Fallback to System Default
      mapping = await prisma.email_event_mappings.findFirst({
        where: {
          tenantId: null,
          eventType: event,
          isActive: true,
        },
        include: { template: true },
      });

      results.push({
        eventType: event,
        isCustom: false,
        template: mapping?.template || null,
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error fetching tenant email mappings:", error);
    return apiError(error, { route: "GET /api/tenant-admin/email-mappings", safeMessage: "Internal Server Error" });
  }
});

export const POST = withTenantAuth(async (req, { tenantId }) => {
  try {
    const { eventType, templateId } = await parseJsonBody(
      req,
      emailMappingSchema,
    );

    // Verify Template Ownership (Security)
    const template = await prisma.email_templates.findFirst({
      where: { id: templateId, tenantId: tenantId },
    });

    if (!template) {
      return apiError(new Error("Template not found or access denied"), { route: "POST /api/tenant-admin/email-mappings", status: 404, safeMessage: "Template not found or access denied" });
    }

    // Upsert Mapping
    await prisma.email_event_mappings.upsert({
      where: {
        eventType_tenantId: {
          eventType,
          tenantId,
        },
      },
      update: { templateId, isActive: true },
      create: {
        eventType,
        tenantId,
        templateId,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, { route: "POST /api/tenant-admin/email-mappings" });
  }
});

export const DELETE = withTenantAuth(async (req, { tenantId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const eventType = searchParams.get("eventType");

    if (!eventType)
      return apiValidationError("Missing eventType", "DELETE /api/tenant-admin/email-mappings");

    // Find Mapping
    const mapping = await prisma.email_event_mappings.findFirst({
      where: {
        eventType: eventType,
        tenantId: tenantId,
      },
      include: { template: true },
    });

    if (mapping) {
      // Delete Mapping
      await prisma.email_event_mappings.delete({ where: { id: mapping.id } });

      // Delete the template only if it belongs to this tenant AND no other
      // mapping still references it — a custom template can back several events.
      if (mapping.template && mapping.template.tenantId === tenantId) {
        const remaining = await prisma.email_event_mappings.count({
          where: { templateId: mapping.template.id },
        });
        if (remaining === 0) {
          await prisma.email_templates.delete({
            where: { id: mapping.template.id },
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error resetting mapping:", error);
    return apiError(error, { route: "DELETE /api/tenant-admin/email-mappings", safeMessage: "Internal Server Error" });
  }
});
