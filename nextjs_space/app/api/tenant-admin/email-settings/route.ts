import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import { ApiError, apiError } from "@/lib/api-error";
import { AUDIT_ACTIONS, createAuditLog, getClientInfo } from "@/lib/audit-log";
import { prisma } from "@/lib/db";
import {
  EMAIL_TRACKING_SETTING,
  isEmailTrackingEnabled,
} from "@/lib/email/email-tracking";
import {
  MAX_REORDER_REMINDER_DAYS,
  MIN_REORDER_REMINDER_DAYS,
  REORDER_REMINDER_DAYS_MESSAGE,
  REORDER_REMINDER_DAYS_SETTING,
  REORDER_REMINDER_SETTING,
  resolveReorderReminderRule,
} from "@/lib/email/reorder-reminder";
import { requirePermission } from "@/lib/permissions/require-permission";
import { parseJsonBody } from "@/lib/validation/body";

/**
 * US-027/US-028 — the email switches a store owns.
 *
 * A DEDICATED ROUTE rather than fields on `POST /api/tenant-admin/settings`,
 * which rewrites the whole SMTP block from a form: flipping a checkbox on the
 * email page would have to post credentials it never loaded, and a partial post
 * there overwrites `settings.smtp` with nulls. This one touches the keys it is
 * given and nothing else.
 *
 * Read on `canViewEmails` and written on `canEditEmails` — the split US-009
 * applied to every email surface. Both settings decide something a store is
 * answerable for (what it records about the people it mails; whether it mails
 * them unprompted at all), so the write is an email edit and every change leaves
 * an audit row saying who made it.
 */

const GET_ROUTE = "GET /api/tenant-admin/email-settings";
const PATCH_ROUTE = "PATCH /api/tenant-admin/email-settings";

const NOT_FOUND_MESSAGE = "Store not found.";

const EMPTY_PATCH_MESSAGE = "Nothing to change.";

/**
 * Every key optional, at least one required.
 *
 * Optional so the tracking toggle keeps posting exactly the body it posted
 * before this story — `.strict()` still refuses anything not listed. The refine
 * is what stops `{}` reading as a successful no-op that writes an audit row
 * saying nothing happened.
 *
 * The day bounds are enforced HERE, at the boundary, rather than left to the
 * sweep: an out-of-range interval that reached the column would fall back to the
 * 60-day default and silently ignore what the operator typed.
 */
const emailSettingsPatchSchema = z
  .object({
    [EMAIL_TRACKING_SETTING]: z.boolean().optional(),
    [REORDER_REMINDER_SETTING]: z.boolean().optional(),
    [REORDER_REMINDER_DAYS_SETTING]: z
      .number()
      .int()
      .min(MIN_REORDER_REMINDER_DAYS, { message: REORDER_REMINDER_DAYS_MESSAGE })
      .max(MAX_REORDER_REMINDER_DAYS, { message: REORDER_REMINDER_DAYS_MESSAGE })
      .optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: EMPTY_PATCH_MESSAGE,
  });

type EmailSettingsPatch = z.infer<typeof emailSettingsPatchSchema>;

/**
 * The stored blob with the posted keys set, and nothing else touched.
 *
 * Spread rather than replaced: `settings` also holds SMTP credentials, branding
 * and template config, and this route knows about three flags. A blob that is
 * not an object is replaced, because there is nothing there to preserve — but a
 * blob that merely fails Zod validation is kept as found, since the parse
 * helper's typed default exists for READING and writing it back would erase
 * whatever could not be parsed.
 *
 * `patch` is spread LAST and carries only keys the caller actually sent, so an
 * absent key leaves whatever is stored alone rather than clearing it.
 *
 * The JSON round trip is the repo's existing way of producing a value Prisma's
 * recursive `InputJsonValue` will actually accept (see
 * `lib/email/email-template-content.ts`), and it guarantees on the way that
 * what lands in the column is exactly what a read of the row hands back.
 */
function mergeEmailSettings(
  current: unknown,
  patch: EmailSettingsPatch,
): Record<string, unknown> {
  const base =
    typeof current === "object" && current !== null && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return { ...base, ...patch };
}

/** The merged blob as a value Prisma's recursive `InputJsonValue` accepts. */
function asJsonColumn(settings: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(settings));
}

/** The three switches as they now stand, for a response and for an audit row. */
function readEmailSettings(
  settings: unknown,
  tenantId: string,
): Required<EmailSettingsPatch> {
  const reorder = resolveReorderReminderRule(settings, tenantId);
  return {
    [EMAIL_TRACKING_SETTING]: isEmailTrackingEnabled(settings, tenantId),
    [REORDER_REMINDER_SETTING]: reorder.enabled,
    [REORDER_REMINDER_DAYS_SETTING]: reorder.days,
  };
}

/** The whole `settings` blob, read for the merge below. Never returned. */
async function loadSettings(tenantId: string): Promise<unknown> {
  const tenant: { settings: unknown } | null = await prisma.tenants.findFirst({
    where: { id: tenantId },
    select: { settings: true },
  });
  if (!tenant) throw new ApiError(NOT_FOUND_MESSAGE, 404);
  return tenant.settings;
}

export const GET = requirePermission("canViewEmails", async (_req, { tenantId }) => {
  try {
    const settings = await loadSettings(tenantId);
    return NextResponse.json(readEmailSettings(settings, tenantId));
  } catch (error) {
    return apiError(error, { route: GET_ROUTE });
  }
});

export const PATCH = requirePermission(
  "canEditEmails",
  async (req, { user, tenantId }) => {
    try {
      const patch = await parseJsonBody(req, emailSettingsPatchSchema);

      const current = await loadSettings(tenantId);
      const previous = readEmailSettings(current, tenantId);
      const merged = mergeEmailSettings(current, patch);

      await prisma.tenants.update({
        where: { id: tenantId },
        data: { settings: asJsonColumn(merged) },
      });

      // Re-derived from the merged blob rather than echoed from the request, so
      // the response and the audit row say what the store now holds — including
      // for the keys this request did not mention.
      const next = readEmailSettings(merged, tenantId);

      const { ipAddress, userAgent } = getClientInfo(req.headers);
      await createAuditLog({
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        entityType: "Tenant",
        entityId: tenantId,
        userId: user.id,
        userEmail: user.email,
        tenantId,
        metadata: {
          settings: Object.keys(patch),
          previous,
          next,
        },
        ipAddress,
        userAgent,
      });

      return NextResponse.json(next);
    } catch (error) {
      return apiError(error, { route: PATCH_ROUTE });
    }
  },
);
