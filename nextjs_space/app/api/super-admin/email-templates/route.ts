import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withSuperAdmin } from "@/lib/api-auth";
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

const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(EMAIL_SUBJECT_MAX_LENGTH),
  contentHtml: z.string().min(1).max(EMAIL_HTML_MAX_LENGTH),
  category: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().max(1000).optional().nullable(),
});

export const GET = withSuperAdmin(async () => {
  const templates = await prisma.email_templates.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      mappings: true,
    },
  });

  return NextResponse.json(templates);
});

export const POST = withSuperAdmin(async (req) => {
  const { name, subject, contentHtml, category, description } =
    await parseJsonBody(req, createTemplateSchema, {
      maxBytes: EMAIL_BODY_MAX_BYTES,
    });

  const template = await prisma.email_templates.create({
    data: {
      name,
      subject: sanitizeEmailSubject(subject),
      contentHtml: sanitizeEmailHtml(contentHtml),
      category,
      description,
      isSystem: true,
      tenantId: null,
    },
  });

  return NextResponse.json(template);
});
