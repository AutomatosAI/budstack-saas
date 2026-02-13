/**
 * Tenant Template Upload Service
 *
 * Handles uploading custom templates from GitHub repos to a tenant's private S3 space.
 * Also handles re-downloading from GitHub to update an existing custom template.
 */

import { prisma } from "./db";
import { uploadDirectoryToS3 } from "./s3";
import { getBucketConfig } from "./aws-config";
import {
  downloadGitHubRepo,
  validateTemplateFiles,
  generateSlug,
  cleanupTempDir,
} from "./template-utils";
import fs from "fs/promises";
import path from "path";

/**
 * Upload a template from a GitHub repo to a tenant's private S3 space.
 * Downloads the repo, validates template files, uploads to S3, and creates a DB record.
 */
export async function uploadFromGitHub(
  tenantId: string,
  templateName: string,
  githubUrl: string,
  branch?: string,
) {
  const slug = generateSlug(templateName.trim());
  if (!slug) {
    throw new Error("Generated slug is empty. Please provide a valid template name.");
  }

  // Check slug uniqueness within this tenant's custom templates
  const existing = await prisma.tenant_templates.findFirst({
    where: {
      tenantId,
      templateName: { equals: templateName.trim(), mode: "insensitive" },
      source: "custom",
    },
  });

  if (existing) {
    throw new Error(
      `You already have a custom template named "${templateName}". Please use a different name.`,
    );
  }

  // Need a base template record to satisfy the foreign key — find or create a "custom-base" placeholder
  let customBase = await prisma.templates.findUnique({
    where: { slug: "custom-base" },
  });
  if (!customBase) {
    customBase = await prisma.templates.create({
      data: {
        name: "Custom Base",
        slug: "custom-base",
        description: "Placeholder base template for custom tenant uploads",
        category: "system",
        sourceType: "SYSTEM",
        isActive: false,
        isPublic: false,
        updatedAt: new Date(),
      },
    });
  }

  // Download and extract the GitHub repo
  const extractPath = await downloadGitHubRepo(githubUrl, branch);

  try {
    // Validate template files
    const validation = await validateTemplateFiles(extractPath);
    if (!validation.valid) {
      throw new Error(
        `Template validation failed:\n${validation.errors.join("\n")}`,
      );
    }

    // Read defaults.json to seed DB fields
    let defaults: {
      designSystem?: Record<string, unknown>;
      pageContent?: Record<string, unknown>;
      navigation?: Record<string, unknown>;
      footer?: Record<string, unknown>;
    } = {};
    try {
      const defaultsContent = await fs.readFile(
        path.join(extractPath, "defaults.json"),
        "utf-8",
      );
      defaults = JSON.parse(defaultsContent);
    } catch {
      defaults = { designSystem: {}, pageContent: {}, navigation: {}, footer: {} };
    }

    // Upload to tenant's private S3 space
    const { folderPrefix } = await getBucketConfig();
    const s3Path = `${folderPrefix}tenants/${tenantId}/custom-templates/${slug}`;
    await uploadDirectoryToS3(extractPath, `${s3Path}/`);

    // Create TenantTemplate record
    const tenantTemplate = await prisma.tenant_templates.create({
      data: {
        tenantId,
        baseTemplateId: customBase.id,
        templateName: templateName.trim(),
        s3Path,
        designSystem: defaults.designSystem || {},
        pageContent: defaults.pageContent || {},
        navigation: defaults.navigation || {},
        footer: defaults.footer || {},
        source: "custom",
        githubUrl,
        isDraft: true,
        isActive: false,
      },
    });

    await cleanupTempDir(extractPath);
    return tenantTemplate;
  } catch (error) {
    await cleanupTempDir(extractPath);
    throw error;
  }
}

/**
 * Re-download and update an existing custom template from its stored GitHub URL.
 * Overwrites S3 files and refreshes DB fields from the new defaults.json.
 */
export async function updateFromGitHub(tenantTemplateId: string) {
  const tenantTemplate = await prisma.tenant_templates.findUnique({
    where: { id: tenantTemplateId },
  });

  if (!tenantTemplate) {
    throw new Error("Tenant template not found");
  }

  if (tenantTemplate.source !== "custom") {
    throw new Error("Only custom templates can be updated from GitHub");
  }

  if (!tenantTemplate.githubUrl) {
    throw new Error("No GitHub URL stored for this template");
  }

  const extractPath = await downloadGitHubRepo(tenantTemplate.githubUrl);

  try {
    const validation = await validateTemplateFiles(extractPath);
    if (!validation.valid) {
      throw new Error(
        `Template validation failed:\n${validation.errors.join("\n")}`,
      );
    }

    // Read new defaults.json
    let defaults: {
      designSystem?: Record<string, unknown>;
      pageContent?: Record<string, unknown>;
      navigation?: Record<string, unknown>;
      footer?: Record<string, unknown>;
    } = {};
    try {
      const defaultsContent = await fs.readFile(
        path.join(extractPath, "defaults.json"),
        "utf-8",
      );
      defaults = JSON.parse(defaultsContent);
    } catch {
      defaults = { designSystem: {}, pageContent: {}, navigation: {}, footer: {} };
    }

    // Overwrite S3 files
    const s3Path = tenantTemplate.s3Path!;
    await uploadDirectoryToS3(extractPath, `${s3Path}/`);

    // Update DB fields from fresh defaults
    const updated = await prisma.tenant_templates.update({
      where: { id: tenantTemplateId },
      data: {
        designSystem: defaults.designSystem || {},
        pageContent: defaults.pageContent || {},
        navigation: defaults.navigation || {},
        footer: defaults.footer || {},
      },
    });

    await cleanupTempDir(extractPath);
    return updated;
  } catch (error) {
    await cleanupTempDir(extractPath);
    throw error;
  }
}
