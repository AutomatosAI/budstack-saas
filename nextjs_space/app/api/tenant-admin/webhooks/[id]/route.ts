import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";

/**
 * PATCH /api/tenant-admin/webhooks/[id]
 *
 * Update a webhook
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== "TENANT_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant associated with user" },
        { status: 400 },
      );
    }

    const { id } = params;
    const body = await req.json();
    const { url, events, description, isActive } = body;

    // Verify webhook belongs to tenant
    const existingWebhook = await prisma.webhooks.findFirst({
      where: { id, tenantId },
    });

    if (!existingWebhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    // Validate URL if provided
    if (url) {
      try {
        new URL(url);
      } catch {
        return NextResponse.json(
          { error: "Invalid URL format" },
          { status: 400 },
        );
      }
    }

    const webhook = await prisma.webhooks.update({
      where: { id },
      data: {
        ...(url && { url }),
        ...(events && { events }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // Log the action
    const clientInfo = getClientInfo(req.headers);
    await createAuditLog({
      action: AUDIT_ACTIONS.WEBHOOK_UPDATED,
      entityType: "Webhook",
      entityId: webhook.id,
      userId: (session.user as any)?.id,
      userEmail: session.user?.email || undefined,
      tenantId,
      metadata: { url, events, description, isActive },
      ...clientInfo,
    });

    return NextResponse.json({ webhook });
  } catch (error) {
    console.error("[API] Error updating webhook:", error);
    return NextResponse.json(
      { error: "Failed to update webhook" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/tenant-admin/webhooks/[id]
 *
 * Delete a webhook
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || (session.user as any)?.role !== "TENANT_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = (session.user as any)?.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant associated with user" },
        { status: 400 },
      );
    }

    const { id } = params;

    // Verify webhook belongs to tenant
    const existingWebhook = await prisma.webhooks.findFirst({
      where: { id, tenantId },
    });

    if (!existingWebhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    await prisma.webhooks.delete({
      where: { id },
    });

    // Log the action
    const clientInfo = getClientInfo(req.headers);
    await createAuditLog({
      action: AUDIT_ACTIONS.WEBHOOK_DELETED,
      entityType: "Webhook",
      entityId: id,
      userId: (session.user as any)?.id,
      userEmail: session.user?.email || undefined,
      tenantId,
      metadata: { webhookUrl: existingWebhook.url },
      ...clientInfo,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting webhook:", error);
    return NextResponse.json(
      { error: "Failed to delete webhook" },
      { status: 500 },
    );
  }
}
