import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";
import {
  sanitizeEmailHtml,
  sanitizeEmailSubject,
  EMAIL_HTML_MAX_LENGTH,
  EMAIL_SUBJECT_MAX_LENGTH,
} from "@/lib/email-sanitize";
import { apiError } from "@/lib/api-error";
import { parseUuid } from "@/lib/validation/parse-uuid";
import { parseJsonBody } from "@/lib/validation/body";

const TEMPLATE_NAME_MAX = 200;
const TEMPLATE_DESCRIPTION_MAX = 1000;

// Strip-mode (see create route): handler slices/sanitizes and keeps the precise
// contentHtml/subject length checks; Zod bounds types + caps metadata. Raised
// maxBytes so a max-size contentHtml survives JSON escaping.
const emailTemplateUpdateSchema = z.object({
  name: z.string().max(1000).optional(),
  subject: z.string().optional(),
  contentHtml: z.string().optional(),
  description: z.string().max(5000).optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const clerkUser = await currentUser();

    if (
      !clerkUser ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(
        (clerkUser.publicMetadata.role as string) || "",
      )
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = parseUuid(params.id);

    const email = clerkUser.emailAddresses[0]?.emailAddress;

    const user = await prisma.users.findFirst({
      where: { email: email },
      include: { tenants: true },
    });

    if (!user?.tenants) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const template = await prisma.email_templates.findFirst({
      where: {
        id: id,
        tenantId: user.tenants.id, // Strict ownership
      },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found or access denied" },
        { status: 404 },
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    return apiError(error, { route: "GET /api/tenant-admin/email-templates/[id]" });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const clerkUser = await currentUser();

    if (
      !clerkUser ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(
        (clerkUser.publicMetadata.role as string) || "",
      )
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = parseUuid(params.id);

    const email = clerkUser.emailAddresses[0]?.emailAddress;

    const user = await prisma.users.findFirst({
      where: { email: email },
      include: { tenants: true },
    });

    if (!user?.tenants) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const body = await parseJsonBody(req, emailTemplateUpdateSchema, {
      maxBytes: 512 * 1024,
    });
    const { name, subject, contentHtml, description, isActive } = body;

    // SECURITY (C7): Length caps + HTML allowlist + subject tag-strip.
    // See lib/email-sanitize.ts for the full email-safe policy.
    if (typeof contentHtml === "string" && contentHtml.length > EMAIL_HTML_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Template HTML exceeds maximum size of ${EMAIL_HTML_MAX_LENGTH} characters` },
        { status: 400 },
      );
    }
    if (typeof subject === "string" && subject.length > EMAIL_SUBJECT_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Subject exceeds maximum length of ${EMAIL_SUBJECT_MAX_LENGTH} characters` },
        { status: 400 },
      );
    }

    // Verify ownership before update
    const count = await prisma.email_templates.count({
      where: { id, tenantId: user.tenants.id },
    });

    if (count === 0) {
      return NextResponse.json(
        { error: "Template not found or access denied" },
        { status: 404 },
      );
    }

    const updated = await prisma.email_templates.update({
      where: { id },
      data: {
        ...(typeof name === "string" && { name: name.slice(0, TEMPLATE_NAME_MAX) }),
        ...(typeof subject === "string" && { subject: sanitizeEmailSubject(subject) }),
        ...(typeof contentHtml === "string" && {
          contentHtml: sanitizeEmailHtml(contentHtml),
        }),
        ...(typeof description === "string" && {
          description: description.slice(0, TEMPLATE_DESCRIPTION_MAX),
        }),
        ...(typeof isActive === "boolean" && { isActive }),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return apiError(error, { route: "PUT /api/tenant-admin/email-templates/[id]" });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const clerkUser = await currentUser();

    if (
      !clerkUser ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(
        (clerkUser.publicMetadata.role as string) || "",
      )
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = parseUuid(params.id);

    const email = clerkUser.emailAddresses[0]?.emailAddress;

    const user = await prisma.users.findFirst({
      where: { email: email },
      include: { tenants: true },
    });

    if (!user?.tenants) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Verify ownership
    const template = await prisma.email_templates.findFirst({
      where: { id, tenantId: user.tenants.id },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    // Check if mapped
    const mapping = await prisma.email_event_mappings.findFirst({
      where: { templateId: id },
    });

    // Strategy: If mapped, delete the mapping first (Revert to default)
    if (mapping) {
      await prisma.email_event_mappings.delete({ where: { id: mapping.id } });
    }

    await prisma.email_templates.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error, { route: "DELETE /api/tenant-admin/email-templates/[id]" });
  }
}
