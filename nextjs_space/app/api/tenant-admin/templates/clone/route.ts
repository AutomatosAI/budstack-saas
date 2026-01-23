import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { copyDirectory } from "@/lib/s3-copy";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import crypto from "crypto";

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

    const body = await request.json();
    const { baseTemplateId } = body;

    if (!baseTemplateId) {
      return NextResponse.json(
        { error: "Missing baseTemplateId" },
        { status: 400 },
      );
    }

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

    // 4. Define S3 paths
    const sourceS3Prefix = `templates/${baseTemplate.slug || baseTemplateId}/`;
    const timestamp = Date.now();
    const destS3Prefix = `tenants/${tenantId}/templates/${timestamp}/`;

    console.log(`Cloning template from ${sourceS3Prefix} to ${destS3Prefix}`);

    // 5. Copy S3 Assets
    const filesCopied = await copyDirectory(sourceS3Prefix, destS3Prefix);
    console.log(`Copied ${filesCopied} files`);

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
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
