import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withSuperAdmin } from "@/lib/api-auth";
import { parseJsonBody } from "@/lib/validation/body";
import {
  isReservedEventType,
  RESERVED_EVENT_TYPE_MESSAGE,
} from "@/lib/email/reserved-event-types";

const emailMappingSchema = z
  .object({
    // A system default here would hijack the reserved event for EVERY tenant,
    // so the platform's own templateNames are rejected outright.
    eventType: z
      .string()
      .min(1)
      .max(200)
      .refine((value) => !isReservedEventType(value), {
        message: RESERVED_EVENT_TYPE_MESSAGE,
      }),
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
