import { NextResponse } from "next/server";
import { z } from "zod";
import { withTenantAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";

const emailCloneSchema = z
  .object({
    originalTemplateId: z.string().min(1).max(200),
    eventType: z.string().min(1).max(100),
  })
  .strict();

export const POST = withTenantAuth(async (req, { tenantId }) => {
  try {
    const { originalTemplateId, eventType } = await parseJsonBody(
      req,
      emailCloneSchema,
    );

    // 1. Fetch Original Template
    const original = await prisma.email_templates.findUnique({
      where: { id: originalTemplateId },
    });

    if (!original) {
      return NextResponse.json(
        { error: "Original template not found" },
        { status: 404 },
      );
    }

    // 2. Create Clone (Tenant Specific)
    const newTemplate = await prisma.email_templates.create({
      data: {
        name: `${original.name} (Custom)`,
        subject: original.subject,
        contentHtml: original.contentHtml,
        category: original.category,
        isSystem: false,
        tenantId: tenantId,
        description: `Customized version of ${original.name}`,
      },
    });

    // 3. Upsert Mapping for Tenant
    await prisma.email_event_mappings.upsert({
      where: {
        eventType_tenantId: {
          eventType: eventType,
          tenantId: tenantId,
        },
      },
      update: {
        templateId: newTemplate.id,
        isActive: true,
      },
      create: {
        eventType: eventType,
        tenantId: tenantId,
        templateId: newTemplate.id,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, newTemplateId: newTemplate.id });
  } catch (error) {
    return apiError(error, {
      route: "POST /api/tenant-admin/email-templates/clone",
    });
  }
});
