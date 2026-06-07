import { NextResponse } from "next/server";
import { z } from "zod";

import { withAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getCurrentTenant } from "@/lib/tenant/tenant";
import { getTenantDrGreenConfig } from "@/lib/tenant/tenant-config";
import { apiError } from "@/lib/api-error";
import { parseSlug } from "@/lib/validation/parse-uuid";
import {
  uploadIdentityDocument,
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  type IdentityDocumentType,
} from "@/lib/drgreen-identity";
import {
  getTenantVerificationMode,
  isSaIdUploadEnabled,
} from "@/lib/verification-mode";

// Node runtime is REQUIRED: drgreen-identity signs over a Node Buffer, whose
// JSON.stringify form differs from a Uint8Array/Blob. Edge would break signing.
export const runtime = "nodejs";

const metaSchema = z.object({
  documentType: z.enum(["ID", "PASSPORT", "DRIVING_LICENCE"]),
  documentNumber: z.string().trim().min(1).max(100),
});

/**
 * Forward a customer's ID document to Dr Green for the SA ID-upload path.
 * Budstacks is a pure pass-through: it validates, forwards, and stores NOTHING
 * about the document (no image, number, key, or preview URL).
 */
export const POST = withAuth(async (request, { user }, { slug }) => {
  try {
    parseSlug(slug);

    const email = user.email;
    if (!email) {
      return NextResponse.json({ error: "Email not found" }, { status: 401 });
    }

    const tenant = await getCurrentTenant();
    if (!tenant) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    // Gate: global flag + tenant is in ID-upload mode (which is ZA-only).
    if (
      !isSaIdUploadEnabled() ||
      getTenantVerificationMode(tenant) !== "ID_UPLOAD"
    ) {
      return NextResponse.json(
        { error: "ID document upload is not available for this store" },
        { status: 403 },
      );
    }

    const dbUser = await prisma.users.findFirst({
      where: { email },
      select: { id: true, drGreenClientId: true },
    });
    if (!dbUser?.drGreenClientId) {
      return NextResponse.json(
        { error: "Please complete registration before uploading your ID" },
        { status: 400 },
      );
    }

    // Multipart, not JSON — this is a file upload.
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
    }

    const fileEntry = form.get("file");
    if (!(fileEntry instanceof Blob) || fileEntry.size === 0) {
      return NextResponse.json(
        { error: "A document file is required" },
        { status: 400 },
      );
    }
    if (fileEntry.size > MAX_DOCUMENT_BYTES) {
      return NextResponse.json(
        { error: `File exceeds the ${MAX_DOCUMENT_BYTES / (1024 * 1024)}MB limit` },
        { status: 400 },
      );
    }
    const mimeType = fileEntry.type;
    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json(
        {
          error: `Unsupported file type. Allowed: ${ALLOWED_DOCUMENT_MIME_TYPES.join(", ")}`,
        },
        { status: 400 },
      );
    }

    const meta = metaSchema.safeParse({
      documentType: form.get("documentType"),
      documentNumber: form.get("documentNumber"),
    });
    if (!meta.success) {
      return NextResponse.json(
        { error: "Invalid document type or number" },
        { status: 400 },
      );
    }

    const config = await getTenantDrGreenConfig(tenant.id);
    const fileBuffer = Buffer.from(await fileEntry.arrayBuffer());

    await uploadIdentityDocument({
      clientId: dbUser.drGreenClientId,
      documentType: meta.data.documentType as IdentityDocumentType,
      documentNumber: meta.data.documentNumber,
      file: fileBuffer,
      mimeType,
      config: { apiKey: config.apiKey, secretKey: config.secretKey },
      baseUrl: config.apiUrl,
    });

    // Pass-through complete. Nothing about the document is persisted here.
    return NextResponse.json({ status: "PENDING" });
  } catch (error) {
    return apiError(error, {
      route: "store.verify.id-document",
      status: 500,
      safeMessage: "Failed to upload your ID document. Please try again.",
    });
  }
});
