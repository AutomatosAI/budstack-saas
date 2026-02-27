import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { deleteS3Directory } from "@/lib/s3";

/**
 * ONE-TIME CLEANUP ROUTE — DELETE AFTER USE
 *
 * POST /api/super-admin/tenants/reset-templates?subdomain=healingbuds
 *
 * Deletes all tenant_templates, clears their S3 files,
 * and resets activeTenantTemplateId so you can re-clone fresh.
 */
// Support both GET (browser URL bar) and POST
export async function GET(req: NextRequest) {
  return handleReset(req);
}

export async function POST(req: NextRequest) {
  return handleReset(req);
}

async function handleReset(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized — SUPER_ADMIN only" }, { status: 401 });
    }

    const subdomain = req.nextUrl.searchParams.get("subdomain");
    if (!subdomain) {
      return NextResponse.json({ error: "?subdomain= is required" }, { status: 400 });
    }

    const tenant = await prisma.tenants.findUnique({
      where: { subdomain },
      include: {
        tenantTemplates: true,
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: `Tenant '${subdomain}' not found` }, { status: 404 });
    }

    const results: string[] = [];

    // 1. Clear activeTenantTemplateId first (FK constraint)
    if (tenant.activeTenantTemplateId) {
      await prisma.tenants.update({
        where: { id: tenant.id },
        data: { activeTenantTemplateId: null },
      });
      results.push(`Cleared activeTenantTemplateId (was: ${tenant.activeTenantTemplateId})`);
    }

    // 2. Delete S3 files for each tenant template
    for (const tt of tenant.tenantTemplates) {
      if (tt.s3Path) {
        try {
          const count = await deleteS3Directory(`${tt.s3Path}/`);
          results.push(`S3: deleted ${count} objects at ${tt.s3Path}/`);
        } catch (err) {
          results.push(`S3: FAILED to delete ${tt.s3Path}/ — ${err}`);
        }
      }

      // Also delete individually uploaded assets (logo, hero, favicon)
      // These are in the uploads/ prefix, not the template s3Path
      for (const url of [tt.logoUrl, tt.heroImageUrl, tt.faviconUrl].filter(Boolean)) {
        if (url && url.startsWith("uploads/")) {
          try {
            const { createS3Client, getBucketConfig } = await import("@/lib/aws-config");
            const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
            const s3 = await createS3Client();
            const { bucketName } = await getBucketConfig();
            await s3.send(new DeleteObjectCommand({ Bucket: bucketName, Key: url }));
            results.push(`S3: deleted asset ${url}`);
          } catch (err) {
            results.push(`S3: FAILED to delete asset ${url} — ${err}`);
          }
        }
      }
    }

    // 3. Delete all tenant_templates from DB
    const deleted = await prisma.tenant_templates.deleteMany({
      where: { tenantId: tenant.id },
    });
    results.push(`DB: deleted ${deleted.count} tenant_templates`);

    return NextResponse.json({
      success: true,
      tenant: { id: tenant.id, subdomain, businessName: tenant.businessName },
      results,
    });
  } catch (error) {
    console.error("[reset-templates] Error:", error);
    return NextResponse.json(
      { error: "Reset failed", message: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
