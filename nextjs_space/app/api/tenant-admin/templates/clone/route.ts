import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { copyS3Directory, getJsonFromS3 } from "@/lib/s3";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { apiError } from "@/lib/api-error";
import { z } from "zod";
import { parseJsonBody } from "@/lib/validation/body";
import crypto from "crypto";

const cloneSchema = z
  .object({
    baseTemplateId: z.string().min(1).max(200),
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    // 1. Verify Authentication
    const user = await getCurrentUser();
    if (
      !user ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(user.role || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { baseTemplateId } = await parseJsonBody(request, cloneSchema);

    // 2. Get Tenant ID
    // getCurrentUser() now automatically resolves Clerk Org ID to database tenant UUID
    const tenantId = user.tenantId;

    if (!tenantId) {
      return NextResponse.json(
        {
          error: "No tenant found. Please ensure you are associated with a tenant.",
          details: "The Clerk organization ID could not be matched to a database tenant."
        },
        { status: 400 }
      );
    }

    // 3. Fetch Base Template
    const baseTemplate = await prisma.templates.findUnique({
      where: { id: baseTemplateId },
    });

    if (!baseTemplate) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    // 4. Define S3 paths — tenant owns tenants/{id}/templates/{slug}/
    const templateSlug = baseTemplate.slug || baseTemplateId;
    const sourceS3Prefix = `templates/${templateSlug}/`;
    const destS3Prefix = `tenants/${tenantId}/templates/${templateSlug}`;
    const destS3Dir = `${destS3Prefix}/`; // trailing slash needed for S3 copy operations

    console.log(`Cloning template from ${sourceS3Prefix} to ${destS3Dir}`);

    // 5. Copy S3 Assets
    const filesCopied = await copyS3Directory(sourceS3Prefix, destS3Dir);
    console.log(`Copied ${filesCopied} files`);

    // 5b. Read defaults.json from base template to seed DB fields
    let seedData: Record<string, any> = {};
    try {
      const defaults = await getJsonFromS3<any>(`${sourceS3Prefix}defaults.json`);
      if (defaults) {
        if (defaults.designSystem) seedData.designSystem = defaults.designSystem;
        if (defaults.pageContent) seedData.pageContent = defaults.pageContent;
        if (defaults.navigation) seedData.navigation = defaults.navigation;
        if (defaults.footer) seedData.footer = defaults.footer;
        if (defaults.heroImagePath) {
          seedData.heroImageUrl = `${destS3Dir}${defaults.heroImagePath}`;
        }
        if (defaults.logoPath) {
          seedData.logoUrl = `${destS3Dir}${defaults.logoPath}`;
        }
        console.log(`[Clone] Seeded from defaults.json: ${Object.keys(seedData).join(", ")}`);
      }
    } catch (err) {
      console.log("[Clone] No defaults.json found, skipping seed:", err);
    }

    // 6. Create TenantTemplate Record with correct schema fields
    const tenantTemplate = await prisma.tenant_templates.create({
      data: {
        id: crypto.randomUUID(),
        tenantId: tenantId,
        baseTemplateId: baseTemplateId,
        templateName: `${baseTemplate.name}`,
        s3Path: destS3Prefix,
        isActive: false, // Not active by default - user needs to activate
        isDraft: true,
        updatedAt: new Date(),
        ...seedData,
      },
    });

    console.log(`Created tenant template: ${tenantTemplate.id}`);

    // 7. Audit Log
    await createAuditLog({
      action: AUDIT_ACTIONS.TEMPLATE.CREATED,
      entityType: "TenantTemplate",
      entityId: tenantTemplate.id,
      userId: user.id,
      userEmail: user.email || undefined,
      tenantId: tenantId,
      metadata: {
        baseTemplateId,
        baseTemplateName: baseTemplate.name,
        filesCopied,
        s3Path: destS3Prefix,
      },
    });

    return NextResponse.json({
      success: true,
      templateId: tenantTemplate.id,
      templateName: tenantTemplate.templateName,
      filesCopied,
    });
  } catch (error: any) {
    console.error("Template Cloning Error:", error);
    return apiError(error, {
      route: "tenant-admin.templates.clone",
      status: 500,
      safeMessage: "Internal server error",
    });
  }
}
