import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { withSuperAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { apiError, apiValidationError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";
import { createAuditLog, getClientInfo } from "@/lib/audit-log";
import { subprocessorSchema } from "@/lib/legal/subprocessor-schema";
import {
  MIN_NOTICE_DAYS,
  earliestEffectiveFrom,
  hasSufficientNotice,
} from "@/lib/legal/subprocessor-notice";
import { logger } from "@/lib/logger";

/**
 * Sub-processor register — super-admin CRUD.
 *
 * Adding a vendor here starts the DPA §6 clock. It does NOT announce: creation
 * and announcement are separate so an entry can be drafted, checked and only
 * then sent to every operator. An email to the whole customer base is not
 * something to trigger by saving a form.
 *
 * See docs/PRDS/prd-data-protection-remediation.md (WS3, US-012).
 */

const ROUTE = "POST /api/super-admin/subprocessors";

function firstIssue(error: ZodError): string {
  return error.issues[0]?.message ?? "Invalid sub-processor.";
}

export const GET = withSuperAdmin(async () => {
  try {
    const entries = await prisma.subprocessors.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      include: {
        _count: { select: { objections: { where: { status: "open" } } } },
      },
    });
    return NextResponse.json({ entries, minNoticeDays: MIN_NOTICE_DAYS });
  } catch (error) {
    return apiError(error, { route: "GET /api/super-admin/subprocessors" });
  }
});

export const POST = withSuperAdmin(async (request, { user }) => {
  try {
    const body = await parseJsonBody<Record<string, unknown>>(request);
    const parsed = subprocessorSchema.safeParse(body);

    if (!parsed.success) {
      return apiValidationError(firstIssue(parsed.error), ROUTE);
    }

    const input = parsed.data;
    const now = new Date();

    const existing = await prisma.subprocessors.findFirst({
      where: { id: input.id },
      select: { id: true },
    });
    if (existing) {
      return apiValidationError(
        `A register entry with id "${input.id}" already exists.`,
        ROUTE,
      );
    }

    // The 30-day floor is enforced here rather than trusted to the caller.
    // Shortening it is possible but must be deliberate and reasoned, because it
    // takes away notice the DPA already promised operators.
    if (!hasSufficientNotice(now, input.effectiveFrom)) {
      if (!input.overrideNoticePeriod) {
        return apiValidationError(
          `Operators are entitled to ${MIN_NOTICE_DAYS} days' notice. The earliest ` +
            `effective date is ${earliestEffectiveFrom(now).toISOString().slice(0, 10)}. ` +
            `To go sooner, set overrideNoticePeriod with a reason.`,
          ROUTE,
        );
      }
      if (!input.overrideReason) {
        return apiValidationError(
          "Shortening the notice period requires a reason.",
          ROUTE,
        );
      }
    }

    const created = await prisma.subprocessors.create({
      data: {
        id: input.id,
        name: input.name,
        purpose: input.purpose,
        region: input.region,
        transferMechanism: input.transferMechanism,
        dpaUrl: input.dpaUrl ?? null,
        effectiveFrom: input.effectiveFrom,
        notes: input.notes ?? null,
        status: "pending",
        announcedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    });

    await createAuditLog({
      action: "SUBPROCESSOR_CREATED",
      entityType: "subprocessor",
      entityId: created.id,
      userId: user.id,
      userEmail: user.email,
      metadata: {
        name: created.name,
        effectiveFrom: created.effectiveFrom.toISOString(),
        noticeDays: Math.round(
          (created.effectiveFrom.getTime() - now.getTime()) / 86_400_000,
        ),
        noticeOverridden: Boolean(input.overrideNoticePeriod),
        overrideReason: input.overrideReason ?? null,
      },
      ...getClientInfo(request.headers),
    });

    logger.info("[Legal] Sub-processor drafted", {
      entryId: created.id,
      effectiveFrom: created.effectiveFrom,
    });

    return NextResponse.json({
      success: true,
      entry: created,
      // Explicit: saving does not tell anyone. Announcing does.
      announced: false,
      next: "Announce this entry to notify operators and start the objection window.",
    });
  } catch (error) {
    return apiError(error, { route: ROUTE });
  }
});
