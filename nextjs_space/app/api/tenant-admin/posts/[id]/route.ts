import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";
import { parseJsonBody } from "@/lib/validation/body";

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}

const postSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  content: z.string().min(1, "Content is required").max(100_000),
  excerpt: z.string().max(5000).optional(),
  coverImage: z.string().max(2000).optional(),
  published: z.boolean().default(false),
});

export const GET = withAuth(async (_req, { user }, { id: rawId }) => {
  try {
    const email = user.email;
    const role = user.role;

    if (role !== "TENANT_ADMIN" && role !== "SUPER_ADMIN") {
      return apiError(new Error("Unauthorized"), { route: "GET /api/tenant-admin/posts/[id]", status: 401, safeMessage: "Unauthorized" });
    }

    const id = parseUuid(rawId);

    const post = await prisma.posts.findUnique({
      where: { id },
      include: { author: { select: { name: true } } },
    });

    if (!post) {
      return apiError(new Error("Post not found"), { route: "GET /api/tenant-admin/posts/[id]", status: 404, safeMessage: "Post not found" });
    }

    const localUser = await prisma.users.findFirst({
      where: { email: email },
      include: { tenants: true },
    });

    // Super Admin can access all posts, Tenant Admin only their own
    if (role !== "SUPER_ADMIN" && post.tenantId !== localUser?.tenantId) {
      return apiError(new Error("Unauthorized"), { route: "GET /api/tenant-admin/posts/[id]", status: 403, safeMessage: "Unauthorized" });
    }

    return NextResponse.json(post);
  } catch (error) {
    return apiError(error, { route: "GET /api/tenant-admin/posts/[id]" });
  }
});

export const PATCH = withAuth(async (req, { user }, { id: rawId }) => {
  try {
    const email = user.email;
    const role = user.role;

    if (role !== "TENANT_ADMIN" && role !== "SUPER_ADMIN") {
      return apiError(new Error("Unauthorized"), { route: "PATCH /api/tenant-admin/posts/[id]", status: 401, safeMessage: "Unauthorized" });
    }

    const id = parseUuid(rawId);
    const body = await parseJsonBody(req, undefined, { maxBytes: 512 * 1024 });
    const validatedData = postSchema.partial().parse(body);

    const localUser = await prisma.users.findFirst({
      where: { email: email },
      include: { tenants: true },
    });

    const existingPost = await prisma.posts.findUnique({ where: { id } });

    // Allow SUPER_ADMIN to bypass tenant check, otherwise enforce ownership
    if (
      !existingPost ||
      (role !== "SUPER_ADMIN" && existingPost.tenantId !== localUser?.tenantId)
    ) {
      return apiError(new Error("Post not found or unauthorized"), { route: "PATCH /api/tenant-admin/posts/[id]", status: 404, safeMessage: "Post not found or unauthorized" });
    }

    const dataToUpdate: Record<string, unknown> = { ...validatedData };

    if (validatedData.title && validatedData.title !== existingPost.title) {
      const baseSlug = slugify(validatedData.title);
      let uniqueSlug = baseSlug;
      let counter = 1;
      while (
        await prisma.posts.findFirst({
          where: {
            slug: uniqueSlug,
            tenantId: localUser!.tenantId,
            NOT: { id },
          },
        })
      ) {
        uniqueSlug = `${baseSlug}-${counter}`;
        counter += 1;
      }
      dataToUpdate.slug = uniqueSlug;
    }

    const updatedPost = await prisma.posts.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json(updatedPost);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return apiError(error, { route: "PATCH /api/tenant-admin/posts/[id]" });
  }
});

export const DELETE = withAuth(async (_req, { user }, { id: rawId }) => {
  try {
    const email = user.email;
    const role = user.role;

    if (role !== "TENANT_ADMIN" && role !== "SUPER_ADMIN") {
      return apiError(new Error("Unauthorized"), { route: "DELETE /api/tenant-admin/posts/[id]", status: 401, safeMessage: "Unauthorized" });
    }

    const id = parseUuid(rawId);
    const localUser = await prisma.users.findFirst({
      where: { email: email },
      include: { tenants: true },
    });

    const existingPost = await prisma.posts.findUnique({ where: { id } });

    if (
      !existingPost ||
      (role !== "SUPER_ADMIN" && existingPost.tenantId !== localUser?.tenantId)
    ) {
      return apiError(new Error("Post not found or unauthorized"), { route: "DELETE /api/tenant-admin/posts/[id]", status: 404, safeMessage: "Post not found or unauthorized" });
    }

    await prisma.posts.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, { route: "DELETE /api/tenant-admin/posts/[id]" });
  }
});
