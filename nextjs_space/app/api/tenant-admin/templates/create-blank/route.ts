import { NextResponse } from "next/server";
import { withTenantAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { createS3Client, getBucketConfig } from "@/lib/storage/aws-config";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { generateSlug } from "@/lib/templates/template-utils";
import { apiError, apiValidationError } from "@/lib/api-error";
import {
  getOrCreateCustomBase,
  BLANK_LAYOUT,
  BLANK_DESIGN_SYSTEM,
  BLANK_PAGE_CONTENT,
  BLANK_NAVIGATION,
  BLANK_FOOTER,
  BLANK_STYLES_CSS,
} from "@/lib/templates/blank-template-defaults";
import crypto from "crypto";
import { z } from "zod";
import { parseJsonBody } from "@/lib/validation/body";

const createBlankSchema = z
  .object({
    templateName: z.string().min(1).max(200),
  })
  .strict();

export const POST = withTenantAuth(async (request, { user, tenantId }) => {
  try {
    // 2. Validate template name
    const { templateName } = await parseJsonBody(request, createBlankSchema);

    if (!templateName.trim()) {
      return apiValidationError(
        "Template name is required",
        "POST /api/tenant-admin/templates/create-blank",
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
      return apiError(
        new Error(
          `You already have a template named "${trimmedName}". Please use a different name.`,
        ),
        {
          route: "POST /api/tenant-admin/templates/create-blank",
          status: 409,
          safeMessage: `You already have a template named "${trimmedName}". Please use a different name.`,
        },
      );
    }

    // 4. Get or create custom-base FK
    const customBase = await getOrCreateCustomBase();

    // 5. Generate S3 path and write starter files — tenants/{id}/templates/{slug}/
    const slug = generateSlug(trimmedName);
    const { bucketName } = await getBucketConfig();
    const s3Path = `tenants/${tenantId}/templates/${slug}`;

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
    return apiError(error, {
      route: "tenant-admin.templates.create-blank",
      status: 500,
      safeMessage: "Internal server error",
    });
  }
});
