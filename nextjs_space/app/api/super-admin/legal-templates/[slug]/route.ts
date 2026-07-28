import { NextResponse } from "next/server";
import { z } from "zod";
import { withSuperAdminParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { apiError, apiValidationError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";
import { createAuditLog, getClientInfo } from "@/lib/audit-log";
import {
  LEGAL_DOCUMENT_SLUGS,
  getLegalDocument,
  type LegalDocumentSlug,
} from "@/lib/legal/documents";
import { findUnresolvedTokens } from "@/lib/legal/render-policy";
import { logger } from "@/lib/logger";

/**
 * Editing the maintained default wording.
 *
 * Every operator on `default` inherits this immediately, so it is deliberately
 * super-admin only, versioned, and audit-logged.
 *
 * There is no seed migration: until someone edits, the shipped code template is
 * served and this table is empty. The first save creates the row.
 *
 * See docs/PRDS/prd-data-protection-remediation.md.
 */

const schema = z.object({
  body: z.string().trim().min(200, "That looks too short to be a legal document."),
  version: z
    .string()
    .trim()
    .regex(/^\d+\.\d+\.\d+$/, "Use a semver version, e.g. 1.1.0."),
});

function isSlug(value: string): value is LegalDocumentSlug {
  return (LEGAL_DOCUMENT_SLUGS as string[]).includes(value);
}

export const GET = withSuperAdminParams(async (_request, _ctx, params) => {
  const route = "GET /api/super-admin/legal-templates/[slug]";
  try {
    if (!isSlug(params.slug)) {
      return apiError(new Error("Unknown document"), {
        route,
        status: 404,
        safeMessage: "Unknown document.",
      });
    }

    const shipped = getLegalDocument(params.slug);
    const stored = await prisma.platform_legal_templates.findFirst({
      where: { slug: params.slug },
    });

    return NextResponse.json({
      slug: params.slug,
      title: shipped.title,
      requiredTokens: shipped.requiredTokens,
      body: stored?.body ?? shipped.template,
      version: stored?.version ?? shipped.version,
      // False means nobody has edited it and the shipped wording is in force.
      edited: Boolean(stored),
    });
  } catch (error) {
    return apiError(error, { route });
  }
});

export const PUT = withSuperAdminParams(async (request, { user }, params) => {
  const route = "PUT /api/super-admin/legal-templates/[slug]";
  try {
    if (!isSlug(params.slug)) {
      return apiError(new Error("Unknown document"), {
        route,
        status: 404,
        safeMessage: "Unknown document.",
      });
    }
    const slug = params.slug;
    const shipped = getLegalDocument(slug);

    const body = await parseJsonBody<Record<string, unknown>>(request);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiValidationError(
        parsed.error.issues[0]?.message ?? "Invalid template.",
        route,
      );
    }

    // Every required token must still be present, or the document stops
    // rendering for every operator inheriting it — a silent outage across the
    // estate caused by an edit that looked fine.
    const missing = shipped.requiredTokens.filter(
      (token) => !parsed.data.body.includes(`{{${token}}}`),
    );
    if (missing.length > 0) {
      return apiValidationError(
        `This wording no longer includes ${missing
          .map((t) => `{{${t}}}`)
          .join(", ")}. Every operator inheriting it would stop publishing.`,
        route,
      );
    }

    // Tokens the merge engine will not be able to fill.
    const known = new Set([
      ...shipped.requiredTokens,
      "tradingName",
      "supportContactEmail",
      "governingLaw",
      "deliveryTerms",
      "returnsPolicy",
      "licenceNumber",
      "regulatorName",
      "icoRegistrationNumber",
      "dpoName",
      "dpoContact",
      "ukRepresentative",
      "controllerLegalName",
      "registeredAddress",
      "privacyContactEmail",
    ]);
    const unknown = findUnresolvedTokens(parsed.data.body).filter(
      (token) => !known.has(token),
    );
    if (unknown.length > 0) {
      return apiValidationError(
        `Unknown placeholder(s): ${unknown.map((t) => `{{${t}}}`).join(", ")}.`,
        route,
      );
    }

    const now = new Date();
    const existing = await prisma.platform_legal_templates.findFirst({
      where: { slug },
    });

    const saved = existing
      ? await prisma.platform_legal_templates.update({
          where: { slug },
          data: {
            body: parsed.data.body,
            version: parsed.data.version,
            updatedByUserId: user.id,
            updatedAt: now,
          },
        })
      : await prisma.platform_legal_templates.create({
          data: {
            slug,
            title: shipped.title,
            body: parsed.data.body,
            version: parsed.data.version,
            updatedByUserId: user.id,
            createdAt: now,
            updatedAt: now,
          },
        });

    const inheriting = await prisma.tenant_legal_documents.count({
      where: { slug, mode: "default", publishedAt: { not: null } },
    });

    await createAuditLog({
      action: "LEGAL_TEMPLATE_UPDATED",
      entityType: "platform_legal_template",
      entityId: slug,
      userId: user.id,
      userEmail: user.email,
      metadata: {
        version: saved.version,
        previousVersion: existing?.version ?? shipped.version,
        storefrontsAffected: inheriting,
      },
      ...getClientInfo(request.headers),
    });

    logger.info("[Legal] Platform template updated", {
      slug,
      version: saved.version,
      storefrontsAffected: inheriting,
    });

    return NextResponse.json({
      success: true,
      template: saved,
      // Stated back so the effect of the edit is not a surprise.
      storefrontsAffected: inheriting,
    });
  } catch (error) {
    return apiError(error, { route });
  }
});
