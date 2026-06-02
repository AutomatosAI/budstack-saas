import { NextResponse } from "next/server";
import { z } from "zod";
import { withSuperAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import fs from "fs/promises";
import path from "path";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { convertLovableTemplate } from "@/lib/lovable-converter";
import { randomUUID } from "crypto";
import { uploadDirectoryToS3 } from "@/lib/storage/s3";
import { apiError, apiValidationError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";
import {
  downloadGitHubRepo,
  generateSlug,
  cleanupTempDir,
  type TemplateConfig,
} from "@/lib/templates/template-utils";

const uploadTemplateSchema = z
  .object({
    templateName: z.string().min(1).max(200),
    githubUrl: z.string().min(1).max(500),
    structureType: z.enum(["default", "lovable"]).optional(),
    branch: z.string().max(200).optional(),
  })
  .strict();

export const POST = withSuperAdmin(async (req, { user }) => {
  try {
    const { templateName, githubUrl, structureType = "default", branch } =
      await parseJsonBody(req, uploadTemplateSchema);

    console.log(`[Template Upload] Structure type: ${structureType}`);

    // Download and extract repository using shared utility
    let extractPath: string;
    try {
      extractPath = await downloadGitHubRepo(githubUrl, branch);
    } catch (dlError: any) {
      return apiValidationError(
        dlError.message,
        "POST /api/super-admin/templates/upload",
      );
    }

    try {

      // Convert Lovable template if needed
      if (structureType === "lovable") {
        console.log(
          "[Template Upload] Converting Lovable template to BudStacks format...",
        );
        const conversionResult = await convertLovableTemplate(extractPath);

        if (!conversionResult.success) {
          throw new Error(
            `Lovable conversion failed: ${conversionResult.error}`,
          );
        }

        console.log(
          `[Template Upload] Conversion successful: ${conversionResult.message}`,
        );
      }

      // Read and validate template.config.json
      const configPath = path.join(extractPath, "template.config.json");
      let configExists = false;
      try {
        await fs.access(configPath);
        configExists = true;
      } catch {
        console.log("[Template Upload] template.config.json not found");
      }

      if (!configExists) {
        throw new Error("template.config.json not found in repository root");
      }

      const configContent = await fs.readFile(configPath, "utf-8");

      // Guard against non-JSON config files (e.g. XML error pages saved as .json)
      const trimmedConfig = configContent.trimStart();
      if (trimmedConfig.startsWith("<?xml") || trimmedConfig.startsWith("<")) {
        throw new Error(
          "template.config.json contains XML/HTML instead of JSON. Check that the GitHub repo is public and the file is valid JSON.",
        );
      }

      let config: TemplateConfig;
      try {
        config = JSON.parse(configContent);
      } catch (parseError: any) {
        throw new Error(
          `Invalid template.config.json: ${parseError.message}. Content starts with: ${configContent.substring(0, 80)}`,
        );
      }

      const userProvidedSlug = generateSlug(templateName.trim());

      // Override config with user-provided values
      config.name = templateName.trim();
      config.id = userProvidedSlug;

      // Validate generated slug
      if (!config.id) {
        throw new Error(
          "Generated slug is empty. Please provide a valid template name.",
        );
      }

      console.log(`[Template Upload] Template: ${config.name} (${config.id})`);

      // Check if template already exists — update instead of failing
      const existingTemplate = await prisma.templates.findUnique({
        where: { slug: config.id },
      });

      // Copy template files to project
      // In production standalone mode, process.cwd() = /app/app/ but templates live at /app/templates/
      // Use /app/templates in production, process.cwd()/templates in development
      const templatesDir = process.env.NODE_ENV === "production"
        ? "/app/templates"
        : path.join(process.cwd(), "templates");
      const targetDir = path.join(templatesDir, config.id);

      // Check if target directory exists
      let targetExists = false;
      try {
        await fs.access(targetDir);
        targetExists = true;
      } catch {
        // Directory doesn't exist, which is fine
      }

      if (targetExists) {
        console.log(
          `[Template Upload] Removing existing directory: ${targetDir}`,
        );
        await fs.rm(targetDir, { recursive: true, force: true });
      }

      console.log(`[Template Upload] Copying files to: ${targetDir}`);
      await fs.cp(extractPath, targetDir, { recursive: true });

      // Upload template files to S3 — required for all reads
      console.log(`[Template Upload] Uploading template to S3...`);
      const s3Prefix = `templates/${config.id}/`;
      try {
        const uploadCount = await uploadDirectoryToS3(targetDir, s3Prefix);
        console.log(`[Template Upload] Uploaded ${uploadCount} files to S3: ${s3Prefix}`);
      } catch (s3Error: any) {
        console.error(
          `[Template Upload] S3 upload failed: ${s3Error.message}`,
        );
        throw new Error(`S3 upload failed: ${s3Error.message}. Check AWS credentials and bucket configuration.`);
      }

      const metadataPayload = {
        features: config.features || [],
        performance: config.performance || {},
        accessibility: config.accessibility || {},
        compatibility: config.compatibility || {},
        installation: config.installation || {},
        githubUrl,
      };

      let template;
      if (existingTemplate) {
        // Update existing template — re-upload overwrites files + stores githubUrl
        console.log(`[Template Upload] Template '${config.id}' exists, updating...`);
        template = await prisma.templates.update({
          where: { id: existingTemplate.id },
          data: {
            name: config.name,
            description: config.description,
            category: config.category || existingTemplate.category,
            tags: config.tags || existingTemplate.tags,
            version: config.version || existingTemplate.version,
            author: config.author || existingTemplate.author,
            layoutFilePath: `/templates/${config.id}/index.tsx`,
            componentsPath: `/templates/${config.id}/components`,
            stylesPath: `/templates/${config.id}/styles.css`,
            packagePath: `/templates/${config.id}/package.json`,
            previewUrl: config.preview_image || existingTemplate.previewUrl,
            thumbnailUrl: config.preview_image || existingTemplate.thumbnailUrl,
            metadata: metadataPayload,
            updatedAt: new Date(),
          },
        });
        console.log(`[Template Upload] Template updated: ID ${template.id}`);
      } else {
        // Create new template
        template = await prisma.templates.create({
          data: {
            id: randomUUID(),
            slug: config.id,
            name: config.name,
            description: config.description,
            category: config.category || "general",
            tags: config.tags || [],
            version: config.version || "1.0.0",
            author: config.author || "Unknown",
            isActive: true,
            isPremium: false,
            price: 0,
            layoutFilePath: `/templates/${config.id}/index.tsx`,
            componentsPath: `/templates/${config.id}/components`,
            stylesPath: `/templates/${config.id}/styles.css`,
            packagePath: `/templates/${config.id}/package.json`,
            previewUrl: config.preview_image || "",
            thumbnailUrl: config.preview_image || "",
            updatedAt: new Date(),
            metadata: metadataPayload,
          },
        });
        console.log(`[Template Upload] Template created: ID ${template.id}`);
      }

      // Create audit log
      const clientInfo = getClientInfo(req.headers);
      await createAuditLog({
        action: AUDIT_ACTIONS.TEMPLATE.CREATED,
        entityType: "template",
        entityId: template.id,
        userId: user.id,
        userEmail: user.email!,
        metadata: {
          templateSlug: config.id,
          templateName: config.name,
          githubUrl,
          structureType,
          converted: structureType === "lovable",
        },
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
      });

      // Clean up temp directory
      console.log("[Template Upload] Cleaning up temporary files...");
      await cleanupTempDir(extractPath);

      // Auto-sync template registry
      console.log("[Template Upload] Syncing template registry...");
      try {
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);

        // In production, scripts live at /app/scripts/ (not /app/app/scripts/)
        const scriptsBase = process.env.NODE_ENV === "production" ? "/app" : process.cwd();
        await execAsync("npx tsx scripts/sync-template-registry.ts", {
          cwd: scriptsBase,
        });
        console.log("[Template Upload] Template registry synced successfully");
      } catch (syncError: any) {
        console.error(
          "[Template Upload] Registry sync failed (non-fatal):",
          syncError.message,
        );
        // Continue even if sync fails - template is uploaded, just needs manual registry update
      }

      return NextResponse.json({
        success: true,
        message:
          "Template uploaded successfully. Registry updated - rebuild required to activate.",
        template: {
          id: template.id,
          slug: template.slug,
          name: template.name,
        },
        requiresRebuild: true,
      });
    } catch (uploadError: any) {
      console.error("[Template Upload] Upload error:", uploadError.message);
      await cleanupTempDir(extractPath);
      throw uploadError;
    }
  } catch (error: any) {
    return apiError(error, {
      route: "POST /api/super-admin/templates/upload",
      safeMessage: "Failed to upload template",
    });
  }
});
