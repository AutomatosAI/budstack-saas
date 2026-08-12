import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withSuperAdmin } from "@/lib/api-auth";
import { ApiError } from "@/lib/api-error";
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

// US-011 — a template arrives EITHER as raw HTML (the pre-US-011 path) or as a
// composer document the save pipeline renders. `contentHtml` is optional so the
// composer need not send derived HTML it does not own, and the refine keeps a
// body carrying neither a 400 rather than an empty template.
const createTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    subject: z.string().trim().min(1).max(EMAIL_SUBJECT_MAX_LENGTH),
    contentHtml: z.string().min(1).max(EMAIL_HTML_MAX_LENGTH).optional(),
    contentJson: emailContentJsonSchema.nullish(),
    category: z.string().trim().max(100).optional().nullable(),
    description: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((body) => body.contentHtml !== undefined || Boolean(body.contentJson), {
    // A null document is a client saying "raw HTML mode", not a content source —
    // so it does not satisfy this on its own.
    message: "contentHtml or contentJson is required",
    path: ["contentHtml"],
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
  const { name, subject, contentHtml, contentJson, category, description } =
    await parseJsonBody(req, createTemplateSchema, {
      maxBytes: EMAIL_BODY_MAX_BYTES,
    });

  // tenantId null: a system template belongs to no tenant and is mailed on
  // behalf of whichever one the worker resolves it for, so the pipeline wraps
  // it in the slot-carrying system shell rather than one tenant's branding.
  const content = await resolveTemplateContent({
    contentHtml,
    contentJson,
    tenantId: null,
    category,
  });

  // Unreachable behind the schema refine — but `contentHtml` is a required
  // column, and a create that silently stored an empty body would be worse than
  // a loud 400.
  if (content.contentHtml === undefined) {
    throw new ApiError("contentHtml or contentJson is required", 400);
  }

  const template = await prisma.email_templates.create({
    data: {
      name,
      subject: sanitizeEmailSubject(subject),
      ...content,
      contentHtml: content.contentHtml,
      category,
      description,
      isSystem: true,
      tenantId: null,
    },
  });

  return NextResponse.json(template);
});
