import { NextResponse } from "next/server";
import { z } from "zod";
import { withSuperAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { copyS3Directory, getJsonFromS3 } from "@/lib/s3";
import { apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";

const migrateS3Schema = z
  .object({
    tenantId: z.string().max(200).optional().nullable(),
    dryRun: z.boolean().optional(),
    backfill: z.boolean().optional(),
  })
  .strict();

/**
 * Migration endpoint with two modes:
 *
 * 1. PATH MIGRATION (default): copies tenant S3 files from old timestamp-based
 *    paths to new slug-based paths and updates DB.
 *
 * 2. BACKFILL: copies missing base template files (defaults.json, styles.css,
 *    assets/) to tenant paths that are incomplete. Preserves tenant's layout.json.
 *
 * POST /api/super-admin/tenants/migrate-s3-paths
 * Body: { tenantId?: string, dryRun?: boolean, backfill?: boolean }
 */
export const POST = withSuperAdmin(async (req) => {
  try {
    const body = (await parseJsonBody(req, migrateS3Schema.optional())) ?? {};
    const targetTenantId = body.tenantId || null;
    const dryRun = body.dryRun === true;
    const backfill = body.backfill === true;

    // ─── BACKFILL MODE ───
    // Copies base template files to tenant paths that are missing defaults.json/styles.css/assets.
    // Preserves tenant's customized layout.json by saving it first, then restoring after copy.
    if (backfill) {
      const whereClause: any = { s3Path: { not: null } };
      if (targetTenantId) whereClause.tenantId = targetTenantId;

      const tenantTemplates = await prisma.tenant_templates.findMany({
        where: whereClause,
        include: { templates: true, tenant: true },
      });

      const results: Array<{ tenantName: string; s3Path: string; baseTemplate: string; status: string; filesCopied?: number }> = [];

      for (const tt of tenantTemplates) {
        const tenantPath = tt.s3Path!;
        const baseSlug = tt.templates?.slug;
        const tenantName = (tt.tenant as any)?.businessName || "Unknown";

        if (!baseSlug) {
          results.push({ tenantName, s3Path: tenantPath, baseTemplate: "NONE", status: "SKIPPED_NO_BASE" });
          continue;
        }

        // Check if defaults.json exists at tenant path
        let hasDefaults = false;
        try {
          const d = await getJsonFromS3(`${tenantPath}/defaults.json`);
          hasDefaults = !!d;
        } catch { /* missing */ }

        if (hasDefaults) {
          results.push({ tenantName, s3Path: tenantPath, baseTemplate: baseSlug, status: "ALREADY_COMPLETE" });
          continue;
        }

        if (dryRun) {
          results.push({ tenantName, s3Path: tenantPath, baseTemplate: baseSlug, status: "WOULD_BACKFILL" });
          continue;
        }

        try {
          // 1. Save tenant's layout.json before overwrite
          let tenantLayout: any = null;
          try {
            tenantLayout = await getJsonFromS3(`${tenantPath}/layout.json`);
          } catch { /* no layout yet */ }

          // 2. Copy ALL base template files to tenant path
          const basePrefix = `templates/${baseSlug}/`;
          const filesCopied = await copyS3Directory(basePrefix, `${tenantPath}/`);

          // 3. Restore tenant's layout.json (their customizations win)
          if (tenantLayout) {
            const { createS3Client, getBucketConfig } = await import("@/lib/aws-config");
            const { PutObjectCommand } = await import("@aws-sdk/client-s3");
            const s3 = await createS3Client();
            const { bucketName } = await getBucketConfig();
            await s3.send(new PutObjectCommand({
              Bucket: bucketName,
              Key: `${tenantPath}/layout.json`,
              Body: Buffer.from(JSON.stringify(tenantLayout, null, 2)),
              ContentType: "application/json",
            }));
          }

          // 4. Seed DB fields from defaults.json if not already set
          try {
            const defaults = await getJsonFromS3<any>(`${tenantPath}/defaults.json`);
            if (defaults) {
              const updates: Record<string, any> = {};
              if (!tt.logoUrl && defaults.logoPath) {
                const lp = defaults.logoPath;
                const isAbsLogo = lp.startsWith('development/') || lp.startsWith('tenants/') || lp.startsWith('templates/');
                updates.logoUrl = isAbsLogo ? lp : `${tenantPath}/${lp}`;
              }
              if (!tt.heroImageUrl && defaults.heroImagePath) {
                const hp = defaults.heroImagePath;
                const isAbsHero = hp.startsWith('development/') || hp.startsWith('tenants/') || hp.startsWith('templates/');
                updates.heroImageUrl = isAbsHero ? hp : `${tenantPath}/${hp}`;
              }
              if (Object.keys(updates).length > 0) {
                await prisma.tenant_templates.update({ where: { id: tt.id }, data: updates });
              }
            }
          } catch { /* optional */ }

          results.push({ tenantName, s3Path: tenantPath, baseTemplate: baseSlug, status: "BACKFILLED", filesCopied });
          console.log(`[backfill] ${tenantName}: copied ${filesCopied} files from templates/${baseSlug}/ to ${tenantPath}/`);
        } catch (err) {
          results.push({ tenantName, s3Path: tenantPath, baseTemplate: baseSlug, status: `ERROR: ${err instanceof Error ? err.message : "Unknown"}` });
          console.error(`[backfill] Failed for ${tenantName}:`, err);
        }
      }

      return NextResponse.json({ success: true, dryRun, backfill: true, results });
    }

    // ─── PATH MIGRATION MODE ───
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
    return apiError(error, {
      route: "POST /api/super-admin/tenants/migrate-s3-paths",
      safeMessage: "Migration failed",
    });
  }
});
