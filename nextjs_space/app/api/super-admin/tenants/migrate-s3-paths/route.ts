import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { copyS3Directory } from "@/lib/s3";

/**
 * Migration endpoint: copies tenant S3 files from old timestamp-based paths
 * to new slug-based paths (tenants/{id}/templates/{slug}/) and updates DB.
 *
 * Non-destructive — old S3 files are NOT deleted.
 *
 * POST /api/super-admin/tenants/migrate-s3-paths
 * Body: { tenantId?: string, dryRun?: boolean }
 *   - tenantId: migrate a single tenant (optional — omit to migrate all)
 *   - dryRun: if true, just report what would change without copying/updating
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const targetTenantId = body.tenantId || null;
    const dryRun = body.dryRun === true;

    // Find all tenant_templates that have an s3Path
    const whereClause: any = {
      s3Path: { not: null },
    };
    if (targetTenantId) {
      whereClause.tenantId = targetTenantId;
    }

    const tenantTemplates = await prisma.tenant_templates.findMany({
      where: whereClause,
      include: { templates: true, tenant: true },
    });

    const results: Array<{
      tenantTemplateId: string;
      tenantName: string;
      oldPath: string;
      newPath: string;
      status: string;
      filesCopied?: number;
    }> = [];

    for (const tt of tenantTemplates) {
      const oldPath = tt.s3Path!;
      const slug = tt.templates?.slug || tt.templateName?.toLowerCase().replace(/\s+/g, '-') || tt.id;
      const newPath = `tenants/${tt.tenantId}/templates/${slug}`;

      // Skip if already in the correct format
      if (oldPath === newPath) {
        results.push({
          tenantTemplateId: tt.id,
          tenantName: (tt.tenant as any)?.businessName || "Unknown",
          oldPath,
          newPath,
          status: "ALREADY_MIGRATED",
        });
        continue;
      }

      if (dryRun) {
        results.push({
          tenantTemplateId: tt.id,
          tenantName: (tt.tenant as any)?.businessName || "Unknown",
          oldPath,
          newPath,
          status: "WOULD_MIGRATE",
        });
        continue;
      }

      // Copy files from old path to new path
      try {
        const filesCopied = await copyS3Directory(`${oldPath}/`, `${newPath}/`);

        // Update DB to point to new path
        await prisma.tenant_templates.update({
          where: { id: tt.id },
          data: { s3Path: newPath },
        });

        // Update logoUrl and heroImageUrl if they reference the old path
        const updates: Record<string, string> = {};
        if (tt.logoUrl && tt.logoUrl.includes(oldPath)) {
          updates.logoUrl = tt.logoUrl.replace(oldPath, newPath);
        }
        if (tt.heroImageUrl && tt.heroImageUrl.includes(oldPath)) {
          updates.heroImageUrl = tt.heroImageUrl.replace(oldPath, newPath);
        }
        if (Object.keys(updates).length > 0) {
          await prisma.tenant_templates.update({
            where: { id: tt.id },
            data: updates,
          });
        }

        results.push({
          tenantTemplateId: tt.id,
          tenantName: (tt.tenant as any)?.businessName || "Unknown",
          oldPath,
          newPath,
          status: "MIGRATED",
          filesCopied,
        });

        console.log(`[migrate] ${(tt.tenant as any)?.businessName}: ${oldPath} → ${newPath} (${filesCopied} files)`);
      } catch (err) {
        results.push({
          tenantTemplateId: tt.id,
          tenantName: (tt.tenant as any)?.businessName || "Unknown",
          oldPath,
          newPath,
          status: `ERROR: ${err instanceof Error ? err.message : "Unknown error"}`,
        });
        console.error(`[migrate] Failed for ${tt.id}:`, err);
      }
    }

    const migrated = results.filter(r => r.status === "MIGRATED").length;
    const alreadyDone = results.filter(r => r.status === "ALREADY_MIGRATED").length;
    const errors = results.filter(r => r.status.startsWith("ERROR")).length;

    return NextResponse.json({
      success: true,
      dryRun,
      summary: {
        total: results.length,
        migrated,
        alreadyDone,
        errors,
      },
      results,
    });
  } catch (error) {
    console.error("[migrate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
