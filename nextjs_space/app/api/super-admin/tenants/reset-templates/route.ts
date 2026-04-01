import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * ONE-TIME CLEANUP ROUTE — DELETE AFTER USE
 * GET /api/super-admin/tenants/reset-templates?subdomain=healingbuds&confirm=yes
 */
export async function GET(req: NextRequest) {
  const steps: string[] = [];

  try {
    // Step 1: Auth
    steps.push("Starting auth check...");
    let user: any;
    try {
      const { getCurrentUser } = await import("@/lib/auth-helper");
      user = await getCurrentUser();
      steps.push(`Auth: ${user ? `${user.role} (${user.email})` : "no user"}`);
    } catch (authErr) {
      steps.push(`Auth FAILED: ${authErr}`);
      return NextResponse.json({ steps }, { status: 500 });
    }

    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized", steps }, { status: 401 });
    }

    // Step 2: Parse params
    const subdomain = req.nextUrl.searchParams.get("subdomain");
    const confirm = req.nextUrl.searchParams.get("confirm");
    if (!subdomain) {
      return NextResponse.json({
        error: "Add ?subdomain=healingbuds&confirm=yes",
        steps,
      }, { status: 400 });
    }

    // Step 3: Find tenant
    steps.push("Finding tenant...");
    const { prisma } = await import("@/lib/db");
    const tenant = await prisma.tenants.findUnique({
      where: { subdomain },
    });

    if (!tenant) {
      return NextResponse.json({ error: `Tenant '${subdomain}' not found`, steps }, { status: 404 });
    }

    // Step 4: Find templates
    const templates = await prisma.tenant_templates.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, templateName: true, s3Path: true, source: true, logoUrl: true, heroImageUrl: true, faviconUrl: true },
    });
    steps.push(`Found ${templates.length} templates: ${templates.map((t: any) => `${t.templateName} (${t.s3Path})`).join(", ")}`);
    steps.push(`Active template ID: ${tenant.activeTenantTemplateId || "none"}`);

    // Dry run unless confirm=yes
    if (confirm !== "yes") {
      return NextResponse.json({
        message: "DRY RUN — add &confirm=yes to actually delete",
        tenant: { id: tenant.id, subdomain, businessName: tenant.businessName },
        templates,
        steps,
      });
    }

    // Step 5: Clear active template FK
    if (tenant.activeTenantTemplateId) {
      await prisma.tenants.update({
        where: { id: tenant.id },
        data: { activeTenantTemplateId: null },
      });
      steps.push(`Cleared activeTenantTemplateId (was ${tenant.activeTenantTemplateId})`);
    }

    // Step 6: Delete S3 files
    for (const tt of templates) {
      if (tt.s3Path) {
        try {
          const { deleteS3Directory } = await import("@/lib/s3");
          const count = await deleteS3Directory(`${tt.s3Path}/`);
          steps.push(`S3: deleted ${count} objects at ${tt.s3Path}/`);
        } catch (err) {
          steps.push(`S3: FAILED ${tt.s3Path}/ — ${err}`);
        }
      }
    }

    // Step 7: Delete DB records
    const deleted = await prisma.tenant_templates.deleteMany({
      where: { tenantId: tenant.id },
    });
    steps.push(`DB: deleted ${deleted.count} tenant_templates`);

    return NextResponse.json({
      success: true,
      tenant: { id: tenant.id, subdomain, businessName: tenant.businessName },
      steps,
    });
  } catch (error) {
    steps.push(`FATAL: ${error instanceof Error ? error.message : String(error)}`);
    return NextResponse.json({ error: "Reset failed", steps }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
