import { NextResponse } from "next/server";
import { withSuperAdmin } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  listSessions,
  type SessionStatusFilter,
} from "@/lib/impersonation/sessions";

const STATUS_FILTERS: SessionStatusFilter[] = ["all", "active", "completed"];

/**
 * GET /api/super-admin/impersonation/sessions — PRD-302 AC-3/AC-6.
 * Paginated session history, newest first. Sweeps expired sessions first so
 * "Active" in the table is never stale.
 * Query: ?status=all|active|completed&limit=50&offset=0
 */
export const GET = withSuperAdmin(async (req, { user }) => {
  try {
    const rateLimitResult = await checkRateLimit(user.id);
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    const { searchParams } = new URL(req.url);

    const statusRaw = searchParams.get("status") ?? "all";
    const status: SessionStatusFilter = STATUS_FILTERS.includes(
      statusRaw as SessionStatusFilter,
    )
      ? (statusRaw as SessionStatusFilter)
      : "all";

    let limit = parseInt(searchParams.get("limit") ?? "50", 10);
    let offset = parseInt(searchParams.get("offset") ?? "0", 10);
    if (isNaN(limit) || limit < 1) limit = 50;
    if (limit > 100) limit = 100;
    if (isNaN(offset) || offset < 0) offset = 0;

    const { sessions, total } = await listSessions({ status, limit, offset });

    return NextResponse.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        superAdminEmail: s.superAdminEmail,
        tenantId: s.tenantId,
        tenantName: s.tenantName,
        tenantEmail: s.tenantEmail,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt ? s.endedAt.toISOString() : null,
        endedReason: s.endedReason,
        expiresAt: s.expiresAt.toISOString(),
        durationSeconds: s.durationSeconds,
        status: s.status,
        ipAddress: s.ipAddress,
        notes: s.notes,
      })),
      total,
    });
  } catch (error) {
    return apiError(error, { route: `GET ${req.nextUrl.pathname}` });
  }
});
