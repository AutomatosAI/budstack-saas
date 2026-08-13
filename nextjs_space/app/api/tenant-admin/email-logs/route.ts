import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { prisma } from "@/lib/db";
import { apiError, apiValidationError } from "@/lib/api-error";
import { requirePermission } from "@/lib/permissions/require-permission";
import {
  buildEmailLogWhere,
  EMAIL_LOG_LIST_SELECT,
  parseEmailLogQuery,
} from "@/lib/email/email-log-query";

const ROUTE = "GET /api/tenant-admin/email-logs";

/** First validation message, for the shared string-based error helper. */
function firstIssue(error: ZodError): string {
  return error.issues[0]?.message ?? "Invalid email log filter.";
}

/**
 * US-007 — the tenant's own delivery history: what was sent, to whom, and why
 * it failed. Read-only and gated on `canViewEmails`, because the rows carry
 * recipient addresses and raw SMTP responses.
 */
export const GET = requirePermission("canViewEmails", async (req, { tenantId }) => {
  try {
    const parsed = parseEmailLogQuery(new URL(req.url).searchParams);
    if (!parsed.success) {
      return apiValidationError(firstIssue(parsed.error), ROUTE);
    }

    const { page, limit } = parsed.data;
    const where = buildEmailLogWhere(tenantId, parsed.data);

    const [logs, total] = await Promise.all([
      prisma.email_logs.findMany({
        where,
        select: EMAIL_LOG_LIST_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.email_logs.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return apiError(error, { route: ROUTE });
  }
});
