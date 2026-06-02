import { NextRequest, NextResponse } from "next/server";
import { currentUser, clerkClient } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientInfo } from "@/lib/audit-log";
import { apiError, apiValidationError } from "@/lib/api-error";
import { eraseUser, resolveLocalUser } from "@/lib/gdpr/erasure";
import { withAuth } from "@/lib/api-auth";

/**
 * GDPR Article 17 — Right to erasure (self-service).
 *
 * Anonymizes the authenticated user's account via the canonical
 * `eraseUser` path (lib/gdpr/erasure.ts) shared with the admin and Clerk
 * entry points: PII fields nulled, email replaced with a deletion marker,
 * isActive set to false, and the Dr Green linkage SEVERED. Order/consultation
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
export const DELETE = withAuth(async (request, { user }) => {
  try {
    const email = user.email;

    if (!email) {
      return apiError(new Error("Email not found"), {
        route: "DELETE /api/account/delete",
        status: 401,
        safeMessage: "Email not found",
      });
    }

    const clerkUser = await currentUser();
    if (!clerkUser) {
      return apiError(new Error("Unauthorized"), {
        route: "DELETE /api/account/delete",
        status: 401,
        safeMessage: "Unauthorized",
      });
    }

    const rate = await checkRateLimit(`account-delete:${user.id}`, {
      maxRequests: 1,
      windowMs: 60 * 60 * 1000,
      failMode: "closed",
    });
    if (!rate.success) return rate.response;

    const body = await request.json().catch(() => ({}));
    if (body?.confirm !== "DELETE") {
      return apiValidationError(
        'Confirmation required. POST { "confirm": "DELETE" } to permanently delete your account.',
        "DELETE /api/account/delete",
      );
    }

    // Resolve via the shared resolver (Clerk id first, then email) so we can
    // enforce the admin-block before anonymising.
    const dbUser = await resolveLocalUser({
      clerkUserId: clerkUser.id,
      email,
    });

    if (!dbUser) {
      return apiError(new Error("User not found"), {
        route: "DELETE /api/account/delete",
        status: 404,
        safeMessage: "User not found",
      });
    }

    // Block admin self-deletion via this route — admins must be removed by
    // another admin so we don't leave a tenant with zero owners.
    if (dbUser.role === "TENANT_ADMIN" || dbUser.role === "SUPER_ADMIN") {
      return apiError(
        new Error(
          "Admin accounts cannot be deleted via the self-service endpoint. Contact support to transfer ownership first.",
        ),
        {
          route: "DELETE /api/account/delete",
          status: 403,
          safeMessage:
            "Admin accounts cannot be deleted via the self-service endpoint. Contact support to transfer ownership first.",
        },
      );
    }

    // Best-effort Clerk teardown — never block local anonymization on this.
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

    // Canonical erasure: anonymise PII, sever Dr Green linkage, write audit row.
    await eraseUser({
      userId: dbUser.id,
      clerkUserId: clerkUser.id,
      email,
      reason: "self_service",
      clerkDeleted,
      clientInfo: getClientInfo(request.headers),
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
});
