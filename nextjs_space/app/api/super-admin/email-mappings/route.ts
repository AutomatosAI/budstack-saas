import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch only system-level mappings (tenantId is null)
    const mappings = await prisma.email_event_mappings.findMany({
      where: { tenantId: null },
      include: { template: true },
    });

    return NextResponse.json(mappings);
  } catch (error) {
    console.error("Failed to fetch mappings:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { eventType, templateId, isActive } = body;

    if (!eventType || !templateId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Upsert logic for system mapping
    // Note: Prisma where clause for unique constraint with nullable fields can be tricky.
    // We might need to find first then update or create?
    // Or use `findUnique` if Prisma schema supports `@@unique([eventType, tenantId])`.
    // However, standard SQL treats multiple NULLs as distinct. But Prisma usually handles it.
    // Let's try findFirst logic to be safe or upsert if confident.

    // Safer approach for nullable unique:
    const existing = await prisma.email_event_mappings.findFirst({
      where: {
        eventType,
        tenantId: null,
      },
    });

    let mapping;
    if (existing) {
      mapping = await prisma.email_event_mappings.update({
        where: { id: existing.id },
        data: { templateId, isActive: isActive ?? true },
      });
    } else {
      mapping = await prisma.email_event_mappings.create({
        data: {
          eventType,
          tenantId: null,
          templateId,
          isActive: isActive ?? true,
        },
      });
    }

    return NextResponse.json(mapping);
  } catch (error) {
    console.error("Failed to save mapping:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
