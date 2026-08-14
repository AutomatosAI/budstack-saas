import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError } from "@/lib/api-error";
import { AUDIT_ACTIONS, createAuditLog, getClientInfo } from "@/lib/audit-log";
import { prisma } from "@/lib/db";
import { FEATURES } from "@/lib/entitlements/features";
import { requireFeature } from "@/lib/entitlements/require-feature";
import { requirePermission } from "@/lib/permissions/require-permission";
import {
  BING_SITE_VERIFICATION_MAX_LENGTH,
  GA4_MEASUREMENT_ID_MAX_LENGTH,
  GOOGLE_SITE_VERIFICATION_MAX_LENGTH,
  SITE_VERIFICATION_FIELDS,
  checkSiteVerificationField,
  readSiteVerification,
  type SiteVerificationValues,
} from "@/lib/seo/site-verification";
import { parseJsonBody } from "@/lib/validation/body";

/**
 * SEO Supercharge US-026 — the store's verification tokens and GA4 id.
 *
 * TWO GATES, COMPOSED, in the sanctioned order: `requirePermission` answers "may
 * this MEMBER", the `requireFeature` inside it answers "may this TENANT". An
 * unauthorised member is refused before the plan lookup runs and never learns
 * the store's plan (lib/entitlements/require-feature.ts).
 *
 * THREE NAMED FIELDS AND NOTHING ELSE (`.strict()`): there is no key on this
 * wire that carries markup. What each field will accept is
 * `SITE_VERIFICATION_FIELDS` — the same contract the settings section validates
 * against before it posts, so the owner is told what is wrong with what they
 * pasted rather than meeting a generic failure after the round trip.
 *
 * THE MERGE IS READ-MODIFY-WRITE over the RAW blob, per the cookie-settings
 * precedent. `tenants.settings` carries the whole storefront configuration and
 * writing back a parsed copy would quietly drop any key this platform version
 * does not know about.
 */

const ROUTE = "/api/tenant-admin/seo/verification";

/**
 * Bounds only. The charset is applied per field below, so a bad token comes back
 * as "that is not a Google verification token" rather than as `parseJsonBody`'s
 * generic 400. `""` clears a field; `null` is accepted as the same intent
 * because that is what a cleared value reads back as.
 */
const updateSchema = z
  .object({
    googleSiteVerification: z
      .string()
      .max(GOOGLE_SITE_VERIFICATION_MAX_LENGTH)
      .nullable()
      .optional(),
    bingSiteVerification: z
      .string()
      .max(BING_SITE_VERIFICATION_MAX_LENGTH)
      .nullable()
      .optional(),
    ga4MeasurementId: z
      .string()
      .max(GA4_MEASUREMENT_ID_MAX_LENGTH)
      .nullable()
      .optional(),
  })
  .strict();

export const PUT = requirePermission(
  "canEditSeo",
  requireFeature(
    FEATURES.SEO_PRO,
    async (request, { tenantId, user }) => {
      let parsed: z.infer<typeof updateSchema>;
      try {
        parsed = await parseJsonBody(request, updateSchema);
      } catch (error) {
        return apiError(error, { route: `PUT ${ROUTE}` });
      }

      // Absent keys are left alone — a section that only edits the GA4 id must
      // not clear the two verification tokens beside it.
      const submitted = SITE_VERIFICATION_FIELDS.filter(
        (spec) => parsed[spec.key] !== undefined,
      );

      const values: Record<string, string> = {};
      for (const spec of submitted) {
        const checked = checkSiteVerificationField(spec, parsed[spec.key]);
        if (!checked.ok) {
          return NextResponse.json(
            { error: checked.message, code: "invalid_field", field: spec.key },
            { status: 400 },
          );
        }
        values[spec.key] = checked.value;
      }

      try {
        const tenant: { settings: unknown } | null =
          await prisma.tenants.findFirst({
            where: { id: tenantId },
            select: { settings: true },
          });

        if (!tenant) {
          return apiError(new Error("Tenant not found"), {
            route: `PUT ${ROUTE}`,
            status: 404,
            safeMessage: "Store not found",
          });
        }

        const existing = (tenant.settings as Record<string, unknown>) ?? {};
        const settings = {
          ...existing,
          // A cleared field is stored as null rather than "": the storefront
          // readers treat both as absent, and null is what the rest of this blob
          // uses for "not set".
          ...Object.fromEntries(
            submitted.map((spec) => [spec.key, values[spec.key] || null]),
          ),
        };

        await prisma.tenants.update({
          where: { id: tenantId },
          data: { settings, updatedAt: new Date() },
        });

        const { ipAddress, userAgent } = getClientInfo(request.headers);
        await createAuditLog({
          action: AUDIT_ACTIONS.SEO_VERIFICATION_UPDATED,
          entityType: "Tenant",
          entityId: tenantId,
          userId: user.id,
          userEmail: user.email,
          tenantId,
          // WHICH fields changed and whether each is now set — never the tokens
          // themselves. They are not secrets (both are published as meta tags),
          // but an audit row is not the place to reprint them either.
          metadata: {
            fields: submitted.map((spec) => spec.key),
            cleared: submitted
              .filter((spec) => !values[spec.key])
              .map((spec) => spec.key),
          },
          ipAddress,
          userAgent,
        });

        const stored: SiteVerificationValues = readSiteVerification(
          settings as Parameters<typeof readSiteVerification>[0],
        );
        return NextResponse.json({ verification: stored });
      } catch (error) {
        return apiError(error, {
          route: `PUT ${ROUTE}`,
          safeMessage: "Could not save those settings",
        });
      }
    },
  ),
);
