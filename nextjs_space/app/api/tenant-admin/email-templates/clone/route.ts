import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (
      !session ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { tenants: true },
    });

    if (!user?.tenants) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

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
        tenantId: user.tenants.id,
        description: `Customized version of ${original.name}`,
      },
    });

    // 3. Upsert Mapping for Tenant
    await prisma.email_event_mappings.upsert({
      where: {
        eventType_tenantId: {
          eventType: eventType,
          tenantId: user.tenants.id,
        },
      },
      update: {
        templateId: newTemplate.id,
        isActive: true,
      },
      create: {
        eventType: eventType,
        tenantId: user.tenants.id,
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
}
