import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (
      !session ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { tenants: true },
    });

    if (!user?.tenants) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const templates = await prisma.email_templates.findMany({
      where: {
        OR: [{ tenantId: user.tenants.id }, { isSystem: true }],
      },
      orderBy: [
        { isSystem: "desc" }, // Group System templates together? Or maybe by Category?
        // Let's order by Updated, but system templates often have old dates.
        // Maybe name?
        { name: "asc" },
      ],
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Error fetching tenant templates:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (
      !session ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { id: session.user.id },
      include: { tenants: true },
    });

    if (!user?.tenants) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await req.json();
    const {
      name,
      subject,
      contentHtml,
      description,
      category,
      sourceTemplateId,
    } = body;

    let data: any = {
      name: name || "Untitled Template",
      subject: subject || "No Subject",
      contentHtml: contentHtml || "<div></div>",
      description,
      category: category || "Transactional",
      isSystem: false,
      tenantId: user.tenants.id,
    };

    if (sourceTemplateId) {
      const source = await prisma.email_templates.findUnique({
        where: { id: sourceTemplateId },
      });
      if (source) {
        data = {
          ...data,
          name: name || `${source.name} (Copy)`,
          subject: source.subject,
          contentHtml: source.contentHtml,
          category: source.category,
          description: source.description || `Copy of ${source.name}`,
        };
      }
    }

    const newTemplate = await prisma.email_templates.create({ data });

    return NextResponse.json(newTemplate);
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
