import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { withSuperAdminParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { apiError, apiValidationError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";
import { createAuditLog, getClientInfo } from "@/lib/audit-log";
import {
  retireSchema,
  subprocessorUpdateSchema,
} from "@/lib/legal/subprocessor-schema";
import { announceSubprocessor } from "@/lib/legal/subprocessor-announce";
import { logger } from "@/lib/logger";

/**
 * Amend, announce or retire a register entry.
 *
 * Announcing is a POST to this route rather than a side effect of saving,
 * because it emails every operator and starts an objection window that cannot
 * be un-started.
 *
 * See docs/PRDS/prd-data-protection-remediation.md (WS3, US-012).
 */

function firstIssue(error: ZodError): string {
  return error.issues[0]?.message ?? "Invalid request.";
}

/** Announce the entry to every active operator. */
export const POST = withSuperAdminParams(async (request, { user }, params) => {
  const route = "POST /api/super-admin/subprocessors/[id]";
  try {
    const result = await announceSubprocessor(params.id);

    await createAuditLog({
      action: "SUBPROCESSOR_ANNOUNCE_REQUESTED",
      entityType: "subprocessor",
      entityId: params.id,
      userId: user.id,
      userEmail: user.email,
      metadata: { ...result },
      ...getClientInfo(request.headers),
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    // announceSubprocessor throws when the notice period is too short — that is
    // operator-correctable, not a server fault.
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Refusing to announce")) {
      return apiError(error, { route, status: 422, safeMessage: message });
    }
    return apiError(error, { route });
  }
});

export const PATCH = withSuperAdminParams(async (request, { user }, params) => {
  const route = "PATCH /api/super-admin/subprocessors/[id]";
  try {
    const body = await parseJsonBody<Record<string, unknown>>(request);
    const parsed = subprocessorUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return apiValidationError(firstIssue(parsed.error), route);
    }

    const existing = await prisma.subprocessors.findFirst({
      where: { id: params.id },
    });
    if (!existing) {
      return apiError(new Error("Not found"), {
        route,
        status: 404,
        safeMessage: "Register entry not found.",
      });
    }

    const now = new Date();
    const updated = await prisma.subprocessors.update({
      where: { id: params.id },
      data: { ...parsed.data, updatedAt: now },
    });

    await createAuditLog({
      action: "SUBPROCESSOR_UPDATED",
      entityType: "subprocessor",
      entityId: params.id,
      userId: user.id,
      userEmail: user.email,
      metadata: {
        changed: Object.keys(parsed.data),
        // An already-announced entry changing its terms matters: operators were
        // told something that is no longer true.
        alreadyAnnounced: Boolean(existing.announcedAt),
      },
      ...getClientInfo(request.headers),
    });

    if (existing.announcedAt) {
      logger.warn("[Legal] Announced sub-processor amended after notice went out", {
        entryId: params.id,
        changed: Object.keys(parsed.data),
      });
    }

    return NextResponse.json({ success: true, entry: updated });
  } catch (error) {
    return apiError(error, { route });
  }
});

/** Retire an entry. Kept in the register with a retiredAt, never deleted. */
export const DELETE = withSuperAdminParams(async (request, { user }, params) => {
  const route = "DELETE /api/super-admin/subprocessors/[id]";
  try {
    const body = await parseJsonBody<Record<string, unknown>>(request);
    const parsed = retireSchema.safeParse(body);

    if (!parsed.success) {
      return apiValidationError(firstIssue(parsed.error), route);
    }

    const now = new Date();
    // Retired rather than deleted: the register is the evidence that a vendor
    // once processed operator data, and for how long. Deleting the row destroys
    // the only record that the relationship existed.
    const retired = await prisma.subprocessors.update({
      where: { id: params.id },
      data: {
        status: "retired",
        retiredAt: now,
        updatedAt: now,
        notes: parsed.data.reason,
      },
    });

    await createAuditLog({
      action: "SUBPROCESSOR_RETIRED",
      entityType: "subprocessor",
      entityId: params.id,
      userId: user.id,
      userEmail: user.email,
      metadata: { name: retired.name, reason: parsed.data.reason },
      ...getClientInfo(request.headers),
    });

    logger.info("[Legal] Sub-processor retired", {
      entryId: params.id,
      name: retired.name,
    });

    return NextResponse.json({ success: true, entry: retired });
  } catch (error) {
    return apiError(error, { route });
  }
});
