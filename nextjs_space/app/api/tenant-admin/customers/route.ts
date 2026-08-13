import { NextRequest, NextResponse } from "next/server";
import { withTenantAuth } from "@/lib/api-auth";
import { apiValidationError } from "@/lib/api-error";
import { prisma } from "@/lib/db";
import { tagSchema } from "@/lib/customers/tag-format";
import { ERASURE_EMAIL_DOMAIN } from "@/lib/gdpr/erasure";

const GET_ROUTE = "GET /api/tenant-admin/customers";

/**
 * GET /api/tenant-admin/customers
 * List customers for current tenant.
 * Optional `tag` param (US-024) narrows to customers carrying that tag —
 * matched in the tag's canonical form (trimmed, lowercased).
 */
export const GET = withTenantAuth(async (request: NextRequest, { tenantId }) => {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status");
  const rawTag = searchParams.get("tag");

  let tag: string | null = null;
  if (rawTag !== null && rawTag.trim() !== "") {
    const parsedTag = tagSchema.safeParse(rawTag);
    if (!parsedTag.success) {
      return apiValidationError(
        parsedTag.error.issues[0]?.message ?? "Invalid tag filter",
        GET_ROUTE,
      );
    }
    tag = parsedTag.data;
  }

  const where: any = {
    role: "PATIENT",
    tenantId,
    // Hide GDPR-erased (anonymized) customers — the row is retained for order
    // history but must not surface in the active customer list.
    NOT: { email: { endsWith: `@${ERASURE_EMAIL_DOMAIN}` } },
  };

  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
    ];
  }

  if (status === "active") {
    where.isActive = true;
  } else if (status === "inactive") {
    where.isActive = false;
  }

  // US-024: only customers carrying the tag. The relation rows repeat the
  // tenantId, so the predicate re-asserts it — belt and braces on top of the
  // users-level tenant scope above.
  if (tag) {
    where.customer_tags = { some: { tenantId, tag } };
  }

  const [total, customers, failedIdUploads] = await Promise.all([
    prisma.users.count({ where }),
    prisma.users.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        phone: true,
        address: true,
        isActive: true,
        createdAt: true,
        tenantId: true,
        _count: {
          select: {
            orders: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    // PRD-220 Part B: customers whose inline ID-document upload failed —
    // questionnaires are keyed by (tenantId, email), not userId, so match by
    // lowercased email in JS (Prisma `in` has no insensitive mode). Failed
    // uploads per tenant are few, so the unfiltered fetch is cheap.
    prisma.consultation_questionnaires.findMany({
      where: { tenantId, idDocumentStatus: "UPLOAD_FAILED" },
      select: { email: true },
    }),
  ]);

  const failedIdUploadEmails = new Set(
    failedIdUploads.map((q: { email: string }) => q.email.toLowerCase()),
  );

  return NextResponse.json({
    customers: customers.map((customer: { email: string }) => ({
      ...customer,
      idUploadFailed: failedIdUploadEmails.has(customer.email.toLowerCase()),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});
