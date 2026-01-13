/**
 * Template Cloning Service
 *
 * Handles tenant-specific template customization:
 * - Clone base templates for individual tenants
 * - Upload tenant assets to S3
 * - Manage template activation and switching
 */

import { prisma } from "./db";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import * as fs from "fs/promises";
import * as path from "path";

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
});

const BUCKET_NAME = process.env.AWS_BUCKET_NAME!;
const FOLDER_PREFIX = process.env.AWS_FOLDER_PREFIX || "";

interface CloneTemplateOptions {
  isDraft?: boolean;
  customName?: string;
}

/**
 * Clone a base template for a specific tenant
 * Creates a TenantTemplate instance with default settings from the base template
 */
export async function cloneTemplateForTenant(
  tenantId: string,
  baseTemplateSlug: string,
  options?: CloneTemplateOptions,
) {
  try {
    // 1. Get base template
    const baseTemplate = await prisma.templates.findUnique({
      where: { slug: baseTemplateSlug },
    });

    if (!baseTemplate) {
      throw new Error(`Template "${baseTemplateSlug}" not found`);
    }

    // 2. Load defaults.json from template directory
    const defaultsPath = path.join(
      process.cwd(),
      "templates",
      baseTemplateSlug,
      "defaults.json",
    );

    let defaults: any = {};
    try {
      const defaultsContent = await fs.readFile(defaultsPath, "utf-8");
      defaults = JSON.parse(defaultsContent);
    } catch (error) {
      console.warn(
        `No defaults.json found for ${baseTemplateSlug}, using empty defaults`,
      );
      defaults = {
        designSystem: {},
        pageContent: {},
        navigation: {},
        footer: {},
      };
    }

    // 3. Generate S3 path for this tenant template instance
    const timestamp = Date.now();
    const s3Path = `${FOLDER_PREFIX}tenants/${tenantId}/templates/${timestamp}`;

    // 4. Determine template name
    const templateName = options?.customName || `${baseTemplate.name} - Custom`;

    // 5. Create TenantTemplate record
    const tenantTemplate = await prisma.tenant_templates.create({
      data: {
        tenantId,
        baseTemplateId: baseTemplate.id,
        templateName,
        s3Path,
        designSystem: defaults.designSystem || {},
        pageContent: defaults.pageContent || {},
        navigation: defaults.navigation || {},
        footer: defaults.footer || {},
        isDraft: options?.isDraft || false,
        expiresAt: options?.isDraft
          ? new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
          : null,
        isActive: !options?.isDraft, // Active immediately if not a draft
      },
    });

    // 6. If not a draft, set as active template
    if (!options?.isDraft) {
      // Deactivate all other templates for this tenant
      await prisma.tenant_templates.updateMany({
        where: {
          tenantId,
          id: { not: tenantTemplate.id },
        },
        data: { isActive: false },
      });

      // Set this template as the active one
      await prisma.tenants.update({
        where: { id: tenantId },
        data: { activeTenantTemplateId: tenantTemplate.id },
      });
    }

    console.log(
      `✓ Cloned template "${baseTemplateSlug}" for tenant ${tenantId}`,
    );
    return tenantTemplate;
  } catch (error) {
    console.error("Error cloning template:", error);
    throw error;
  }
}

/**
 * Switch tenant's active template
 * Archives the current template and activates a new one
 */
export async function switchTenantTemplate(
  tenantId: string,
  newTemplateId: string,
) {
  try {
    // Verify the new template belongs to this tenant
    const newTemplate = await prisma.tenant_templates.findUnique({
      where: { id: newTemplateId },
    });

    if (!newTemplate || newTemplate.tenantId !== tenantId) {
      throw new Error("Template not found or does not belong to this tenant");
    }

    // Deactivate all templates
    await prisma.tenant_templates.updateMany({
      where: { tenantId },
      data: { isActive: false },
    });

    // Activate the new template
    await prisma.tenant_templates.update({
      where: { id: newTemplateId },
      data: { isActive: true },
    });

    // Update tenant's active template reference
    await prisma.tenants.update({
      where: { id: tenantId },
      data: { activeTenantTemplateId: newTemplateId },
    });

    console.log(`✓ Switched tenant ${tenantId} to template ${newTemplateId}`);
    return newTemplate;
  } catch (error) {
    console.error("Error switching template:", error);
    throw error;
  }
}

