import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { apiError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";
import { parseJsonBody } from "@/lib/validation/body";

const webhookUpdateSchema = z
  .object({
    url: z.string().url().max(2000).optional(),
    events: z.array(z.string().min(1).max(100)).min(1).max(50).optional(),
    description: z.string().max(1000).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

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
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = user.emailAddresses[0]?.emailAddress;
    const role = (user.publicMetadata.role as string) || "";

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 401 });
    }

    if (role !== "TENANT_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const localUser = await prisma.users.findFirst({
      where: { email: email },
      select: { tenantId: true },
    });

    const tenantId = localUser?.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant associated with user" },
        { status: 400 },
      );
    }

    const id = parseUuid(params.id);
    const { url, events, description, isActive } = await parseJsonBody(
      req,
      webhookUpdateSchema,
    );

    // Verify webhook belongs to tenant
    const existingWebhook = await prisma.webhooks.findFirst({
      where: { id, tenantId },
    });

    if (!existingWebhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
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
      userId: user.id,
      userEmail: email!,
      tenantId,
      metadata: { url, events, description, isActive },
      ...clientInfo,
    });

    return NextResponse.json({ webhook });
  } catch (error) {
    return apiError(error, { route: "PATCH /api/tenant-admin/webhooks/[id]" });
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
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = user.emailAddresses[0]?.emailAddress;
    const role = (user.publicMetadata.role as string) || "";

    if (role !== "TENANT_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const localUser = await prisma.users.findFirst({
      where: { email: email },
      select: { tenantId: true },
    });

    const tenantId = localUser?.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant associated with user" },
        { status: 400 },
      );
    }

    const id = parseUuid(params.id);

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
      userId: user.id,
      userEmail: email!,
      tenantId,
      metadata: { webhookUrl: existingWebhook.url },
      ...clientInfo,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, { route: "DELETE /api/tenant-admin/webhooks/[id]" });
  }
}
