import { NextRequest, NextResponse } from "next/server";
// Force rebuild: 1
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

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
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  excerpt: z.string().optional(),
  coverImage: z.string().optional(),
  published: z.boolean().default(false),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      (session.user.role !== "TENANT_ADMIN" &&
        session.user.role !== "SUPER_ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const post = await prisma.posts.findUnique({
      where: { id },
      include: { author: { select: { name: true } } },
    });

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { tenants: true },
    });

    if (post.tenantId !== user?.tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json(post);
  } catch (error) {
    console.error("Error fetching post:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      (session.user.role !== "TENANT_ADMIN" &&
        session.user.role !== "SUPER_ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await req.json();
    const validatedData = postSchema.partial().parse(body);

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { tenants: true },
    });

    const existingPost = await prisma.posts.findUnique({ where: { id } });
    if (!existingPost || existingPost.tenantId !== user?.tenantId) {
      return NextResponse.json(
        { error: "Post not found or unauthorized" },
        { status: 404 },
      );
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
            tenantId: user!.tenantId,
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
    console.error("Error updating post:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (
      !session ||
      (session.user.role !== "TENANT_ADMIN" &&
        session.user.role !== "SUPER_ADMIN")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { tenants: true },
    });

    const existingPost = await prisma.posts.findUnique({ where: { id } });
    if (!existingPost || existingPost.tenantId !== user?.tenantId) {
      return NextResponse.json(
        { error: "Post not found or unauthorized" },
        { status: 404 },
      );
    }

    await prisma.posts.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting post:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
