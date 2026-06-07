import { NextResponse } from "next/server";
import { withTenantAuthParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { submitToMarketplace } from "@/lib/marketplace/marketplace-submission-service";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { apiError, apiValidationError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";
import { z } from "zod";
import { parseJsonBody } from "@/lib/validation/body";

const submitMarketplaceSchema = z
  .object({
    description: z.string().max(5000).optional(),
    category: z.string().max(100).optional(),
    tags: z.array(z.string().max(50)).max(50).optional(),
  })
  .strict();

export const POST = withTenantAuthParams(
  async (request, { user, tenantId }, params) => {
  try {
    const id = parseUuid(params.id);

    // Verify template belongs to tenant
    const template = await prisma.tenant_templates.findFirst({
      where: { id, tenantId },
    });

    if (!template) {
      return apiError(new Error("Template not found"), { route: "POST /api/tenant-admin/templates/[id]/submit-to-marketplace", status: 404, safeMessage: "Template not found" });
    }

    if (template.source !== "custom") {
      return apiValidationError("Only custom templates can be submitted to the marketplace", "POST /api/tenant-admin/templates/[id]/submit-to-marketplace");
    }

    const { description, category, tags } = await parseJsonBody(
      request,
      submitMarketplaceSchema,
    );

    const submission = await submitToMarketplace(id, {
      description,
      category,
      tags,
    });

    await createAuditLog({
      action: AUDIT_ACTIONS.TEMPLATE.UPDATED,
      entityType: "MarketplaceSubmission",
      entityId: submission.id,
      userId: user.id,
      userEmail: user.email || undefined,
      tenantId,
      metadata: {
        action: "submitted-to-marketplace",
        templateName: template.templateName,
        submissionId: submission.id,
      },
    });

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
    });
  } catch (error: any) {
    console.error("[Submit to Marketplace] Error:", error);
    return apiError(error, {
      route: "tenant-admin.templates.submit-to-marketplace",
      status: 500,
      safeMessage: "Failed to submit template",
    });
  }
});
