import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import fs from "fs/promises";
import path from "path";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import fetch from "node-fetch";
import AdmZip from "adm-zip";
import { randomUUID } from "crypto";
import { uploadDirectoryToS3 } from "@/lib/s3";
import { SECTION_REGISTRY } from "@/lib/section-registry";

interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  version: string;
  author?: string;
  preview_image?: string;
  features?: string[];
  performance?: { lighthouse_score?: number };
  accessibility?: { wcag_level?: string };
}

interface LayoutJson {
  version: string;
  navigation: string;
  sections: Array<{ type: string; id?: string; config?: any; visible?: boolean }>;
  footer: string;
  settings?: { wrapperClass?: string; googleFontsUrl?: string };
}

export async function POST(req: NextRequest) {
  try {
    const user = await currentUser();
    if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Super Admin access required" },
        { status: 401 },
      );
    }

    const body = await req.json();
    const { templateName, githubUrl } = body;

    if (!templateName || typeof templateName !== "string" || !templateName.trim()) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }

    if (!githubUrl || typeof githubUrl !== "string") {
      return NextResponse.json({ error: "GitHub URL is required" }, { status: 400 });
    }

    // Validate GitHub URL format
    const githubPattern = /^https:\/\/github\.com\/([\w-]+)\/([\w-]+)(\.git)?$/;
    const match = githubUrl.replace(/\.git$/, "").match(githubPattern);

    if (!match) {
      return NextResponse.json(
        { error: "Invalid GitHub URL format. Expected: https://github.com/username/repo" },
        { status: 400 },
      );
    }

    const [, owner, repo] = match;
    console.log(`[Template Upload] Downloading from GitHub: ${owner}/${repo}`);

    const tempDir = path.join("/tmp", `template-${Date.now()}`);
    const zipPath = path.join(tempDir, "repo.zip");
    await fs.mkdir(tempDir, { recursive: true });

    try {
      // Download repository as ZIP
      const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/main.zip`;
      const response = await fetch(zipUrl);
      if (!response.ok) {
        const masterUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/master.zip`;
        const masterResponse = await fetch(masterUrl);
        if (!masterResponse.ok) {
          throw new Error(`Failed to download repository. Status: ${response.status}`);
        }
        const buffer = await masterResponse.buffer();
        await fs.writeFile(zipPath, buffer);
      } else {
        const buffer = await response.buffer();
        await fs.writeFile(zipPath, buffer);
      }

      // Extract ZIP
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(tempDir, true);

      const extractedDirs = await fs.readdir(tempDir);
      const repoDir = extractedDirs.find((dir) => dir.startsWith(`${repo}-`));
      if (!repoDir) {
        throw new Error("Could not find extracted repository directory");
      }

      const extractPath = path.join(tempDir, repoDir);

      // Validate required files: layout.json, template.config.json, defaults.json
      const layoutPath = path.join(extractPath, "layout.json");
      const configPath = path.join(extractPath, "template.config.json");
      const defaultsPath = path.join(extractPath, "defaults.json");

      try {
        await fs.access(layoutPath);
      } catch {
        throw new Error("layout.json not found in repository root. Schema-driven templates require a layout.json file.");
      }

      try {
        await fs.access(configPath);
      } catch {
        throw new Error("template.config.json not found in repository root");
      }

      try {
        await fs.access(defaultsPath);
      } catch {
        throw new Error("defaults.json not found in repository root");
      }

      // Parse and validate layout.json against section registry
      const layoutContent = await fs.readFile(layoutPath, "utf-8");
      const layout: LayoutJson = JSON.parse(layoutContent);

      const validSectionTypes = Object.keys(SECTION_REGISTRY);
      const invalidTypes: string[] = [];

      // Validate navigation type
      if (!validSectionTypes.includes(layout.navigation)) {
        invalidTypes.push(`navigation: "${layout.navigation}"`);
      }

      // Validate footer type
      if (!validSectionTypes.includes(layout.footer)) {
        invalidTypes.push(`footer: "${layout.footer}"`);
      }

      // Validate section types
      for (const section of layout.sections) {
        if (!validSectionTypes.includes(section.type)) {
          invalidTypes.push(`section: "${section.type}"`);
        }
      }

      if (invalidTypes.length > 0) {
        throw new Error(
          `Invalid section types in layout.json: ${invalidTypes.join(", ")}. ` +
          `Valid types are: ${validSectionTypes.join(", ")}`,
        );
      }

      // Parse config
      const configContent = await fs.readFile(configPath, "utf-8");
      const config: TemplateConfig = JSON.parse(configContent);

      // Generate slug from user-provided template name
      const generateSlug = (name: string): string => {
        return name
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9\s-]/g, "")
          .replace(/\s+/g, "-")
          .replace(/-+/g, "-")
          .replace(/^-|-$/g, "");
      };

      const slug = generateSlug(templateName.trim());
      config.name = templateName.trim();
      config.id = slug;

      if (!config.id) {
        throw new Error("Generated slug is empty. Please provide a valid template name.");
      }

      // Check if template already exists
      const existingTemplate = await prisma.templates.findUnique({
        where: { slug: config.id },
      });

      if (existingTemplate) {
        throw new Error(
          `Template with slug '${config.id}' already exists. Please delete it first or use a different slug.`,
        );
      }

      // Upload to S3 only (no local filesystem copy)
      console.log(`[Template Upload] Uploading template to S3...`);
      const s3Prefix = `templates/${config.id}/`;
      await uploadDirectoryToS3(extractPath, s3Prefix);
      console.log(`[Template Upload] Template uploaded to S3: ${s3Prefix}`);

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
          layoutFilePath: `templates/${config.id}/layout.json`,
          stylesPath: `templates/${config.id}/styles.css`,
          previewUrl: config.preview_image || "",
          thumbnailUrl: config.preview_image || "",
          updatedAt: new Date(),
          metadata: {
            features: config.features || [],
            performance: config.performance || {},
            accessibility: config.accessibility || {},
            schemaVersion: layout.version,
          },
        },
      });

      console.log(`[Template Upload] Template created in database: ID ${template.id}`);

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
          sectionCount: layout.sections.length,
        },
        ipAddress: clientInfo.ipAddress,
        userAgent: clientInfo.userAgent,
      });

      // Clean up temp directory
      await fs.rm(tempDir, { recursive: true, force: true });

      return NextResponse.json({
        success: true,
        message: "Template uploaded successfully. No rebuild required — templates are loaded at runtime.",
        template: {
          id: template.id,
          slug: template.slug,
          name: template.name,
        },
        requiresRebuild: false,
      });
    } catch (uploadError: any) {
      console.error("[Template Upload] Upload error:", uploadError.message);
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
