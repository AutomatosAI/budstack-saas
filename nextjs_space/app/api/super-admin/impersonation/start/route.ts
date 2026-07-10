import { NextResponse } from "next/server";
import { z } from "zod";
import { withSuperAdmin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createAuditLog, getClientInfo, AUDIT_ACTIONS } from "@/lib/audit-log";
import { startImpersonation } from "@/lib/impersonation/sessions";
import { IMPERSONATION_COOKIE, secondsUntil } from "@/lib/impersonation/constants";

const startSchema = z
  .object({
    tenantId: z.string().min(1).max(100),
    notes: z.string().max(1000).optional().nullable(),
  })
  .strict();

/**
 * POST /api/super-admin/impersonation/start — PRD-302 AC-6.
 *
 * Mints an impersonation session against an active tenant and sets the
 * httpOnly session cookie. Any prior active session for this super-admin is
 * ended ('replaced') — one cookie, one session. SUPER_ADMIN only (AC-7).
 */
export const POST = withSuperAdmin(async (req, { user }) => {
  try {
    const rateLimitResult = await checkRateLimit(user.id);
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    const body = await parseJsonBody(req, startSchema);
    const { ipAddress, userAgent } = getClientInfo(req.headers);

    const { session, rawToken, tenantBusinessName } = await startImpersonation({
      superAdminClerkId: user.id,
      superAdminEmail: user.email ?? "",
      tenantId: body.tenantId,
      notes: body.notes ?? null,
      ipAddress,
    });

    // AC-5: the start event lands in the TARGET tenant's audit trail, linked to
    // the session. Explicit sessionId — this runs outside the impersonation
    // context binding (the cookie doesn't exist until this response).
    await createAuditLog({
      action: AUDIT_ACTIONS.IMPERSONATION.STARTED,
      entityType: "ImpersonationSession",
      entityId: session.id,
      userId: user.id,
      userEmail: user.email ?? undefined,
      tenantId: session.tenantId,
      metadata: {
        tenantBusinessName,
        notes: session.notes,
        expiresAt: session.expiresAt.toISOString(),
      },
      ipAddress,
      userAgent,
      impersonationSessionId: session.id,
    });

    const res = NextResponse.json({
      sessionId: session.id,
      impersonationUrl: "/tenant-admin",
      expiresAt: session.expiresAt.toISOString(),
    });
    res.cookies.set(IMPERSONATION_COOKIE, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: secondsUntil(session.expiresAt, new Date()),
    });
    return res;
  } catch (error) {
    return apiError(error, { route: `POST ${req.nextUrl.pathname}` });
  }
});
