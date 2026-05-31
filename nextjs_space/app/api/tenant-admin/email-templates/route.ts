import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-helper";
import { prisma } from "@/lib/db";
import {
  sanitizeEmailHtml,
  sanitizeEmailSubject,
  EMAIL_HTML_MAX_LENGTH,
  EMAIL_SUBJECT_MAX_LENGTH,
} from "@/lib/email-sanitize";
import { apiError } from "@/lib/api-error";
import { parseJsonBody } from "@/lib/validation/body";

const TEMPLATE_NAME_MAX = 200;
const TEMPLATE_DESCRIPTION_MAX = 1000;
const TEMPLATE_CATEGORY_MAX = 100;

// Strip-mode (not .strict()): the handler already slices/sanitizes every field
// and tolerated unknown keys before this sweep; contentHtml/subject keep their
// dedicated length checks (with precise messages), so Zod only bounds types and
// caps metadata fields. maxBytes is raised so a max-size (200K-char) contentHtml
// is not rejected by the 256KB default once JSON-escaped.
const emailTemplateCreateSchema = z.object({
  name: z.string().max(1000).optional(),
  subject: z.string().optional(),
  contentHtml: z.string().optional(),
  description: z.string().max(5000).optional(),
  category: z.string().max(1000).optional(),
  sourceTemplateId: z.string().max(200).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (
      !user ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(user.role || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found for user" }, { status: 404 });
    }

    const templates = await prisma.email_templates.findMany({
      where: {
        OR: [{ tenantId: tenantId }, { isSystem: true }],
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
    const user = await getCurrentUser();

    if (
      !user ||
      !["TENANT_ADMIN", "SUPER_ADMIN"].includes(user.role || "")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = user.tenantId;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found for user" }, { status: 404 });
    }

    const body = await parseJsonBody(req, emailTemplateCreateSchema, {
      maxBytes: 512 * 1024,
    });
    const {
      name,
      subject,
      contentHtml,
      description,
      category,
      sourceTemplateId,
    } = body;

    // SECURITY (C7): Reject oversize bodies before any work — a 10MB HTML
    // string can exhaust the sanitizer and is never a legitimate template.
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

    const safeName =
      typeof name === "string" && name.trim()
        ? name.slice(0, TEMPLATE_NAME_MAX)
        : "Untitled Template";
    const safeDescription =
      typeof description === "string"
        ? description.slice(0, TEMPLATE_DESCRIPTION_MAX)
        : null;
    const safeCategory =
      typeof category === "string" && category.trim()
        ? category.slice(0, TEMPLATE_CATEGORY_MAX)
        : "Transactional";

    let data: any = {
      // SECURITY (C7): Tenant-authored HTML is the highest-risk surface
      // we have — a malicious admin could inject <script>, <iframe>, on*
      // handlers, or javascript: hrefs. sanitizeEmailHtml strips all of
      // those while keeping email-safe styling.
      name: safeName,
      subject: sanitizeEmailSubject(typeof subject === "string" ? subject : "No Subject"),
      contentHtml: sanitizeEmailHtml(typeof contentHtml === "string" ? contentHtml : "<div></div>"),
      description: safeDescription,
      category: safeCategory,
      isSystem: false,
      tenantId: tenantId,
    };

    if (sourceTemplateId) {
      const source = await prisma.email_templates.findUnique({
        where: { id: sourceTemplateId },
      });
      if (source) {
        // Copy from source — re-sanitize in case the source pre-dates this
        // hardening or was seeded before the allowlist existed.
        data = {
          ...data,
          name: name
            ? safeName
            : `${(source.name || "Untitled").slice(0, TEMPLATE_NAME_MAX - 7)} (Copy)`,
          subject: sanitizeEmailSubject(source.subject || "No Subject"),
          contentHtml: sanitizeEmailHtml(source.contentHtml || "<div></div>"),
          category: source.category
            ? source.category.slice(0, TEMPLATE_CATEGORY_MAX)
            : safeCategory,
          description:
            (source.description || `Copy of ${source.name}`).slice(
              0,
              TEMPLATE_DESCRIPTION_MAX,
            ),
        };
      }
    }

    const newTemplate = await prisma.email_templates.create({ data });

    return NextResponse.json(newTemplate);
  } catch (error) {
    return apiError(error, { route: "POST /api/tenant-admin/email-templates" });
  }
}
