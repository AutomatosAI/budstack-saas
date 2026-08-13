import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withSuperAdminParams } from "@/lib/api-auth";
import { ApiError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";
import { parseJsonBody } from "@/lib/validation/body";
import { emailContentJsonSchema } from "@/lib/email/email-content-json";
import { resolveTemplateContent } from "@/lib/email/email-template-content";
import {
  sanitizeEmailSubject,
  EMAIL_HTML_MAX_LENGTH,
  EMAIL_SUBJECT_MAX_LENGTH,
} from "@/lib/security/email-sanitize";

// Email HTML can approach EMAIL_HTML_MAX_LENGTH (200k) chars; once JSON-escaped
// the body exceeds the 256KB default, so lift the parse cap to 512KB.
const EMAIL_BODY_MAX_BYTES = 512 * 1024;

const updateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  subject: z.string().trim().min(1).max(EMAIL_SUBJECT_MAX_LENGTH).optional(),
  contentHtml: z.string().min(1).max(EMAIL_HTML_MAX_LENGTH).optional(),
  // US-011 — document present: contentHtml is re-rendered from it. Explicit
  // null: the author moved to raw HTML, so the document is dropped.
  contentJson: emailContentJsonSchema.nullish(),
  description: z.string().trim().max(1000).optional().nullable(),
  category: z.string().trim().max(100).optional().nullable(),
  isSystem: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const GET = withSuperAdminParams(async (_req, _ctx, params) => {
  const id = parseUuid(params.id);
  const template = await prisma.email_templates.findUnique({
    where: { id },
  });

  if (!template) {
    throw new ApiError("Template not found", 404);
  }

  return NextResponse.json(template);
});

export const PUT = withSuperAdminParams(async (req, _ctx, params) => {
  const id = parseUuid(params.id);
  const {
    name,
    subject,
    contentHtml,
    contentJson,
    description,
    category,
    isSystem,
    isActive,
  } = await parseJsonBody(req, updateTemplateSchema, {
    maxBytes: EMAIL_BODY_MAX_BYTES,
  });

  // US-011 — a super-admin can edit a TENANT-owned template, not just a system
  // one, so the shell has to be built from the row's own owner and category
  // rather than assumed to be systemwide. Only read when there is a document to
  // render; the raw-HTML path keeps its single blind update.
  const owner = contentJson
    ? await prisma.email_templates.findUnique({
        where: { id },
        select: { tenantId: true, category: true },
      })
    : null;

  if (contentJson && !owner) {
    throw new ApiError("Template not found", 404);
  }

  const content = await resolveTemplateContent({
    contentHtml,
    contentJson,
    tenantId: owner?.tenantId ?? null,
    // The body may be changing the category in this same request; that wins,
    // including when it clears it — `??` would have quietly kept the old value
    // and rendered an unsubscribe footer into a template no longer marked
    // marketing.
    category: category !== undefined ? category : owner?.category,
  });

  const updated = await prisma.email_templates.update({
    where: { id },
    data: {
      name,
      subject: subject !== undefined ? sanitizeEmailSubject(subject) : undefined,
      ...content,
      description,
      category,
      isSystem,
      isActive,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
});

export const DELETE = withSuperAdminParams(async (_req, _ctx, params) => {
  const id = parseUuid(params.id);
  await prisma.email_templates.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
});
