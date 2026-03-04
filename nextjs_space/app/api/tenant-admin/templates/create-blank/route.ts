import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { createS3Client, getBucketConfig } from "@/lib/aws-config";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { generateSlug } from "@/lib/template-utils";
import {
  getOrCreateCustomBase,
  BLANK_LAYOUT,
  BLANK_DESIGN_SYSTEM,
  BLANK_PAGE_CONTENT,
  BLANK_NAVIGATION,
  BLANK_FOOTER,
  BLANK_STYLES_CSS,
} from "@/lib/blank-template-defaults";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const user = await getCurrentUser();
    if (
      !user ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(user.role || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { error: "No tenant found. Please ensure you are associated with a tenant." },
        { status: 400 },
      );
    }

    // 2. Validate template name
    const body = await request.json();
    const { templateName } = body;

    if (!templateName || !templateName.trim()) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 },
      );
    }

    const trimmedName = templateName.trim();

    // 3. Check name uniqueness within tenant
    const existing = await prisma.tenant_templates.findFirst({
      where: {
        tenantId,
        templateName: { equals: trimmedName, mode: "insensitive" },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: `You already have a template named "${trimmedName}". Please use a different name.` },
        { status: 409 },
      );
    }

    // 4. Get or create custom-base FK
    const customBase = await getOrCreateCustomBase();

    // 5. Generate S3 path and write starter files
    const slug = generateSlug(trimmedName);
    const timestamp = Date.now();
    const { folderPrefix, bucketName } = await getBucketConfig();
    const s3Path = `${folderPrefix}tenants/${tenantId}/custom-templates/${slug}-${timestamp}`;

    const s3Client = await createS3Client();

    const defaults = {
      designSystem: BLANK_DESIGN_SYSTEM,
      pageContent: BLANK_PAGE_CONTENT,
      navigation: BLANK_NAVIGATION,
      footer: BLANK_FOOTER,
    };

    await Promise.all([
      s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: `${s3Path}/layout.json`,
          Body: Buffer.from(JSON.stringify(BLANK_LAYOUT, null, 2)),
          ContentType: "application/json",
        }),
      ),
      s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: `${s3Path}/defaults.json`,
          Body: Buffer.from(JSON.stringify(defaults, null, 2)),
          ContentType: "application/json",
        }),
      ),
      s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: `${s3Path}/styles.css`,
          Body: Buffer.from(BLANK_STYLES_CSS),
          ContentType: "text/css",
        }),
      ),
    ]);

    // 6. Create tenant_templates record
    const tenantTemplate = await prisma.tenant_templates.create({
      data: {
        id: crypto.randomUUID(),
        tenantId,
        baseTemplateId: customBase.id,
        templateName: trimmedName,
        s3Path,
        designSystem: BLANK_DESIGN_SYSTEM,
        pageContent: BLANK_PAGE_CONTENT,
        navigation: BLANK_NAVIGATION,
        footer: BLANK_FOOTER,
        source: "custom",
        isDraft: true,
        isActive: false,
        updatedAt: new Date(),
      },
    });

    // 7. Audit log
    await createAuditLog({
      action: AUDIT_ACTIONS.TEMPLATE.CREATED,
      entityType: "TenantTemplate",
      entityId: tenantTemplate.id,
      userId: user.id,
      userEmail: user.email || undefined,
      tenantId,
      metadata: {
        templateName: trimmedName,
        source: "blank-canvas",
        s3Path,
      },
    });

    return NextResponse.json({
      success: true,
      templateId: tenantTemplate.id,
      templateName: tenantTemplate.templateName,
    });
  } catch (error: any) {
    console.error("Create Blank Template Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 },
    );
  }
}
