import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * TEMPORARY endpoint to clear corrupted designSystem.colors for a tenant template.
 * Hex colors saved by the branding form produce invalid hsl(#hex) in templates.
 * This clears the colors object so the template's own :root CSS vars take effect.
 *
 * Usage: GET /api/fix-ds?subdomain=cannabizz
 * DELETE THIS ENDPOINT after use.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const subdomain = searchParams.get("subdomain");

  if (!subdomain) {
    return NextResponse.json({ error: "subdomain param required" }, { status: 400 });
  }

  const tenant = await prisma.tenants.findFirst({
    where: { subdomain },
  });

  if (!tenant || !tenant.activeTenantTemplateId) {
    return NextResponse.json({ error: "Tenant or active template not found" }, { status: 404 });
  }

  const tt = await prisma.tenant_templates.findUnique({
    where: { id: tenant.activeTenantTemplateId },
  });

  if (!tt) {
    return NextResponse.json({ error: "TenantTemplate not found" }, { status: 404 });
  }

  const currentDS = (tt.designSystem as any) || {};

  // Clear the colors object — let template :root CSS vars take effect
  const cleanedDS = { ...currentDS };
  delete cleanedDS.colors;

  await prisma.tenant_templates.update({
    where: { id: tt.id },
    data: { designSystem: cleanedDS },
  });

  return NextResponse.json({
    success: true,
    subdomain,
    before: currentDS,
    after: cleanedDS,
  });
}
