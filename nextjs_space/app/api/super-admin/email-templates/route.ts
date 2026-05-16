import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withSuperAdmin } from "@/lib/api-auth";
import { apiValidationError } from "@/lib/api-error";

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
  const body = await req.json();
  const { name, subject, contentHtml, category, description } = body;

  if (!name || !subject || !contentHtml) {
    return apiValidationError("Missing required fields", "POST /api/super-admin/email-templates");
  }

  const template = await prisma.email_templates.create({
    data: {
      name,
      subject,
      contentHtml,
      category,
      description,
      isSystem: true,
      tenantId: null,
    },
  });

  return NextResponse.json(template);
});
