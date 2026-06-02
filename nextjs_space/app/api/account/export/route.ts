import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientInfo } from "@/lib/audit-log";
import { apiError } from "@/lib/api-error";
import { exportUser } from "@/lib/gdpr/erasure";
import { withAuth } from "@/lib/api-auth";

/**
 * GDPR Article 15 / 20 — Right to access and data portability.
 *
 * Returns a JSON dump of the authenticated user's personal data, plus the
 * orders / consultations / questionnaires they own, via the canonical
 * `exportUser` path (lib/gdpr/erasure.ts) shared with the admin entry point.
 * Rate-limited to prevent abuse (an attacker with stolen credentials shouldn't
 * be able to scrape a user's full record on demand). Self-service only — admins
 * use the tenant-admin customer routes for assisted exports.
 */
export const GET = withAuth(async (request, { user }) => {
  try {
    const email = user.email;

    if (!email) {
      return apiError(new Error("Email not found"), {
        route: "GET /api/account/export",
        status: 401,
        safeMessage: "Email not found",
      });
    }

    const clerkUser = await currentUser();
    if (!clerkUser) {
      return apiError(new Error("Unauthorized"), {
        route: "GET /api/account/export",
        status: 401,
        safeMessage: "Unauthorized",
      });
    }

    // 3 exports per hour per user — generous for legitimate use, restrictive
    // enough that it's not a useful scraping primitive.
    const rate = await checkRateLimit(`account-export:${user.id}`, {
      maxRequests: 3,
      windowMs: 60 * 60 * 1000,
      failMode: "closed",
    });
    if (!rate.success) return rate.response;

    const exported = await exportUser({
      clerkUserId: clerkUser.id,
      email,
      requestedByClerkId: clerkUser.id,
      clientInfo: getClientInfo(request.headers),
    });

    if (!exported) {
      return apiError(new Error("User not found"), {
        route: "GET /api/account/export",
        status: 404,
        safeMessage: "User not found",
      });
    }

    return NextResponse.json(exported);
  } catch (error) {
    return apiError(error, {
      route: "account.export",
      status: 500,
      safeMessage: "Failed to export account data",
    });
  }
});
