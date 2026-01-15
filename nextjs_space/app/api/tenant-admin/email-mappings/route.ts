import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";

const SYSTEM_EVENTS = [
  "welcome",
  "passwordReset",
  "tenantWelcome",
  "orderConfirmation",
  "userInvite",
  "paymentFailed",
  "subscriptionUpdated",
];

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (
      !user ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(user.role || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found for user" }, { status: 404 });
    }
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
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (
      !user ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(user.role || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId)
      return NextResponse.json({ error: "Tenant not found for user" }, { status: 404 });

    const { eventType, templateId } = await req.json();

    if (!eventType || !templateId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Verify Template Ownership (Security)
    const template = await prisma.email_templates.findFirst({
      where: { id: templateId, tenantId: tenantId },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found or access denied" },
        { status: 404 },
      );
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
    console.error("Error updating mapping:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (
      !user ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(user.role || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId)
      return NextResponse.json({ error: "Tenant not found for user" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const eventType = searchParams.get("eventType");

    if (!eventType)
      return NextResponse.json({ error: "Missing eventType" }, { status: 400 });

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

      // Delete Template ONLY IF it belongs to tenant (Safety check)
      if (mapping.template && mapping.template.tenantId === tenantId) {
        await prisma.email_templates.delete({
          where: { id: mapping.template.id },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error resetting mapping:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
