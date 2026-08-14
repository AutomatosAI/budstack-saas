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
    // US-009 — cover-image alt text. The Wire's post editor writes the same key
    // (app/api/tenant-admin/posts/[id]/route.ts), and this route REPLACES the
    // column wholesale, so it has to carry the field or a save from the SEO
    // Manager would erase the alt the author wrote next to the image.
    imageAlt: z.string().max(300).optional(),
  })
  .strict();

// GET - Fetch post SEO
export const GET = requirePermissionParams("canViewSeo", async (_request, { tenantId }, params) => {
  let id: string;
  try {
    id = parseUuid(params.id);
  } catch (error) {
    return apiError(error, { route: "/api/tenant-admin/seo/posts/[id]" });
  }

  const post = await prisma.posts.findFirst({
    where: { id, tenantId: tenantId },
    select: { id: true, title: true, slug: true, seo: true },
  });

  if (!post) {
    return apiError(new Error("Post not found"), { route: "GET /api/tenant-admin/seo/posts/[id]", status: 404, safeMessage: "Post not found" });
  }

  return NextResponse.json(post);
});

// PUT - Update post SEO
export const PUT = requirePermissionParams("canEditSeo", async (request, { tenantId }, params) => {
  let id: string;
  try {
    id = parseUuid(params.id);
  } catch (error) {
    return apiError(error, { route: "/api/tenant-admin/seo/posts/[id]" });
  }

  // Verify post belongs to tenant
  const existingPost = await prisma.posts.findFirst({
    where: { id, tenantId: tenantId },
  });

  if (!existingPost) {
    return apiError(new Error("Post not found"), { route: "PUT /api/tenant-admin/seo/posts/[id]", status: 404, safeMessage: "Post not found" });
  }

  let parsed;
  try {
    parsed = await parseJsonBody(request, seoUpdateSchema);
  } catch (error) {
    return apiError(error, { route: "PUT /api/tenant-admin/seo/posts/[id]" });
  }
  const { title, description, ogImage, imageAlt } = parsed;

  // Build SEO object, removing empty values
  const seo: Record<string, string> = {};
  if (title?.trim()) seo.title = title.trim();
  if (description?.trim()) seo.description = description.trim();
  if (ogImage?.trim()) seo.ogImage = ogImage.trim();
  if (imageAlt?.trim()) seo.imageAlt = imageAlt.trim();

  const updated = await prisma.posts.update({
    where: { id },
    data: {
      // DbNull, not a bare null: `null` is not a legal value for a nullable
      // Json column (lib/email/email-template-content.ts:93-94), so emptying
      // every field threw instead of clearing the record. Reachable in one
      // click now that US-009 put a fourth field in this editor.
      seo: Object.keys(seo).length > 0 ? seo : Prisma.DbNull,
      updatedAt: new Date(),
    },
    select: { id: true, title: true, seo: true },
  });

  return NextResponse.json(updated);
});
