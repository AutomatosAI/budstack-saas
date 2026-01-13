import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail, emailTemplates } from "@/lib/email";
import crypto from "crypto";

/**
 * POST /api/tenant-admin/customers/[id]/reset-password
 * Send password reset email to customer
 * Authorization: TENANT_ADMIN or SUPER_ADMIN
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Check authentication and authorization
    const session = await getServerSession(authOptions);
    if (
      !session ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get customer
    const customer = await prisma.users.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        tenantId: true,
        name: true,
        tenants: {
          select: {
            businessName: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 },
      );
    }

    // Verify tenant access for tenant admins
    if (
      session.user.role === "TENANT_ADMIN" &&
      customer.tenantId !== session.user.tenantId
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Update user with reset token
    await prisma.users.update({
      where: { id: params.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Send email with reset link
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password/${resetToken}`;
    const tenantName = customer.tenants?.businessName || "BudStack";

    const html = await emailTemplates.passwordReset(
      customer.name || "Customer",
      resetLink,
      tenantName,
    );

    await sendEmail({
      to: customer.email,
      subject: "Password Reset Request",
      html,
      tenantId: customer.tenantId || "SYSTEM",
      templateName: "passwordReset",
    });

    // Create audit log
    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        action: "PASSWORD_RESET_REQUESTED",
        entityType: "User",
        entityId: params.id,
        userId: session.user.id,
        userEmail: session.user.email,
        tenantId: customer.tenantId || undefined,
        metadata: {
          targetUserEmail: customer.email,
          reason: "Tenant Admin initiated reset",
        },
      },
    });

    return NextResponse.json({
      message: "Password reset email sent successfully",
      email: customer.email,
    });
  } catch (error) {
    console.error(
      `[POST /api/tenant-admin/customers/${params.id}/reset-password] Error:`,
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
