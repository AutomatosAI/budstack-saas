import { NextResponse } from "next/server";
import { withTenantAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";

// Slugify helper
function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-"); // Replace multiple - with single -
}

const postSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  content: z.string().min(1, "Content is required").max(100_000),
  excerpt: z.string().max(5000).optional(),
  coverImage: z.string().max(2000).optional(),
  published: z.boolean().default(false),
});

export const POST = withTenantAuth(async (req, { user, tenantId }) => {
  try {
    const body = await parseJsonBody(req, undefined, { maxBytes: 512 * 1024 });
    const validatedData = postSchema.parse(body);

    // Generate base slug
    let slug = slugify(validatedData.title);

    // Ensure uniqueness within tenant. findFirst (not findUnique w/ the
    // slug_tenantId compound key): the tenant-scope extension rewrites
    // findUnique→findFirst and injects the bound tenantId, and findFirst
    // rejects the compound key (would throw PrismaClientValidationError).
    let uniqueSlug = slug;
    let counter = 1;
    while (
      await prisma.posts.findFirst({
        where: { slug: uniqueSlug },
      })
    ) {
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    const post = await prisma.posts.create({
      data: {
        title: validatedData.title,
        slug: uniqueSlug,
        content: validatedData.content,
        excerpt: validatedData.excerpt,
        coverImage: validatedData.coverImage,
        published: validatedData.published,
        tenantId: tenantId,
        authorId: user.id,
      },
    });

    return NextResponse.json(post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return apiError(error, { route: "POST /api/tenant-admin/posts" });
  }
});

export const GET = withTenantAuth(async (_request, { tenantId }) => {
  try {
    const posts = await prisma.posts.findMany({
      where: { tenantId: tenantId },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { name: true, email: true } } },
    });

    return NextResponse.json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    return apiError(error, { route: "GET /api/tenant-admin/posts", safeMessage: "Internal server error" });
  }
});
