import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withSuperAdminParams } from "@/lib/api-auth";
import { ApiError } from "@/lib/api-error";

export const GET = withSuperAdminParams(async (_req, _ctx, params) => {
  const template = await prisma.email_templates.findUnique({
    where: { id: params.id },
  });

  if (!template) {
    throw new ApiError("Template not found", 404);
  }

  return NextResponse.json(template);
});

export const PUT = withSuperAdminParams(async (req, _ctx, params) => {
  const body = await req.json();
  const {
    name,
    subject,
    contentHtml,
    description,
    category,
    isSystem,
    isActive,
  } = body;

  const updated = await prisma.email_templates.update({
    where: { id: params.id },
    data: {
      name,
      subject,
      contentHtml,
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
  await prisma.email_templates.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
});
