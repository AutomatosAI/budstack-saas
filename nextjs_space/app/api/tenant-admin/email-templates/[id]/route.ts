import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const clerkUser = await currentUser();

    if (
      !clerkUser ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(
        (clerkUser.publicMetadata.role as string) || "",
      )
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress;

    const user = await prisma.users.findFirst({
      where: { email: email },
      include: { tenants: true },
    });

    if (!user?.tenants) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const template = await prisma.email_templates.findFirst({
      where: {
        id: params.id,
        tenantId: user.tenants.id, // Strict ownership
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found or access denied" },
        { status: 404 },
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error fetching template:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const clerkUser = await currentUser();

    if (
      !clerkUser ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(
        (clerkUser.publicMetadata.role as string) || "",
      )
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress;

    const user = await prisma.users.findFirst({
      where: { email: email },
      include: { tenants: true },
    });

    if (!user?.tenants) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await req.json();
    const { name, subject, contentHtml, description, isActive } = body;

    // Verify ownership before update
    const count = await prisma.email_templates.count({
      where: { id: params.id, tenantId: user.tenants.id },
    });

    if (count === 0) {
      return NextResponse.json(
        { error: "Template not found or access denied" },
        { status: 404 },
      );
    }

    const updated = await prisma.email_templates.update({
      where: { id: params.id },
      data: {
        name,
        subject,
        contentHtml,
        description,
        isActive,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const clerkUser = await currentUser();

    if (
      !clerkUser ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(
        (clerkUser.publicMetadata.role as string) || "",
      )
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress;

    const user = await prisma.users.findFirst({
      where: { email: email },
      include: { tenants: true },
    });

    if (!user?.tenants) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Verify ownership
    const template = await prisma.email_templates.findFirst({
      where: { id: params.id, tenantId: user.tenants.id },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    // Check if mapped
    const mapping = await prisma.email_event_mappings.findFirst({
      where: { templateId: params.id },
    });

    // Strategy: If mapped, delete the mapping first (Revert to default)
    if (mapping) {
      await prisma.email_event_mappings.delete({ where: { id: mapping.id } });
    }

    await prisma.email_templates.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
