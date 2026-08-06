import { NextResponse } from "next/server";
import crypto from "crypto";
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

    // posts.authorId FKs users.id, but user.id is the CLERK id — the two only
    // coincide for rows the Clerk webhook itself created (keyed by the raw
    // Clerk id). Admins provisioned by tenant-create / team-invite / seeding
    // have UUID PKs, so stamping user.id violates posts_authorId_fkey (every
    // lekkerweed blog create 500'd this way). Resolve the local row — Clerk id
    // first, then email (globally unique). The lookup runs tenant-scoped, so an
    // impersonating super-admin (row outside this tenant) misses and falls back
    // to user.id: exactly the Clerk-keyed row the FK already accepts today.
    const localAuthor = await prisma.users.findFirst({
      where: {
        OR: [
          { clerkUserId: user.id },
          { id: user.id },
          ...(user.email ? [{ email: user.email }] : []),
        ],
      },
      select: { id: true },
    });
    const authorId = localAuthor?.id ?? user.id;

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

    // The `posts` model declares neither an `id` default nor `@updatedAt`
    // (introspected schema), so Prisma requires both on create — mirror the
    // convention used across the other create() call sites.
    const post = await prisma.posts.create({
      data: {
        id: crypto.randomUUID(),
        title: validatedData.title,
        slug: uniqueSlug,
        content: validatedData.content,
        excerpt: validatedData.excerpt,
        coverImage: validatedData.coverImage,
        published: validatedData.published,
        tenantId: tenantId,
        authorId,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    // P2003 = FK violation on authorId: no users row carries this id. Surface
    // it as a clear, actionable 409 instead of an opaque 500.
    if ((error as { code?: string })?.code === "P2003") {
      return NextResponse.json(
        { error: "Your author account is not linked to this store yet. Please contact support." },
        { status: 409 },
      );
    }
    return apiError(error, { route: "POST /api/tenant-admin/posts" });
  }
});

export const GET = withTenantAuth(async (_request, { tenantId }) => {
  try {
    // The Prisma relation on posts is `users` (introspected name) — there is
    // no `author` field, so including it threw P2009 and 500'd this route.
    // Alias it back to `author` in the response to keep the intended contract.
    const posts = await prisma.posts.findMany({
      where: { tenantId: tenantId },
      orderBy: { createdAt: "desc" },
      include: { users: { select: { name: true, email: true } } },
    });

    return NextResponse.json(
      posts.map(({ users, ...post }: any) => ({ ...post, author: users })),
    );
  } catch (error) {
    console.error("Error fetching posts:", error);
    return apiError(error, { route: "GET /api/tenant-admin/posts", safeMessage: "Internal server error" });
  }
});
