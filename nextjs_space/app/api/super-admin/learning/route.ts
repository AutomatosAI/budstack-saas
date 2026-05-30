import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/s3";
import { validateUploadBuffer } from "@/lib/upload-validation";
import { apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";
import { z } from "zod";

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 80);
}

// SECURITY (M11): Length caps on every text field. Without these a
// super-admin (or anyone who compromises a super-admin session) could push
// a 10MB string into the DB and fan out latency / storage cost.
const LEARN_TITLE_MAX = 200;
const LEARN_DESCRIPTION_MAX = 1000;
const LEARN_CONTENT_MAX = 100_000;
const LEARN_CATEGORY_MAX = 50;
const LEARN_TYPE_MAX = 30;
const LEARN_URL_MAX = 2048;
const LEARN_TAGS_MAX = 1000;

/** Truncate a FormData string to `max` chars; preserves null/undefined. */
function clip(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  return value.slice(0, max);
}

const learnDeleteSchema = z
  .object({
    id: z.string().min(1).max(200),
  })
  .strict();

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
  const title = clip(formData.get("title") as string | null, LEARN_TITLE_MAX);
  const description = clip(
    formData.get("description") as string | null,
    LEARN_DESCRIPTION_MAX,
  );
  const content = clip(
    formData.get("content") as string | null,
    LEARN_CONTENT_MAX,
  );
  const category = clip(
    formData.get("category") as string | null,
    LEARN_CATEGORY_MAX,
  );
  const type =
    clip(formData.get("type") as string | null, LEARN_TYPE_MAX) || "article";
  const videoUrl = clip(
    formData.get("videoUrl") as string | null,
    LEARN_URL_MAX,
  );
  const docUrl = clip(formData.get("docUrl") as string | null, LEARN_URL_MAX);
  const tags = clip(formData.get("tags") as string | null, LEARN_TAGS_MAX);
  const isPublished = formData.get("isPublished") === "true";
  const sortOrder = parseInt(formData.get("sortOrder") as string) || 0;

  if (!title || !category) {
    return NextResponse.json(
      { error: "Title and category are required" },
      { status: 400 },
    );
  }

  const safeFileName = (raw: string) =>
    raw
      .replace(/\.\.\//g, "")
      .replace(/\.\.\\/g, "")
      .replace(/[/\\]/g, "_")
      .slice(0, 200);

  // Handle cover image upload — SECURITY (C10): magic-byte verification
  let coverImageKey: string | null = null;
  const coverImage = formData.get("coverImage") as File | null;
  if (coverImage && coverImage.size > 0) {
    const buffer = Buffer.from(await coverImage.arrayBuffer());
    const cleanName = safeFileName(coverImage.name);
    const validation = await validateUploadBuffer(
      buffer,
      coverImage.type,
      cleanName,
    );
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Cover image: ${validation.error}` },
        { status: 400 },
      );
    }
    coverImageKey = await uploadFile(
      buffer,
      `learn-cover-${Date.now()}-${cleanName}`,
      coverImage.type || undefined,
    );
  }

  // Handle document upload — SECURITY (C10): magic-byte verification
  let docKey: string | null = docUrl || null;
  const docFile = formData.get("docFile") as File | null;
  if (docFile && docFile.size > 0) {
    const buffer = Buffer.from(await docFile.arrayBuffer());
    const cleanName = safeFileName(docFile.name);
    const validation = await validateUploadBuffer(
      buffer,
      docFile.type,
      cleanName,
      { allowDocuments: true },
    );
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Document: ${validation.error}` },
        { status: 400 },
      );
    }
    docKey = await uploadFile(
      buffer,
      `learn-doc-${Date.now()}-${cleanName}`,
      docFile.type || undefined,
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

  const title = clip(formData.get("title") as string | null, LEARN_TITLE_MAX);
  const description = clip(
    formData.get("description") as string | null,
    LEARN_DESCRIPTION_MAX,
  );
  const content = clip(
    formData.get("content") as string | null,
    LEARN_CONTENT_MAX,
  );
  const category = clip(
    formData.get("category") as string | null,
    LEARN_CATEGORY_MAX,
  );
  const type = clip(formData.get("type") as string | null, LEARN_TYPE_MAX);
  const videoUrl = clip(
    formData.get("videoUrl") as string | null,
    LEARN_URL_MAX,
  );
  const docUrl = clip(formData.get("docUrl") as string | null, LEARN_URL_MAX);
  const tags = clip(formData.get("tags") as string | null, LEARN_TAGS_MAX);
  const isPublished = formData.get("isPublished");
  const sortOrder = formData.get("sortOrder");

  const safeFileName = (raw: string) =>
    raw
      .replace(/\.\.\//g, "")
      .replace(/\.\.\\/g, "")
      .replace(/[/\\]/g, "_")
      .slice(0, 200);

  // Handle cover image upload — SECURITY (C10): magic-byte verification
  let coverImageKey: string | undefined;
  const coverImage = formData.get("coverImage") as File | null;
  if (coverImage && coverImage.size > 0) {
    const buffer = Buffer.from(await coverImage.arrayBuffer());
    const cleanName = safeFileName(coverImage.name);
    const validation = await validateUploadBuffer(
      buffer,
      coverImage.type,
      cleanName,
    );
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Cover image: ${validation.error}` },
        { status: 400 },
      );
    }
    coverImageKey = await uploadFile(
      buffer,
      `learn-cover-${Date.now()}-${cleanName}`,
      coverImage.type || undefined,
    );
  }

  // Handle doc file upload — SECURITY (C10): magic-byte verification
  let docKey: string | undefined;
  const docFile = formData.get("docFile") as File | null;
  if (docFile && docFile.size > 0) {
    const buffer = Buffer.from(await docFile.arrayBuffer());
    const cleanName = safeFileName(docFile.name);
    const validation = await validateUploadBuffer(
      buffer,
      docFile.type,
      cleanName,
      { allowDocuments: true },
    );
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Document: ${validation.error}` },
        { status: 400 },
      );
    }
    docKey = await uploadFile(
      buffer,
      `learn-doc-${Date.now()}-${cleanName}`,
      docFile.type || undefined,
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

  let id: string;
  try {
    ({ id } = await parseJsonBody(req, learnDeleteSchema));
  } catch (error) {
    return apiError(error, { route: "DELETE /api/super-admin/learning" });
  }

  await prisma.learning_resources.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
