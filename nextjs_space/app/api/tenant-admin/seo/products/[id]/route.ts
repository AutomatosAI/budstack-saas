import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requirePermissionParams } from "@/lib/permissions/require-permission";
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
    // US-009 — alt text for the product's imagery. Capped well under the
    // description limit: an alt string is a sentence, not a paragraph, and a
    // screen reader reads the whole of it before anything else on the page.
    imageAlt: z.string().max(300).optional(),
  })
  .strict();

// GET - Fetch product SEO
export const GET = requirePermissionParams("canViewSeo", async (_request, { tenantId }, params) => {
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
    return apiError(new Error("Product not found"), { route: "GET /api/tenant-admin/seo/products/[id]", status: 404, safeMessage: "Product not found" });
  }

  return NextResponse.json(product);
});

// PUT - Update product SEO
export const PUT = requirePermissionParams("canEditSeo", async (request, { tenantId }, params) => {
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
    return apiError(new Error("Product not found"), { route: "PUT /api/tenant-admin/seo/products/[id]", status: 404, safeMessage: "Product not found" });
  }

  let parsed;
  try {
    parsed = await parseJsonBody(request, seoUpdateSchema);
  } catch (error) {
    return apiError(error, { route: "PUT /api/tenant-admin/seo/products/[id]" });
  }
  const { title, description, ogImage, imageAlt } = parsed;

  // Build SEO object, removing empty values
  const seo: Record<string, string> = {};
  if (title?.trim()) seo.title = title.trim();
  if (description?.trim()) seo.description = description.trim();
  if (ogImage?.trim()) seo.ogImage = ogImage.trim();
  if (imageAlt?.trim()) seo.imageAlt = imageAlt.trim();

  const updated = await prisma.products.update({
    where: { id },
    data: {
      // DbNull, not a bare null: `null` is not a legal value for a nullable
      // Json column (lib/email/email-template-content.ts:93-94), so emptying
      // every field threw instead of clearing the record. Reachable in one
      // click now that US-009 put a fourth field in this editor.
      seo: Object.keys(seo).length > 0 ? seo : Prisma.DbNull,
      updatedAt: new Date(),
    },
    select: { id: true, name: true, seo: true },
  });

  return NextResponse.json(updated);
});
