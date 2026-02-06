import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Temporary endpoint to clean corrupted designSystem
// DELETE after use
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

  const tenant = await prisma.tenants.findUnique({
    where: { subdomain: slug },
    include: { activeTenantTemplate: true },
  });

  if (!tenant?.activeTenantTemplate) {
    return NextResponse.json({ error: "no active template" }, { status: 404 });
  }

  const tt = tenant.activeTenantTemplate;
  const before = tt.designSystem;

  // Clear the corrupted designSystem — let template :root CSS vars take effect
  await prisma.tenant_templates.update({
    where: { id: tt.id },
    data: { designSystem: {} },
  });

  return NextResponse.json({ success: true, before, after: {} });
}
