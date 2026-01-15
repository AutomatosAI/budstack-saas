import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import crypto from "crypto";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";

/**
 * GET /api/tenant-admin/webhooks
 *
 * List all webhooks for the tenant
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "TENANT_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant associated with user" },
        { status: 400 },
      );
    }

    const webhooks = await prisma.webhooks.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { deliveries: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ webhooks });
  } catch (error) {
    console.error("[API] Error fetching webhooks:", error);
    return NextResponse.json(
      { error: "Failed to fetch webhooks" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/tenant-admin/webhooks
 *
 * Create a new webhook for the tenant
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== "TENANT_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant associated with user" },
        { status: 400 },
      );
    }

    const body = await req.json();
    const { url, events, description } = body;

    if (!url || !events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: "Invalid request. URL and events are required." },
        { status: 400 },
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 },
      );
    }

    // Generate a secret for webhook signature
    const secret = crypto.randomBytes(32).toString("hex");

    const webhook = await prisma.webhooks.create({
      data: {
        tenantId,
        url,
        events,
        secret,
        description: description || "",
        isActive: true,
      },
    });

    // Log the action
    const clientInfo = getClientInfo(req.headers);
    await createAuditLog({
      action: AUDIT_ACTIONS.WEBHOOK_CREATED,
      entityType: "Webhook",
      entityId: webhook.id,
      userId: user.id,
      userEmail: user.email || undefined,
      tenantId,
      metadata: { url, events, description },
      ...clientInfo,
    });

    return NextResponse.json({ webhook }, { status: 201 });
  } catch (error) {
    console.error("[API] Error creating webhook:", error);
    return NextResponse.json(
      { error: "Failed to create webhook" },
      { status: 500 },
    );
  }
}
