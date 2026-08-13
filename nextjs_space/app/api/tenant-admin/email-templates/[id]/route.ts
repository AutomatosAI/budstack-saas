import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionParams } from "@/lib/permissions/require-permission";
import { prisma } from "@/lib/db";
import {
  sanitizeEmailSubject,
  EMAIL_HTML_MAX_LENGTH,
  EMAIL_SUBJECT_MAX_LENGTH,
} from "@/lib/security/email-sanitize";
import { apiError, apiValidationError } from "@/lib/api-error";
import { emailContentJsonSchema } from "@/lib/email/email-content-json";
import { resolveTemplateContent } from "@/lib/email/email-template-content";
import { parseUuid } from "@/lib/validation/parse-uuid";
import { parseJsonBody } from "@/lib/validation/body";

const TEMPLATE_NAME_MAX = 200;
const TEMPLATE_DESCRIPTION_MAX = 1000;

// Strip-mode (see create route): handler slices/sanitizes and keeps the precise
// contentHtml/subject length checks; Zod bounds types + caps metadata. Raised
// maxBytes so a max-size contentHtml survives JSON escaping.
const emailTemplateUpdateSchema = z.object({
  name: z.string().max(1000).optional(),
  subject: z.string().optional(),
  contentHtml: z.string().optional(),
  // US-011 — a document re-renders contentHtml through the save pipeline; an
  // explicit null clears it (the author switched to the raw-HTML editor);
  // omitting it leaves both columns to the pre-US-011 path.
  contentJson: emailContentJsonSchema.nullish(),
  description: z.string().max(5000).optional(),
  isActive: z.boolean().optional(),
});

// US-009 — read gated on canViewEmails; every mutation on canEditEmails.
export const GET = requirePermissionParams("canViewEmails", async (_request, { tenantId }, params) => {
  try {
    const id = parseUuid(params.id);

    const template = await prisma.email_templates.findFirst({
      where: {
        id: id,
        tenantId: tenantId, // Strict ownership
      },
    });

    if (!template) {
      return apiError(new Error("Template not found or access denied"), { route: "GET /api/tenant-admin/email-templates/[id]", status: 404, safeMessage: "Template not found or access denied" });
    }

    return NextResponse.json(template);
  } catch (error) {
    return apiError(error, { route: "GET /api/tenant-admin/email-templates/[id]" });
  }
});

export const PUT = requirePermissionParams("canEditEmails", async (req, { tenantId }, params) => {
  try {
    const id = parseUuid(params.id);

    const body = await parseJsonBody(req, emailTemplateUpdateSchema, {
      maxBytes: 512 * 1024,
    });
    const { name, subject, contentHtml, contentJson, description, isActive } =
      body;

    // SECURITY (C7): Length caps + HTML allowlist + subject tag-strip.
    // See lib/email-sanitize.ts for the full email-safe policy.
    if (typeof contentHtml === "string" && contentHtml.length > EMAIL_HTML_MAX_LENGTH) {
      return apiValidationError(`Template HTML exceeds maximum size of ${EMAIL_HTML_MAX_LENGTH} characters`, "PUT /api/tenant-admin/email-templates/[id]");
    }
    if (typeof subject === "string" && subject.length > EMAIL_SUBJECT_MAX_LENGTH) {
      return apiValidationError(`Subject exceeds maximum length of ${EMAIL_SUBJECT_MAX_LENGTH} characters`, "PUT /api/tenant-admin/email-templates/[id]");
    }

    // Verify ownership before update. US-011 reads the row's `category` in the
    // same query — the update body cannot change it, and it is what decides
    // whether the rendered shell carries an unsubscribe footer.
    const existing = await prisma.email_templates.findFirst({
      where: { id, tenantId: tenantId },
      select: { category: true },
    });

    if (!existing) {
      return apiError(new Error("Template not found or access denied"), { route: "PUT /api/tenant-admin/email-templates/[id]", status: 404, safeMessage: "Template not found or access denied" });
    }

    const content = await resolveTemplateContent({
      contentHtml,
      contentJson,
      tenantId,
      category: existing.category,
    });

    const updated = await prisma.email_templates.update({
      where: { id },
      data: {
        ...(typeof name === "string" && { name: name.slice(0, TEMPLATE_NAME_MAX) }),
        ...(typeof subject === "string" && { subject: sanitizeEmailSubject(subject) }),
        ...content,
        ...(typeof description === "string" && {
          description: description.slice(0, TEMPLATE_DESCRIPTION_MAX),
        }),
        ...(typeof isActive === "boolean" && { isActive }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error, { route: "PUT /api/tenant-admin/email-templates/[id]" });
  }
});

export const DELETE = requirePermissionParams("canEditEmails", async (_request, { tenantId }, params) => {
  try {
    const id = parseUuid(params.id);

    // Verify ownership
    const template = await prisma.email_templates.findFirst({
      where: { id, tenantId: tenantId },
    });

    if (!template) {
      return apiError(new Error("Template not found"), { route: "DELETE /api/tenant-admin/email-templates/[id]", status: 404, safeMessage: "Template not found" });
    }

    // Remove every event mapping that references this template before deleting
    // it — a template can be mapped to multiple events, and findFirst+delete
    // would orphan the rest.
    await prisma.email_event_mappings.deleteMany({ where: { templateId: id } });

    await prisma.email_templates.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, { route: "DELETE /api/tenant-admin/email-templates/[id]" });
  }
});
