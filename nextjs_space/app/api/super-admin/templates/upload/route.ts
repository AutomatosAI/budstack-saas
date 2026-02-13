import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import fs from "fs/promises";
import path from "path";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import fetch from "node-fetch";
import AdmZip from "adm-zip";
import { convertLovableTemplate } from "@/lib/lovable-converter";
import { randomUUID } from "crypto";
import { uploadDirectoryToS3 } from "@/lib/s3";

interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  version: string;
  author?: string;
  preview_image?: string;
  compatibility?: {
    platform?: string;
    nextjs?: string;
    features?: string[];
  };
  features?: string[];
  performance?: {
    lighthouse_score?: number;
  };
  accessibility?: {
    wcag_level?: string;
  };
  installation?: {
    steps?: string[];
  };
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const user = await currentUser();
    if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Super Admin access required" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { templateName, githubUrl, structureType = "default", branch } = body;

    if (
      !templateName ||
      typeof templateName !== "string" ||
      !templateName.trim()
    ) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 },
      );
    }

    if (!githubUrl || typeof githubUrl !== "string") {
      return NextResponse.json(
        { error: "GitHub URL is required" },
        { status: 400 },
      );
    }

    if (structureType !== "default" && structureType !== "lovable") {
      return NextResponse.json(
        { error: 'Invalid structure type. Must be "default" or "lovable"' },
        { status: 400 },
      );
    }

    console.log(`[Template Upload] Structure type: ${structureType}`);

    // Validate GitHub URL format
    const githubPattern = /^https:\/\/github\.com\/([\w-]+)\/([\w-]+)(\.git)?$/;
    const match = githubUrl.replace(/\.git$/, "").match(githubPattern);

    if (!match) {
      return NextResponse.json(
        {
          error:
            "Invalid GitHub URL format. Expected: https://github.com/username/repo",
        },
        { status: 400 },
      );
    }

    const [, owner, repo] = match;
    console.log(`[Template Upload] Downloading from GitHub: ${owner}/${repo}`);

    // Create temporary directory for download
    const tempDir = path.join("/tmp", `template-${Date.now()}`);
    const zipPath = path.join(tempDir, "repo.zip");
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Download repository as ZIP — try branches in order of priority
      const branchesToTry = [
        ...(branch ? [branch] : []),
        "main",
        "master",
      ];

      let downloaded = false;
      let usedBranch = "";

      for (const branchName of branchesToTry) {
        const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${branchName}.zip`;
        console.log(`[Template Upload] Trying branch '${branchName}': ${zipUrl}`);

        const response = await fetch(zipUrl);
        if (response.ok) {
          const buffer = await response.buffer();
          await fs.writeFile(zipPath, buffer);
          downloaded = true;
          usedBranch = branchName;
          break;
        }
      }

      if (!downloaded) {
        throw new Error(
          `Failed to download repository. Tried branches: ${branchesToTry.join(", ")}`,
        );
      }

      console.log(`[Template Upload] ZIP downloaded from branch '${usedBranch}'`);

      // Extract ZIP
      console.log("[Template Upload] Extracting ZIP...");
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(tempDir, true);

      // Find the extracted folder (GitHub adds repo-name-branch format)
      const extractedDirs = await fs.readdir(tempDir);
      const repoDir = extractedDirs.find((dir) => dir.startsWith(`${repo}-`));

      if (!repoDir) {
        throw new Error("Could not find extracted repository directory");
      }

      const extractPath = path.join(tempDir, repoDir);
      console.log(`[Template Upload] Extracted to: ${extractPath}`);

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
      const config: TemplateConfig = JSON.parse(configContent);

      // Generate slug from user-provided template name
      const generateSlug = (name: string): string => {
        return name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "") // Remove special characters
          .replace(/\s+/g, "-") // Replace spaces with hyphens
          .replace(/-+/g, "-") // Remove consecutive hyphens
          .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
      };

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

      // Check if template already exists
      const existingTemplate = await prisma.templates.findUnique({
        where: { slug: config.id },
      });

      if (existingTemplate) {
        throw new Error(
          `Template with slug '${config.id}' already exists. Please delete it first or use a different slug.`,
        );
      }

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

      // Upload template files to S3 for persistence
      console.log(`[Template Upload] Uploading template to S3...`);
      try {
        const s3Prefix = `templates/${config.id}/`;
        await uploadDirectoryToS3(targetDir, s3Prefix);
        console.log(`[Template Upload] Template uploaded to S3: ${s3Prefix}`);
      } catch (s3Error: any) {
        console.error(
          `[Template Upload] S3 upload failed (non-fatal): ${s3Error.message}`,
        );
        // Continue - template is in local filesystem, S3 is for persistence only
      }

      // Create database record
      const template = await prisma.templates.create({
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
          metadata: {
            features: config.features || [],
            performance: config.performance || {},
            accessibility: config.accessibility || {},
            compatibility: config.compatibility || {},
            installation: config.installation || {},
          },
        },
      });

      console.log(
        `[Template Upload] Template created in database: ID ${template.id}`,
      );

      // Create audit log
      const clientInfo = getClientInfo(req.headers);
      await createAuditLog({
        action: AUDIT_ACTIONS.TEMPLATE.CREATED,
        entityType: "template",
        entityId: template.id,
        userId: user.id,
        userEmail: user.emailAddresses[0]?.emailAddress!,
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
      await fs.rm(tempDir, { recursive: true, force: true });

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

      // Clean up on error
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }

      throw uploadError;
    }
  } catch (error: any) {
    console.error("[Template Upload] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to upload template",
        details: error.message || "Unknown error",
      },
      { status: 500 },
    );
  }
}
