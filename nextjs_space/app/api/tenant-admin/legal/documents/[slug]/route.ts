import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withTenantAuthParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { apiError, apiValidationError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { LEGAL_DOCUMENT_SLUGS, getLegalDocument, type LegalDocumentSlug } from "@/lib/legal/documents";
import { renderMarkdown } from "@/lib/legal/markdown";
import { logger } from "@/lib/logger";

/**
 * An operator choosing, for one document, between the maintained default and
 * their own wording — and publishing it.
 *
 * See docs/PRDS/prd-data-protection-remediation.md.
 */

const schema = z.object({
  mode: z.enum(["default", "custom"]),
  body: z.string().max(200_000).optional(),
  publish: z.boolean().optional().default(false),
  /**
   * Set when switching to custom. Recorded with a timestamp and user, so
   * responsibility for the wording is never ambiguous in either direction.
   */
  acceptResponsibility: z.boolean().optional().default(false),
});

function isSlug(value: string): value is LegalDocumentSlug {
  return (LEGAL_DOCUMENT_SLUGS as string[]).includes(value);
}

export const PUT = withTenantAuthParams(async (request, { user, tenantId }, params) => {
  const route = "PUT /api/tenant-admin/legal/documents/[slug]";
  try {
    if (!isSlug(params.slug)) {
      return apiError(new Error("Unknown document"), {
        route,
        status: 404,
        safeMessage: "Unknown document.",
      });
    }
    const slug = params.slug;

    const body = await parseJsonBody<Record<string, unknown>>(request);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return apiValidationError(
        parsed.error.issues[0]?.message ?? "Invalid request.",
        route,
      );
    }

    const input = parsed.data;
    const existing = await prisma.tenant_legal_documents.findFirst({
      where: { tenantId, slug },
    });
    const now = new Date();

    // Publishing your own wording with nothing written would leave the page
    // serving the "not published" notice — refuse it here so the operator finds
    // out at the point of action rather than by looking at their live site.
    if (input.mode === "custom" && input.publish) {
      const text = (input.body ?? existing?.body ?? "").trim();
      if (text === "") {
        return apiValidationError(
          "Write your wording before publishing, or switch back to the standard text.",
          route,
        );
      }
    }

    const switchingToCustom =
      input.mode === "custom" && existing?.mode !== "custom";

    if (switchingToCustom && !input.acceptResponsibility) {
      return apiError(new Error("Responsibility not accepted"), {
        route,
        status: 422,
        safeMessage:
          "Using your own wording means you are responsible for its content and for keeping it current. Confirm to continue.",
      });
    }

    const responsibility = switchingToCustom
      ? { responsibilityAcceptedAt: now, responsibilityAcceptedByUserId: user.id }
      : {};

    // Version is only meaningful on the default. Custom text is the operator's,
    // and stamping our version on it would misstate what they published.
    const templateVersion =
      input.mode === "default" ? getLegalDocument(slug).version : null;

    const data = {
      mode: input.mode,
      body: input.mode === "custom" ? (input.body ?? existing?.body ?? "") : existing?.body ?? null,
      updatedAt: now,
      templateVersion,
      ...(input.publish ? { publishedAt: existing?.publishedAt ?? now } : {}),
      ...responsibility,
    };

    const saved = existing
      ? await prisma.tenant_legal_documents.update({
          where: { id: existing.id },
          data,
        })
      : await prisma.tenant_legal_documents.create({
          data: {
            ...data,
            id: randomUUID(),
            tenantId,
            slug,
            createdAt: now,
            publishedAt: input.publish ? now : null,
          },
        });

    await createAuditLog({
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      entityType: "tenant_legal_document",
      entityId: saved.id,
      tenantId,
      userId: user.id,
      userEmail: user.email,
      metadata: {
        slug,
        mode: saved.mode,
        published: Boolean(saved.publishedAt),
        switchedToCustom: switchingToCustom,
      },
      ...getClientInfo(request.headers),
    });

    logger.info("[Legal] Tenant document saved", {
      tenantId,
      slug,
      mode: saved.mode,
      published: Boolean(saved.publishedAt),
    });

    return NextResponse.json({ success: true, document: saved });
  } catch (error) {
    return apiError(error, { route });
  }
});

/** Preview the operator's own wording as the storefront would render it. */
export const POST = withTenantAuthParams(async (request, _ctx, params) => {
  const route = "POST /api/tenant-admin/legal/documents/[slug]";
  try {
    if (!isSlug(params.slug)) {
      return apiError(new Error("Unknown document"), {
        route,
        status: 404,
        safeMessage: "Unknown document.",
      });
    }

    const body = await parseJsonBody<Record<string, unknown>>(request);
    const text = typeof body?.body === "string" ? body.body : "";

    return NextResponse.json({ html: renderMarkdown(text) });
  } catch (error) {
    return apiError(error, { route });
  }
});
