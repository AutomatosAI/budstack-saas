import { getCurrentUser } from "@/lib/auth-helper";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const VALID_PAGE_KEYS = ["home", "about", "contact", "faq"];

// GET - Fetch tenant page SEO
export async function GET() {
  const user = await getCurrentUser();

  if (
    !user ||
    (user.role !== "TENANT_ADMIN" &&
      user.role !== "SUPER_ADMIN")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = user.tenantId;

  if (!tenantId) {
    return NextResponse.json({ error: "No tenant" }, { status: 400 });
  }

  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: { pageSeo: true },
  });

  return NextResponse.json({ pageSeo: tenant?.pageSeo || {} });
}

// PUT - Update tenant page SEO
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();

  if (
    !user ||
    (user.role !== "TENANT_ADMIN" &&
      user.role !== "SUPER_ADMIN")
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = user.tenantId;

  if (!tenantId) {
    return NextResponse.json({ error: "No tenant" }, { status: 400 });
  }

  const body = await request.json();
  const { pageKey, seo } = body;

  if (!pageKey || !VALID_PAGE_KEYS.includes(pageKey)) {
    return NextResponse.json({ error: "Invalid page key" }, { status: 400 });
  }

  // Get current pageSeo
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: { pageSeo: true },
  });

  const currentPageSeo = (tenant?.pageSeo as Record<string, unknown>) || {};

  // Build SEO object for this page, removing empty values
  const pageSeoData: Record<string, string> = {};
  if (seo?.title?.trim()) pageSeoData.title = seo.title.trim();
  if (seo?.description?.trim())
    pageSeoData.description = seo.description.trim();
  if (seo?.ogImage?.trim()) pageSeoData.ogImage = seo.ogImage.trim();

  // Merge with existing data
  const updatedPageSeo: Record<string, Record<string, string> | null> = {
    ...currentPageSeo,
    [pageKey]: Object.keys(pageSeoData).length > 0 ? pageSeoData : null,
  };

  // Clean up null entries
  Object.keys(updatedPageSeo).forEach((key) => {
    if (updatedPageSeo[key] === null) {
      delete updatedPageSeo[key];
    }
  });

  const updated = await prisma.tenants.update({
    where: { id: tenantId },
    data: {
      pageSeo: Object.keys(updatedPageSeo).length > 0 ? updatedPageSeo : null,
      updatedAt: new Date(),
    },
    select: { pageSeo: true },
  });

  return NextResponse.json({ pageSeo: updated.pageSeo || {} });
}
