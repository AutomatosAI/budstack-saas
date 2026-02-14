import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import fs from "fs/promises";
import path from "path";
import { createAuditLog, AUDIT_ACTIONS, getClientInfo } from "@/lib/audit-log";
import { uploadDirectoryToS3 } from "@/lib/s3";
import {
  downloadGitHubRepo,
  cleanupTempDir,
  type TemplateConfig,
} from "@/lib/template-utils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await currentUser();
    if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const template = await prisma.templates.findUnique({
      where: { id },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    // Accept githubUrl from request body, or fall back to stored metadata
    let body: { githubUrl?: string } = {};
    try {
      body = await req.json();
    } catch {
      // No body provided
    }

    const metadata = template.metadata as Record<string, any> | null;
    const githubUrl = body.githubUrl?.trim() || metadata?.githubUrl;

    if (!githubUrl) {
      return NextResponse.json(
        { error: "No GitHub URL provided or stored for this template" },
        { status: 400 },
      );
    }

    // Download from GitHub
    const extractPath = await downloadGitHubRepo(githubUrl);

    try {
      // Validate template.config.json exists
      const configPath = path.join(extractPath, "template.config.json");
      try {
        await fs.access(configPath);
      } catch {
        throw new Error("template.config.json not found in repository");
      }

      const configContent = await fs.readFile(configPath, "utf-8");
      const config: TemplateConfig = JSON.parse(configContent);

      // Copy to local filesystem
      const slug = template.slug || template.name;
      const templatesDir =
        process.env.NODE_ENV === "production"
          ? "/app/templates"
          : path.join(process.cwd(), "templates");
      const targetDir = path.join(templatesDir, slug);

      // Remove existing and copy new
      try {
        await fs.access(targetDir);
        await fs.rm(targetDir, { recursive: true, force: true });
      } catch {
        // Directory doesn't exist, fine
      }

      await fs.cp(extractPath, targetDir, { recursive: true });

      // Upload to S3
      try {
        const s3Prefix = `templates/${slug}/`;
        await uploadDirectoryToS3(targetDir, s3Prefix);
      } catch (s3Error: any) {
        console.error(
          `[Super Admin Update] S3 upload failed (non-fatal): ${s3Error.message}`,
        );
      }

      // Update database record — persist githubUrl in metadata for future updates
      const updatedMetadata = { ...(metadata || {}), githubUrl };
      await prisma.templates.update({
        where: { id },
        data: {
          version: config.version || template.version,
          description: config.description || template.description,
          metadata: updatedMetadata,
          updatedAt: new Date(),
        },
      });

      // Audit log
      const clientInfo = getClientInfo(req.headers);
      await createAuditLog({
        action: AUDIT_ACTIONS.TEMPLATE.UPDATED,
        entityType: "template",
        entityId: id,
        userId: user.id,
        userEmail: user.emailAddresses[0]?.emailAddress!,
        metadata: {
          action: "update-from-github",
          templateName: template.name,
          githubUrl,
        },
        ...clientInfo,
      });

      await cleanupTempDir(extractPath);

      return NextResponse.json({
        success: true,
        message: `Template "${template.name}" updated from GitHub`,
      });
    } catch (error: any) {
      await cleanupTempDir(extractPath);
      throw error;
    }
  } catch (error: any) {
    console.error("[Super Admin Update from GitHub] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update template" },
      { status: 500 },
    );
  }
}
