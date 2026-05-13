import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withSuperAdmin } from "@/lib/api-auth";
import { apiValidationError } from "@/lib/api-error";

export const GET = withSuperAdmin(async () => {
  const mappings = await prisma.email_event_mappings.findMany({
    where: { tenantId: null },
    include: { template: true },
  });

  return NextResponse.json(mappings);
});

export const POST = withSuperAdmin(async (req) => {
  const body = await req.json();
  const { eventType, templateId, isActive } = body;

  if (!eventType || !templateId) {
    return apiValidationError(
      "Missing required fields",
      "POST /api/super-admin/email-mappings",
    );
  }

  const existing = await prisma.email_event_mappings.findFirst({
    where: {
      eventType,
      tenantId: null,
    },
  });

  const mapping = existing
    ? await prisma.email_event_mappings.update({
        where: { id: existing.id },
        data: { templateId, isActive: isActive ?? true },
      })
    : await prisma.email_event_mappings.create({
        data: {
          eventType,
          tenantId: null,
          templateId,
          isActive: isActive ?? true,
        },
      });

  return NextResponse.json(mapping);
});
