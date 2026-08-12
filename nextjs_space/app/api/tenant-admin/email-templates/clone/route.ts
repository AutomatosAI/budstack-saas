import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/permissions/require-permission";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";

const emailCloneSchema = z
  .object({
    originalTemplateId: z.string().min(1).max(200),
    eventType: z.string().min(1).max(100),
  })
  .strict();

// US-009 — cloning creates a tenant template and rebinds an event mapping, so
// it is an authoring action: canEditEmails.
export const POST = requirePermission("canEditEmails", async (req, { tenantId }) => {
  try {
    const { originalTemplateId, eventType } = await parseJsonBody(
      req,
      emailCloneSchema,
    );

    // 1. Fetch Original Template — tenant-scoped. findUnique bypasses the
    // Prisma tenant middleware (unique-field where only), so a tenant admin
    // could otherwise clone another tenant's private template by ID. Allow
    // only system templates or this tenant's own.
    const original = await prisma.email_templates.findFirst({
      where: { id: originalTemplateId, OR: [{ isSystem: true }, { tenantId }] },
    });

    if (!original) {
      return apiError(new Error("Original template not found"), { route: "POST /api/tenant-admin/email-templates/clone", status: 404, safeMessage: "Original template not found" });
    }

    // 2. Create Clone (Tenant Specific)
    const newTemplate = await prisma.email_templates.create({
      data: {
        name: `${original.name} (Custom)`,
        subject: original.subject,
        contentHtml: original.contentHtml,
        category: original.category,
        isSystem: false,
        tenantId: tenantId,
        description: `Customized version of ${original.name}`,
      },
    });

    // 3. Upsert Mapping for Tenant
    await prisma.email_event_mappings.upsert({
      where: {
        eventType_tenantId: {
          eventType: eventType,
          tenantId: tenantId,
        },
      },
      update: {
        templateId: newTemplate.id,
        isActive: true,
      },
      create: {
        eventType: eventType,
        tenantId: tenantId,
        templateId: newTemplate.id,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, newTemplateId: newTemplate.id });
  } catch (error) {
    return apiError(error, {
      route: "POST /api/tenant-admin/email-templates/clone",
    });
  }
});
