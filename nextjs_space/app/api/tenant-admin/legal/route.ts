import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import type { ZodError } from "zod";
import { withTenantAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { apiError, apiValidationError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { legalProfileSchema } from "@/lib/legal/legal-profile-schema";
import { renderPolicyHtml } from "@/lib/legal/tenant-policy";
import { PRIVACY_TEMPLATE_VERSION } from "@/lib/legal/privacy-template";
import { MissingLegalTokenError } from "@/lib/legal/render-policy";
import { logger } from "@/lib/logger";

/**
 * Tenant legal profile — the controller identity merged into the operator's
 * privacy notice. The policy BODY is not editable here: it is a BudStacks
 * managed template so counsel reviews one document rather than one per tenant.
 *
 * See docs/PRDS/prd-data-protection-remediation.md (US-008).
 */

const ROUTE = "PUT /api/tenant-admin/legal";

/** First validation message, for the shared string-based error helper. */
function firstIssue(error: ZodError): string {
  return error.issues[0]?.message ?? "Invalid legal profile.";
}

export const PUT = withTenantAuth(async (request, { user, tenantId }) => {
  try {
    const body = await parseJsonBody<Record<string, unknown>>(request);
    const parsed = legalProfileSchema.safeParse(body);

    if (!parsed.success) {
      return apiValidationError(firstIssue(parsed.error), ROUTE);
    }

    // `publish` is an action flag, not part of the profile itself.
    const publish = body?.publish === true;

    if (publish) {
      // Never mark a profile published unless it actually renders. The
      // storefront serves the fallback when rendering fails, so publishing a
      // broken profile would silently leave the domain with no notice at all.
      try {
        renderPolicyHtml(parsed.data);
      } catch (error) {
        if (error instanceof MissingLegalTokenError) {
          return apiError(error, {
            route: ROUTE,
            status: 422,
            safeMessage:
              "This policy is missing required details and cannot be published yet.",
          });
        }
        throw error;
      }
    }

    const existing = await prisma.tenant_legal_profiles.findFirst({
      where: { tenantId },
      select: { id: true, publishedAt: true },
    });

    const now = new Date();
    const wasPublished = Boolean(existing?.publishedAt);

    const saved = existing
      ? await prisma.tenant_legal_profiles.update({
          where: { id: existing.id },
          data: {
            ...parsed.data,
            updatedAt: now,
            // First publish stamps the date; later saves keep the original.
            ...(publish
              ? {
                  publishedAt: existing.publishedAt ?? now,
                  templateVersion: PRIVACY_TEMPLATE_VERSION,
                }
              : {}),
          },
        })
      : await prisma.tenant_legal_profiles.create({
          data: {
            ...parsed.data,
            id: randomUUID(),
            tenantId,
            createdAt: now,
            updatedAt: now,
            publishedAt: publish ? now : null,
            templateVersion: publish ? PRIVACY_TEMPLATE_VERSION : null,
          },
        });

    await createAuditLog({
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      entityType: "tenant_legal_profile",
      entityId: saved.id,
      tenantId,
      userId: user.id,
      userEmail: user.email,
      metadata: {
        published: Boolean(saved.publishedAt),
        firstPublish: !wasPublished && Boolean(saved.publishedAt),
        templateVersion: saved.templateVersion,
      },
      ...getClientInfo(request.headers),
    });

    logger.info("[Legal] Tenant legal profile saved", {
      tenantId,
      published: Boolean(saved.publishedAt),
    });

    return NextResponse.json({
      success: true,
      profile: saved,
      published: Boolean(saved.publishedAt),
    });
  } catch (error) {
    return apiError(error, { route: ROUTE });
  }
});

/** Render a preview without saving. */
export const POST = withTenantAuth(async (request) => {
  const previewRoute = "POST /api/tenant-admin/legal";
  try {
    const body = await parseJsonBody<Record<string, unknown>>(request);
    const parsed = legalProfileSchema.safeParse(body);

    if (!parsed.success) {
      return apiValidationError(firstIssue(parsed.error), previewRoute);
    }

    return NextResponse.json({ html: renderPolicyHtml(parsed.data) });
  } catch (error) {
    if (error instanceof MissingLegalTokenError) {
      return apiError(error, {
        route: previewRoute,
        status: 422,
        safeMessage: "Fill in the required details to preview the policy.",
      });
    }
    return apiError(error, { route: previewRoute });
  }
});
