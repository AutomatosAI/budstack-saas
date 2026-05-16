import { NextRequest, NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { apiError } from "@/lib/api-error";

/**
 * GDPR Article 17 — Right to erasure (self-service).
 *
 * Anonymizes the authenticated user's account: PII fields nulled, email
 * replaced with a deletion marker, isActive set to false. Order/consultation
 * history is RETAINED (anonymized via the user FK) because tenants may have
 * legal/financial obligations to keep transaction records — full hard delete
 * is admin-initiated only.
 *
 * Also revokes the Clerk session and deletes the Clerk user so the deleted
 * account cannot log back in. Failures on the Clerk side do not block the
 * local anonymization — that's the legally significant step.
 *
 * Requires `confirm: "DELETE"` in the request body to prevent accidental
 * one-click deletion. Rate-limited (1 attempt per hour).
 */
export async function DELETE(request: NextRequest) {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const email = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId,
    )?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;

    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 401 });
    }

    const rate = await checkRateLimit(`account-delete:${clerkUser.id}`, {
      maxRequests: 1,
      windowMs: 60 * 60 * 1000,
    });
    if (!rate.success) return rate.response;

    const body = await request.json().catch(() => ({}));
    if (body?.confirm !== "DELETE") {
      return NextResponse.json(
        {
          error:
            'Confirmation required. POST { "confirm": "DELETE" } to permanently delete your account.',
        },
        { status: 400 },
      );
    }

    const dbUser = await prisma.users.findFirst({
      where: { email },
      select: { id: true, email: true, name: true, tenantId: true, role: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Block admin self-deletion via this route — admins must be removed by
    // another admin so we don't leave a tenant with zero owners.
    if (dbUser.role === "TENANT_ADMIN" || dbUser.role === "SUPER_ADMIN") {
      return NextResponse.json(
        {
          error:
            "Admin accounts cannot be deleted via the self-service endpoint. Contact support to transfer ownership first.",
        },
        { status: 403 },
      );
    }

    // Anonymize local record (preserves order/consultation FK integrity)
    await prisma.users.update({
      where: { id: dbUser.id },
      data: {
        email: `deleted-${dbUser.id}@deleted.local`,
        name: "Deleted User",
        firstName: null,
        lastName: null,
        phone: null,
        address: undefined,
        password: "DELETED",
        isActive: false,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    // Best-effort Clerk teardown — never block local anonymization on this
    let clerkDeleted = false;
    try {
      const clerk = await clerkClient();
      await clerk.users.deleteUser(clerkUser.id);
      clerkDeleted = true;
    } catch (clerkErr) {
      console.error(
        "[account.delete] Clerk deletion failed (local anonymization succeeded):",
        clerkErr instanceof Error ? clerkErr.message : clerkErr,
      );
    }

    await createAuditLog({
      action: AUDIT_ACTIONS.ACCOUNT_DELETED_GDPR_SELF,
      entityType: "User",
      entityId: dbUser.id,
      userId: clerkUser.id,
      userEmail: email,
      tenantId: dbUser.tenantId || undefined,
      metadata: {
        targetUserEmail: dbUser.email,
        targetUserName: dbUser.name,
        clerkDeleted,
        deletionType: "self_service_anonymization",
      },
      ...getClientInfo(request.headers),
    });

    return NextResponse.json({
      success: true,
      message: "Your account has been deleted. Order history is retained in anonymized form.",
      clerkDeleted,
    });
  } catch (error) {
    return apiError(error, {
      route: "account.delete",
      status: 500,
      safeMessage: "Failed to delete account",
    });
  }
}
