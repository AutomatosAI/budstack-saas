import { NextResponse } from "next/server";
import { withTenantAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const POST = withTenantAuth(async (req, { tenantId }) => {
  try {
    const { originalTemplateId, eventType } = await req.json();

    if (!originalTemplateId || !eventType) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

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
    console.error("Error cloning template:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
});
