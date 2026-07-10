import { NextResponse } from "next/server";
import { withSuperAdminParams } from "@/lib/api-auth";
import { apiError } from "@/lib/api-error";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { prisma } from "@/lib/db";
import { getSessionById } from "@/lib/impersonation/sessions";

const CSV_EXPORT_CAP = 5000;

/**
 * GET /api/super-admin/impersonation/sessions/[id]/audit-log — PRD-302 AC-5.
 *
 * Everything support did inside one impersonation session: every audit row
 * stamped with this impersonationSessionId (auto-stamped by createAuditLog via
 * the ambient context), including the start/end lifecycle events.
 * `?format=csv` downloads the trail for compliance; JSON paginates.
 */
export const GET = withSuperAdminParams(async (req, { user }, params) => {
  try {
    const rateLimitResult = await checkRateLimit(user.id);
    if (!rateLimitResult.success) {
      return rateLimitResult.response;
    }

    const sessionId = params.id;
    const session = await getSessionById(sessionId);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format");

    if (format === "csv") {
      const rows = await prisma.audit_logs.findMany({
        where: { impersonationSessionId: sessionId },
        orderBy: { createdAt: "asc" },
        take: CSV_EXPORT_CAP,
      });
      const csv = toCsv(rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="impersonation-${sessionId}-audit.csv"`,
        },
      });
    }

    let limit = parseInt(searchParams.get("limit") ?? "100", 10);
    let offset = parseInt(searchParams.get("offset") ?? "0", 10);
    if (isNaN(limit) || limit < 1) limit = 100;
    if (limit > 500) limit = 500;
    if (isNaN(offset) || offset < 0) offset = 0;

    const [rows, total] = await Promise.all([
      prisma.audit_logs.findMany({
        where: { impersonationSessionId: sessionId },
        orderBy: { createdAt: "asc" },
        take: limit,
        skip: offset,
      }),
      prisma.audit_logs.count({
        where: { impersonationSessionId: sessionId },
      }),
    ]);

    return NextResponse.json({
      session: {
        id: session.id,
        superAdminEmail: session.superAdminEmail,
        tenantId: session.tenantId,
        tenantName: session.tenantName,
        startedAt: session.startedAt.toISOString(),
        endedAt: session.endedAt ? session.endedAt.toISOString() : null,
        endedReason: session.endedReason,
        notes: session.notes,
      },
      auditLogs: rows.map(
        (row: {
          id: string;
          action: string;
          entityType: string;
          entityId: string | null;
          userId: string | null;
          userEmail: string | null;
          metadata: unknown;
          ipAddress: string | null;
          createdAt: Date;
        }) => ({
          id: row.id,
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
          userId: row.userId,
          userEmail: row.userEmail,
          metadata: row.metadata,
          ipAddress: row.ipAddress,
          createdAt: row.createdAt.toISOString(),
        }),
      ),
      total,
    });
  } catch (error) {
    return apiError(error, { route: `GET ${req.nextUrl.pathname}` });
  }
});

/**
 * RFC-4180 quoting plus spreadsheet formula-injection neutralization: a field
 * starting with = + - @ tab or CR would execute as a formula when the export
 * is opened in Excel/Sheets — exactly the file a compliance reviewer opens.
 * Such fields get a leading apostrophe (renders as text, ignored by parsers).
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function csvField(value: unknown): string {
  const s =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  const neutralized = FORMULA_PREFIX.test(s) ? `'${s}` : s;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

function toCsv(
  rows: Array<{
    createdAt: Date;
    action: string;
    entityType: string;
    entityId: string | null;
    userId: string | null;
    userEmail: string | null;
    ipAddress: string | null;
    metadata: unknown;
  }>,
): string {
  const header = [
    "timestamp",
    "action",
    "entityType",
    "entityId",
    "superAdminUserId",
    "superAdminEmail",
    "ipAddress",
    "metadata",
  ].join(",");
  const lines = rows.map((row) =>
    [
      csvField(row.createdAt.toISOString()),
      csvField(row.action),
      csvField(row.entityType),
      csvField(row.entityId),
      csvField(row.userId),
      csvField(row.userEmail),
      csvField(row.ipAddress),
      csvField(row.metadata),
    ].join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}
