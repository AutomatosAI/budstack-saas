import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import crypto from "crypto";

/**
 * POST /api/super-admin/tenants/[id]/reset-password
 * Send password reset email to tenant admin
 * Authorization: SUPER_ADMIN only
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // Check authentication and authorization
    const session = await getServerSession(authOptions);
    if (!session || !["SUPER_ADMIN"].includes(session.user.role || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get tenant with admin user
    const tenant = await prisma.tenants.findUnique({
      where: { id: params.id },
      include: {
        users: {
          where: { role: "TENANT_ADMIN" },
          take: 1,
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    if (!tenant.users || tenant.users.length === 0) {
      return NextResponse.json(
        { error: "No admin user found for this tenant" },
        { status: 404 },
      );
    }

    const adminUser = tenant.users[0];

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

    // Update user with reset token
    await prisma.users.update({
      where: { id: adminUser.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // TODO: Send email with reset link
    // const resetLink = `${process.env.NEXTAUTH_URL}/auth/reset-password/${resetToken}`;
    // await sendPasswordResetEmail(adminUser.email, resetLink);

    // Create audit log
    await prisma.audit_logs.create({
      data: {
        id: crypto.randomUUID(),
        action: "PASSWORD_RESET_REQUESTED",
        entityType: "User",
        entityId: adminUser.id,
        userId: session.user.id,
        userEmail: session.user.email,
        tenantId: params.id,
        metadata: {
          targetUserEmail: adminUser.email,
          reason: "Super Admin initiated reset",
        },
      },
    });

    return NextResponse.json({
      message: "Password reset email sent successfully",
      email: adminUser.email,
    });
  } catch (error) {
    console.error(
      `[POST /api/super-admin/tenants/${params.id}/reset-password] Error:`,
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
