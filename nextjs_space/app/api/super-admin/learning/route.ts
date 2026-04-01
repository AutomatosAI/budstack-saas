import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/s3";
import { validateUpload } from "@/lib/upload-validation";

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80);
}

/** GET — list all learning resources (for super-admin) */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resources = await prisma.learning_resources.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ resources });
}

/** POST — create a new learning resource */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const title = formData.get("title") as string;
  const description = formData.get("description") as string | null;
  const content = formData.get("content") as string | null;
  const category = formData.get("category") as string;
  const type = (formData.get("type") as string) || "article";
  const videoUrl = formData.get("videoUrl") as string | null;
  const docUrl = formData.get("docUrl") as string | null;
  const tags = formData.get("tags") as string | null;
  const isPublished = formData.get("isPublished") === "true";
  const sortOrder = parseInt(formData.get("sortOrder") as string) || 0;

  if (!title || !category) {
    return NextResponse.json(
      { error: "Title and category are required" },
      { status: 400 },
    );
  }

  // Handle cover image upload
  let coverImageKey: string | null = null;
  const coverImage = formData.get("coverImage") as File | null;
  if (coverImage && coverImage.size > 0) {
    const validation = validateUpload(coverImage);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Cover image: ${validation.error}` },
        { status: 400 },
      );
    }
    const buffer = Buffer.from(await coverImage.arrayBuffer());
    coverImageKey = await uploadFile(
      buffer,
      `learn-cover-${Date.now()}-${coverImage.name}`,
    );
  }

  // Handle document upload
  let docKey: string | null = docUrl || null;
  const docFile = formData.get("docFile") as File | null;
  if (docFile && docFile.size > 0) {
    const validation = validateUpload(docFile, { allowDocuments: true });
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Document: ${validation.error}` },
        { status: 400 },
      );
    }
    const buffer = Buffer.from(await docFile.arrayBuffer());
    docKey = await uploadFile(
      buffer,
      `learn-doc-${Date.now()}-${docFile.name}`,
    );
  }

  // Generate unique slug
  let slug = generateSlug(title);
  const existing = await prisma.learning_resources.findUnique({
    where: { slug },
  });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  const resource = await prisma.learning_resources.create({
    data: {
      title,
      slug,
      description: description || null,
      content: content || null,
      category,
      type,
      videoUrl: videoUrl || null,
      docUrl: docKey,
      coverImage: coverImageKey,
      tags: tags
        ? tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      isPublished,
      sortOrder,
    },
  });

  return NextResponse.json({ resource }, { status: 201 });
}

/** PUT — update an existing learning resource */
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const id = formData.get("id") as string;

  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  const existing = await prisma.learning_resources.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const title = formData.get("title") as string | null;
  const description = formData.get("description") as string | null;
  const content = formData.get("content") as string | null;
  const category = formData.get("category") as string | null;
  const type = formData.get("type") as string | null;
  const videoUrl = formData.get("videoUrl") as string | null;
  const docUrl = formData.get("docUrl") as string | null;
  const tags = formData.get("tags") as string | null;
  const isPublished = formData.get("isPublished");
  const sortOrder = formData.get("sortOrder");

  // Handle cover image upload
  let coverImageKey: string | undefined;
  const coverImage = formData.get("coverImage") as File | null;
  if (coverImage && coverImage.size > 0) {
    const validation = validateUpload(coverImage);
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Cover image: ${validation.error}` },
        { status: 400 },
      );
    }
    const buffer = Buffer.from(await coverImage.arrayBuffer());
    coverImageKey = await uploadFile(
      buffer,
      `learn-cover-${Date.now()}-${coverImage.name}`,
    );
  }

  // Handle doc file upload
  let docKey: string | undefined;
  const docFile = formData.get("docFile") as File | null;
  if (docFile && docFile.size > 0) {
    const validation = validateUpload(docFile, { allowDocuments: true });
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Document: ${validation.error}` },
        { status: 400 },
      );
    }
    const buffer = Buffer.from(await docFile.arrayBuffer());
    docKey = await uploadFile(
      buffer,
      `learn-doc-${Date.now()}-${docFile.name}`,
    );
  }

  const resource = await prisma.learning_resources.update({
    where: { id },
    data: {
      ...(title != null && { title }),
      ...(description != null && { description }),
      ...(content != null && { content }),
      ...(category != null && { category }),
      ...(type != null && { type }),
      ...(videoUrl != null && { videoUrl }),
      ...(docUrl != null && { docUrl }),
      ...(docKey && { docUrl: docKey }),
      ...(coverImageKey && { coverImage: coverImageKey }),
      ...(tags != null && {
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      }),
      ...(isPublished != null && { isPublished: isPublished === "true" }),
      ...(sortOrder != null && {
        sortOrder: parseInt(sortOrder as string) || 0,
      }),
    },
  });

  return NextResponse.json({ resource });
}

/** DELETE — remove a learning resource */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "ID is required" }, { status: 400 });
  }

  await prisma.learning_resources.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
