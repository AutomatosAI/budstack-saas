import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withTenantAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { apiError, apiValidationError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";
import { createAuditLog, getClientInfo } from "@/lib/audit-log";
import {
  OBJECTION_WINDOW_DAYS,
  isObjectionOutOfWindow,
} from "@/lib/legal/subprocessor-notice";
import { logger } from "@/lib/logger";

/**
 * Operator objections to a sub-processor (DPA §6).
 *
 * Recorded against the specific vendor rather than left in a shared inbox. An
 * objection that cannot be evidenced is one the operator cannot rely on, and
 * "we never received it" is not a position we should be able to take.
 *
 * See docs/PRDS/prd-data-protection-remediation.md (WS3, US-014).
 */

const ROUTE = "POST /api/tenant-admin/subprocessor-objections";

const objectionSchema = z.object({
  subprocessorId: z.string().trim().min(1).max(64),
  reason: z
    .string()
    .trim()
    .min(10, "Tell us why you object, so we can respond properly.")
    .max(2000),
});

export const GET = withTenantAuth(async (_request, { tenantId }) => {
  try {
    const objections = await prisma.subprocessor_objections.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: { subprocessor: { select: { name: true, status: true } } },
    });
    return NextResponse.json({ objections });
  } catch (error) {
    return apiError(error, { route: "GET /api/tenant-admin/subprocessor-objections" });
  }
});

export const POST = withTenantAuth(async (request, { user, tenantId }) => {
  try {
    const body = await parseJsonBody<Record<string, unknown>>(request);
    const parsed = objectionSchema.safeParse(body);

    if (!parsed.success) {
      return apiValidationError(
        parsed.error.issues[0]?.message ?? "Invalid objection.",
        ROUTE,
      );
    }

    const entry = await prisma.subprocessors.findFirst({
      where: { id: parsed.data.subprocessorId },
      select: { id: true, name: true, announcedAt: true },
    });

    if (!entry) {
      return apiError(new Error("Not found"), {
        route: ROUTE,
        status: 404,
        safeMessage: "That sub-processor is not on the register.",
      });
    }

    const now = new Date();

    // Late objections are ACCEPTED and flagged, never rejected. The DPA gives a
    // 14-day window, but refusing to record a controller's objection because
    // they were slow would leave us processing over a live, unanswered concern.
    const outOfWindow = entry.announcedAt
      ? isObjectionOutOfWindow(entry.announcedAt, now)
      : false;

    const objection = await prisma.subprocessor_objections.create({
      data: {
        id: randomUUID(),
        subprocessorId: entry.id,
        tenantId,
        raisedByUserId: user.id,
        reason: parsed.data.reason,
        status: "open",
        outOfWindow,
        createdAt: now,
        updatedAt: now,
      },
    });

    await createAuditLog({
      action: "SUBPROCESSOR_OBJECTION_RAISED",
      entityType: "subprocessor_objection",
      entityId: objection.id,
      tenantId,
      userId: user.id,
      userEmail: user.email,
      metadata: {
        subprocessorId: entry.id,
        subprocessorName: entry.name,
        outOfWindow,
      },
      ...getClientInfo(request.headers),
    });

    logger.warn("[Legal] Operator objected to a sub-processor", {
      tenantId,
      subprocessorId: entry.id,
      outOfWindow,
    });

    return NextResponse.json({
      success: true,
      objection,
      outOfWindow,
      message: outOfWindow
        ? `Recorded. This is outside the ${OBJECTION_WINDOW_DAYS}-day window in the DPA, ` +
          `so we cannot guarantee a response before the change takes effect, but we will come back to you.`
        : "Recorded. We will respond before this change takes effect.",
    });
  } catch (error) {
    return apiError(error, { route: ROUTE });
  }
});
