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
  isSaIdEligibleTenant,
  isSaIdUploadEnabled,
} from "@/lib/verification-mode";
import { recordIdDocumentOutcome } from "@/lib/verification/id-document-status";
import { SA_ID_INVALID_MESSAGE } from "@/lib/verification/sa-id";
import {
  documentNumberToForward,
  hasSaIdInvalidIssue,
  isSaIdInvalidUpstreamError,
  saIdDocumentRefinement,
  saIdInvalidBody,
} from "@/lib/verification/sa-id-schema";

// Node runtime is REQUIRED: drgreen-identity signs over a Node Buffer, whose
// JSON.stringify form differs from a Uint8Array/Blob. Edge would break signing.
export const runtime = "nodejs";

const baseMetaSchema = z.object({
  documentType: z.enum(["ID", "PASSPORT", "DRIVING_LICENCE"]),
  documentNumber: z.string().trim().min(1).max(100),
});

// BS-202: on a South African tenant an ID-type upload must carry a number that
// can exist — checked here, before anything is sent, with the copy Dr Green
// and the WordPress plugin use. Passport and driving-licence numbers, and
// every non-SA tenant, are untouched.
const metaSchemaFor = (enforceSaId: boolean) =>
  baseMetaSchema.superRefine(saIdDocumentRefinement(enforceSaId));

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

    // The tenant's country decides whether the SA ID rules apply — never the
    // customer's address (PRD §6). The gate above already limits this route to
    // ZA tenants; the flag keeps the rule explicit and testable.
    const enforceSaId = isSaIdEligibleTenant(tenant);
    const meta = metaSchemaFor(enforceSaId).safeParse({
      documentType: form.get("documentType"),
      documentNumber: form.get("documentNumber"),
    });
    if (!meta.success) {
      if (hasSaIdInvalidIssue(meta.error)) {
        // Nothing was attempted upstream, so no UPLOAD_FAILED outcome either.
        return NextResponse.json(saIdInvalidBody(), { status: 400 });
      }
      return NextResponse.json(
        { error: "Invalid document type or number" },
        { status: 400 },
      );
    }

    const config = await getTenantDrGreenConfig(tenant.id);
    const fileBuffer = Buffer.from(await fileEntry.arrayBuffer());

    try {
      await uploadIdentityDocument({
        clientId: dbUser.drGreenClientId,
        documentType: meta.data.documentType as IdentityDocumentType,
        documentNumber: documentNumberToForward(meta.data, enforceSaId),
        file: fileBuffer,
        mimeType,
        config: { apiKey: config.apiKey, secretKey: config.secretKey },
        baseUrl: config.apiUrl,
      });
    } catch (uploadError) {
      // BS-204: Dr Green's own strict check refused the number (only when the
      // two validators drift — ours ran first). Nothing was stored upstream;
      // record the customer-facing reason so the dashboard shows it beside the
      // re-upload card, and answer exactly as the local check would have.
      if (isSaIdInvalidUpstreamError(uploadError)) {
        await recordIdDocumentOutcome({
          tenantId: tenant.id,
          email,
          outcome: "UPLOAD_FAILED",
          error: new Error(SA_ID_INVALID_MESSAGE),
        });
        return NextResponse.json(saIdInvalidBody(), { status: 400 });
      }
      // PRD-220 Part B: keep the outcome flag truthful so the dashboard CTA
      // and the tenant-admin badge stay in sync with reality.
      await recordIdDocumentOutcome({
        tenantId: tenant.id,
        email,
        outcome: "UPLOAD_FAILED",
        error: uploadError,
      });
      throw uploadError;
    }

    // Pass-through complete. Nothing about the document itself is persisted —
    // only the PRD-220 outcome FLAG (no image, number, key, or preview URL).
    await recordIdDocumentOutcome({ tenantId: tenant.id, email, outcome: "UPLOADED" });
    return NextResponse.json({ status: "PENDING" });
  } catch (error) {
    return apiError(error, {
      route: "store.verify.id-document",
      status: 500,
      safeMessage: "Failed to upload your ID document. Please try again.",
    });
  }
});
