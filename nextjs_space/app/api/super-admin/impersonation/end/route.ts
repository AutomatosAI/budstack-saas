import { NextResponse } from "next/server";
import { withSuperAdmin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { createAuditLog, getClientInfo, AUDIT_ACTIONS } from "@/lib/audit-log";
import { endImpersonation } from "@/lib/impersonation/sessions";
import { IMPERSONATION_COOKIE } from "@/lib/impersonation/constants";

/**
 * POST /api/super-admin/impersonation/end — PRD-302 AC-6.
 *
 * Ends the caller's active impersonation session ('manual') and clears the
 * cookie. Idempotent: with no active session it still clears any stale cookie
 * and reports success, so the banner's exit button always lands clean.
 */
export const POST = withSuperAdmin(async (req, { user }) => {
  try {
    const { ipAddress, userAgent } = getClientInfo(req.headers);
    const ended = await endImpersonation(user.id, "manual");

    if (ended) {
      const durationSeconds = Math.max(
        0,
        Math.floor(
          ((ended.endedAt?.getTime() ?? Date.now()) -
            ended.startedAt.getTime()) / 1000,
        ),
      );
      await createAuditLog({
        action: AUDIT_ACTIONS.IMPERSONATION.ENDED,
        entityType: "ImpersonationSession",
        entityId: ended.id,
        userId: user.id,
        userEmail: user.email ?? undefined,
        tenantId: ended.tenantId,
        metadata: { reason: "manual", durationSeconds },
        ipAddress,
        userAgent,
        impersonationSessionId: ended.id,
      });
    }

    const res = NextResponse.json({
      success: true,
      sessionId: ended?.id ?? null,
    });
    res.cookies.set(IMPERSONATION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return res;
  } catch (error) {
    return apiError(error, { route: `POST ${req.nextUrl.pathname}` });
  }
});