/**
 * Upload an asset file to S3 for a tenant template
 * Supports logo, hero image, and favicon
 */
export async function uploadTenantAsset(
  tenantTemplateId: string,
  file: Buffer,
  fileName: string,
  assetType: "logo" | "hero" | "favicon",
  contentType: string,
): Promise<string> {
  try {
    // 1. Get tenant template
    const tenantTemplate = await prisma.tenant_templates.findUnique({
      where: { id: tenantTemplateId },
    });

    if (!tenantTemplate) {
      throw new Error("Tenant template not found");
    }

    // 2. Generate S3 key
    const fileExtension = fileName.split(".").pop();
    const s3Key = `${tenantTemplate.s3Path}/${assetType}.${fileExtension}`;

    // 3. Upload to S3
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: file,
        ContentType: contentType,
      }),
    );

    // 4. Generate public URL
    const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`;

    // 5. Update tenant template record
    const updateData: any = {};
    if (assetType === "logo") {
      updateData.logoUrl = url;
    } else if (assetType === "hero") {
      updateData.heroImageUrl = url;
    } else if (assetType === "favicon") {
      updateData.faviconUrl = url;
    }

    await prisma.tenant_templates.update({
      where: { id: tenantTemplateId },
      data: updateData,
    });

    console.log(`✓ Uploaded ${assetType} for template ${tenantTemplateId}`);
    return url;
  } catch (error) {
    console.error("Error uploading asset:", error);
    throw error;
  }
}

/**
 * Update tenant template customizations
 * Saves design system, content, navigation, footer changes
 */
export async function updateTenantTemplate(
  tenantTemplateId: string,
  updates: {
    designSystem?: any;
    pageContent?: any;
    navigation?: any;
    footer?: any;
    customCss?: string;
    customJs?: string;
  },
) {
  try {
    const updated = await prisma.tenant_templates.update({
      where: { id: tenantTemplateId },
      data: updates,
    });

    console.log(`✓ Updated template ${tenantTemplateId}`);
    return updated;
  } catch (error) {
    console.error("Error updating template:", error);
    throw error;
  }
}

/**
 * Delete a tenant template and its S3 assets
 * Cannot delete if it's the active template
 */
export async function deleteTenantTemplate(tenantTemplateId: string) {
  try {
    const template = await prisma.tenant_templates.findUnique({
      where: { id: tenantTemplateId },
    });

    if (!template) {
      throw new Error("Template not found");
    }

    if (template.isActive) {
      throw new Error(
        "Cannot delete active template. Switch to another template first.",
      );
    }

    // Delete S3 assets (optional - for cleanup)
    if (template.s3Path) {
      const assetsToDelete = [
        template.logoUrl,
        template.heroImageUrl,
        template.faviconUrl,
      ].filter(Boolean);

      for (const url of assetsToDelete) {
        try {
          const key = url!.split(".amazonaws.com/")[1];
          await s3Client.send(
            new DeleteObjectCommand({
              Bucket: BUCKET_NAME,
              Key: key,
            }),
          );
        } catch (error) {
          console.warn(`Failed to delete S3 asset: ${url}`, error);
        }
      }
    }

    // Delete database record
    await prisma.tenant_templates.delete({
      where: { id: tenantTemplateId },
    });

    console.log(`✓ Deleted template ${tenantTemplateId}`);
    return true;
  } catch (error) {
    console.error("Error deleting template:", error);
    throw error;
  }
}

/**
 * Get all templates for a tenant
 */
export async function getTenantTemplates(tenantId: string) {
  return prisma.tenant_templates.findMany({
    where: { tenantId },
    include: { baseTemplate: true },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get tenant's active template
 */
export async function getActiveTenantTemplate(tenantId: string) {
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    include: {
      activeTenantTemplate: {
        include: { baseTemplate: true },
      },
    },
  });

  return tenant?.activeTenantTemplate || null;
}

/**
 * Cleanup expired draft templates
 * Should be run periodically (e.g., via cron job)
 */
export async function cleanupExpiredDrafts() {
  const now = new Date();

  const expiredDrafts = await prisma.tenant_templates.findMany({
    where: {
      isDraft: true,
      expiresAt: { lte: now },
    },
  });

  for (const draft of expiredDrafts) {
    await deleteTenantTemplate(draft.id);
  }

  console.log(`✓ Cleaned up ${expiredDrafts.length} expired draft templates`);
  return expiredDrafts.length;
}
