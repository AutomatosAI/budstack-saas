import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withSuperAdminParams } from "@/lib/api-auth";
import { ApiError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";
import { parseJsonBody } from "@/lib/validation/body";
import {
  sanitizeEmailHtml,
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
    description,
    category,
    isSystem,
    isActive,
  } = await parseJsonBody(req, updateTemplateSchema, {
    maxBytes: EMAIL_BODY_MAX_BYTES,
  });

  const updated = await prisma.email_templates.update({
    where: { id },
    data: {
      name,
      subject: subject !== undefined ? sanitizeEmailSubject(subject) : undefined,
      contentHtml:
        contentHtml !== undefined ? sanitizeEmailHtml(contentHtml) : undefined,
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
