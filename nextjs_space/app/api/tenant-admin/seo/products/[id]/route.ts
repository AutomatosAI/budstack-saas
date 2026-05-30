import { NextResponse } from "next/server";
import { withTenantAuthParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

// GET - Fetch product SEO
export const GET = withTenantAuthParams(async (_request, { tenantId }, params) => {
  const { id } = params;

  const product = await prisma.products.findFirst({
    where: { id, tenantId: tenantId },
    select: { id: true, name: true, slug: true, seo: true },
  });

  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  return NextResponse.json(product);
});

// PUT - Update product SEO
export const PUT = withTenantAuthParams(async (request, { tenantId }, params) => {
  const { id } = params;

  // Verify product belongs to tenant
  const existingProduct = await prisma.products.findFirst({
    where: { id, tenantId: tenantId },
  });

  if (!existingProduct) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  const body = await request.json();
  const { title, description, ogImage } = body;

  // Build SEO object, removing empty values
  const seo: Record<string, string> = {};
  if (title?.trim()) seo.title = title.trim();
  if (description?.trim()) seo.description = description.trim();
  if (ogImage?.trim()) seo.ogImage = ogImage.trim();

  const updated = await prisma.products.update({
    where: { id },
    data: {
      seo: Object.keys(seo).length > 0 ? seo : null,
      updatedAt: new Date(),
    },
    select: { id: true, name: true, seo: true },
  });

  return NextResponse.json(updated);
});
