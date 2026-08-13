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
import { requirePermission } from "@/lib/permissions/require-permission";
import { parseJsonBody } from "@/lib/validation/body";

/**
 * US-027 — the per-tenant open/click tracking switch.
 *
 * A DEDICATED ROUTE rather than a field on `POST /api/tenant-admin/settings`,
 * which rewrites the whole SMTP block from a form: flipping a checkbox on the
 * email page would have to post credentials it never loaded, and a partial post
 * there overwrites `settings.smtp` with nulls. This one touches ONE key.
 *
 * Read on `canViewEmails` and written on `canEditEmails` — the split US-009
 * applied to every email surface. Tracking decides what a store records about
 * the people it mails and what its privacy notice has to say (US-007's privacy
 * template renders a disclosure clause off this same flag), so the write is an
 * email edit, and every flip leaves an audit row saying who made it.
 */

const GET_ROUTE = "GET /api/tenant-admin/email-settings";
const PATCH_ROUTE = "PATCH /api/tenant-admin/email-settings";

const NOT_FOUND_MESSAGE = "Store not found.";

const emailSettingsPatchSchema = z
  .object({ [EMAIL_TRACKING_SETTING]: z.boolean() })
  .strict();

/**
 * The stored blob with ONE key set.
 *
 * Spread rather than replaced: `settings` also holds SMTP credentials, branding
 * and template config, and this route knows about a single flag. A blob that is
 * not an object is replaced, because there is nothing there to preserve — but a
 * blob that merely fails Zod validation is kept as found, since the parse
 * helper's typed default exists for READING and writing it back would erase
 * whatever could not be parsed.
 *
 * The JSON round trip is the repo's existing way of producing a value Prisma's
 * recursive `InputJsonValue` will actually accept (see
 * `lib/email/email-template-content.ts`), and it guarantees on the way that
 * what lands in the column is exactly what a read of the row hands back.
 */
function mergeTrackingFlag(
  current: unknown,
  enabled: boolean,
): Prisma.InputJsonValue {
  const base =
    typeof current === "object" && current !== null && !Array.isArray(current)
      ? (current as Record<string, unknown>)
      : {};
  return JSON.parse(
    JSON.stringify({ ...base, [EMAIL_TRACKING_SETTING]: enabled }),
  );
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
    return NextResponse.json({
      [EMAIL_TRACKING_SETTING]: isEmailTrackingEnabled(settings, tenantId),
    });
  } catch (error) {
    return apiError(error, { route: GET_ROUTE });
  }
});

export const PATCH = requirePermission(
  "canEditEmails",
  async (req, { user, tenantId }) => {
    try {
      const body = await parseJsonBody(req, emailSettingsPatchSchema);
      const enabled = body[EMAIL_TRACKING_SETTING];

      const current = await loadSettings(tenantId);
      const previous = isEmailTrackingEnabled(current, tenantId);

      await prisma.tenants.update({
        where: { id: tenantId },
        data: { settings: mergeTrackingFlag(current, enabled) },
      });

      const { ipAddress, userAgent } = getClientInfo(req.headers);
      await createAuditLog({
        action: AUDIT_ACTIONS.SETTINGS_UPDATED,
        entityType: "Tenant",
        entityId: tenantId,
        userId: user.id,
        userEmail: user.email,
        tenantId,
        metadata: {
          setting: EMAIL_TRACKING_SETTING,
          previous,
          next: enabled,
        },
        ipAddress,
        userAgent,
      });

      return NextResponse.json({ [EMAIL_TRACKING_SETTING]: enabled });
    } catch (error) {
      return apiError(error, { route: PATCH_ROUTE });
    }
  },
);
