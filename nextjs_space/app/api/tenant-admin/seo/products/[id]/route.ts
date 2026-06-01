import { NextResponse } from "next/server";
import { withTenantAuthParams } from "@/lib/api-auth";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";
import { parseJsonBody } from "@/lib/validation/body";

const seoUpdateSchema = z
  .object({
    title: z.string().max(300).optional(),
    description: z.string().max(1000).optional(),
    ogImage: z.string().max(2000).optional(),
  })
  .strict();

// GET - Fetch product SEO
export const GET = withTenantAuthParams(async (_request, { tenantId }, params) => {
  let id: string;
  try {
    id = parseUuid(params.id);
  } catch (error) {
    return apiError(error, { route: "/api/tenant-admin/seo/products/[id]" });
  }

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
  let id: string;
  try {
    id = parseUuid(params.id);
  } catch (error) {
    return apiError(error, { route: "/api/tenant-admin/seo/products/[id]" });
  }

  // Verify product belongs to tenant
  const existingProduct = await prisma.products.findFirst({
    where: { id, tenantId: tenantId },
  });

  if (!existingProduct) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  let parsed;
  try {
    parsed = await parseJsonBody(request, seoUpdateSchema);
  } catch (error) {
    return apiError(error, { route: "PUT /api/tenant-admin/seo/products/[id]" });
  }
  const { title, description, ogImage } = parsed;

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
