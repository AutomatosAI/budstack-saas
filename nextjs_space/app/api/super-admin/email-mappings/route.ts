import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withSuperAdmin } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/validation/body";

const emailMappingSchema = z
  .object({
    eventType: z.string().min(1).max(200),
    templateId: z.string().min(1).max(200),
    isActive: z.boolean().optional(),
  })
  .strict();

export const GET = withSuperAdmin(async () => {
  const mappings = await prisma.email_event_mappings.findMany({
    where: { tenantId: null },
    include: { template: true },
  });

  return NextResponse.json(mappings);
});

export const POST = withSuperAdmin(async (req) => {
  const { eventType, templateId, isActive } = await parseJsonBody(
    req,
    emailMappingSchema,
  );

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
