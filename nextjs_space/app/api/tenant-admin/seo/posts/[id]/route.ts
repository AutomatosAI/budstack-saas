import { NextResponse } from "next/server";
import { withTenantAuthParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

// GET - Fetch post SEO
export const GET = withTenantAuthParams(async (_request, { tenantId }, params) => {
  const { id } = params;

  const post = await prisma.posts.findFirst({
    where: { id, tenantId: tenantId },
    select: { id: true, title: true, slug: true, seo: true },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json(post);
});

// PUT - Update post SEO
export const PUT = withTenantAuthParams(async (request, { tenantId }, params) => {
  const { id } = params;

  // Verify post belongs to tenant
  const existingPost = await prisma.posts.findFirst({
    where: { id, tenantId: tenantId },
  });

  if (!existingPost) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const body = await request.json();
  const { title, description, ogImage } = body;

  // Build SEO object, removing empty values
  const seo: Record<string, string> = {};
  if (title?.trim()) seo.title = title.trim();
  if (description?.trim()) seo.description = description.trim();
  if (ogImage?.trim()) seo.ogImage = ogImage.trim();

  const updated = await prisma.posts.update({
    where: { id },
    data: {
      seo: Object.keys(seo).length > 0 ? seo : null,
      updatedAt: new Date(),
    },
    select: { id: true, title: true, seo: true },
  });

  return NextResponse.json(updated);
});
