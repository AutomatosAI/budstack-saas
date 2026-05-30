import { NextResponse } from "next/server";
import { withTenantAuthParams } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import {
  sanitizeEmailHtml,
  sanitizeEmailSubject,
  EMAIL_HTML_MAX_LENGTH,
  EMAIL_SUBJECT_MAX_LENGTH,
} from "@/lib/email-sanitize";

const TEMPLATE_NAME_MAX = 200;
const TEMPLATE_DESCRIPTION_MAX = 1000;

export const GET = withTenantAuthParams(async (_request, { tenantId }, params) => {
  try {
    const template = await prisma.email_templates.findFirst({
      where: {
        id: params.id,
        tenantId: tenantId, // Strict ownership
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
    console.error("Error fetching template:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
});

export const PUT = withTenantAuthParams(async (req, { tenantId }, params) => {
  try {
    const body = await req.json();
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
      where: { id: params.id, tenantId: tenantId },
    });

    if (count === 0) {
      return NextResponse.json(
        { error: "Template not found or access denied" },
        { status: 404 },
      );
    }

    const updated = await prisma.email_templates.update({
      where: { id: params.id },
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
    console.error("Error updating template:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
});

export const DELETE = withTenantAuthParams(async (_request, { tenantId }, params) => {
  try {
    // Verify ownership
    const template = await prisma.email_templates.findFirst({
      where: { id: params.id, tenantId: tenantId },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found" },
        { status: 404 },
      );
    }

    // Check if mapped
    const mapping = await prisma.email_event_mappings.findFirst({
      where: { templateId: params.id },
    });

    // Strategy: If mapped, delete the mapping first (Revert to default)
    if (mapping) {
      await prisma.email_event_mappings.delete({ where: { id: mapping.id } });
    }

    await prisma.email_templates.delete({ where: { id: params.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
});
