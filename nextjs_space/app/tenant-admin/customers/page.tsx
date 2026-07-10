import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions/require-page-permission";
import { getActiveAdminTenant } from "@/lib/tenant/active-admin-tenant";
import { Prisma } from "@prisma/client";
import { ERASURE_EMAIL_DOMAIN } from "@/lib/gdpr/erasure";
import { Users, UserCheck, UserPlus } from "lucide-react";
import { StatCard } from "@/components/admin/shared";
import { CustomersTable } from "./customers-table";

/** Default pagination settings */
const DEFAULT_PAGE_SIZE = 20;
const VALID_PAGE_SIZES = [10, 20, 50, 100];

/** Valid sort columns for customers table */
const VALID_SORT_COLUMNS = ["name", "email", "createdAt"] as const;
type SortColumn = (typeof VALID_SORT_COLUMNS)[number];

interface CustomersPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function CustomersListPage({
  searchParams,
}: CustomersPageProps) {
  await requirePagePermission("canViewCustomers");
  const user = await currentUser();

  if (
    !user ||
    !["TENANT_ADMIN", "SUPER_ADMIN"].includes((user.publicMetadata.role as string) || "")
  ) {
    redirect("/auth/login");
  }

  // Tenant scope for the customer list:
  //  - TENANT_ADMIN → their own tenant
  //  - SUPER_ADMIN impersonating → the impersonated tenant (PRD-302)
  //  - SUPER_ADMIN otherwise → undefined (cross-tenant view, unchanged)
  let tenantId: string | undefined;
  const active = await getActiveAdminTenant();
  if (active?.isImpersonating) {
    tenantId = active.tenantId;
  } else if (user.publicMetadata.role === "TENANT_ADMIN") {
    const email = user.emailAddresses[0]?.emailAddress;
    const localUser = await prisma.users.findFirst({
      where: { email: email },
      select: { tenantId: true },
    });
    tenantId = localUser?.tenantId;
  }

  if (!tenantId && user.publicMetadata.role === "TENANT_ADMIN") {
    redirect("/auth/login");
  }

  // Await searchParams (Next.js 15+ async searchParams)
  const params = await searchParams;

  // Parse pagination params from URL
  const pageParam =
    typeof params.page === "string" ? parseInt(params.page, 10) : 1;
  const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

  const pageSizeParam =
    typeof params.pageSize === "string"
      ? parseInt(params.pageSize, 10)
      : DEFAULT_PAGE_SIZE;
  const pageSize = VALID_PAGE_SIZES.includes(pageSizeParam)
    ? pageSizeParam
    : DEFAULT_PAGE_SIZE;

  // Parse search param from URL
  const search = typeof params.search === "string" ? params.search.trim() : "";

  // Parse sort params from URL
  const sortByParam = typeof params.sortBy === "string" ? params.sortBy : null;
  const sortOrderParam =
    typeof params.sortOrder === "string" ? params.sortOrder : null;

  // Validate sort column
  const sortBy =
    sortByParam && VALID_SORT_COLUMNS.includes(sortByParam as SortColumn)
      ? (sortByParam as SortColumn)
      : null;
  const sortOrder =
    sortOrderParam === "asc" || sortOrderParam === "desc"
      ? sortOrderParam
      : "asc";

  // Exclude GDPR-erased (anonymized) customers from every count/list below.
  // Erasure nulls PII and rewrites the email to the deletion marker but keeps
  // the row for order-history integrity — so an erased customer still matches
  // { role: PATIENT, tenantId } and would otherwise linger as "Deleted User".
  const notErased: Prisma.usersWhereInput = {
    NOT: { email: { endsWith: `@${ERASURE_EMAIL_DOMAIN}` } },
  };

  // Build Prisma where clause for server-side filtering
  const whereClause: Prisma.usersWhereInput = {
    role: "PATIENT",
    ...(tenantId && { tenantId }),
    ...notErased,
  };

  // Apply search filter (case-insensitive across multiple fields)
  if (search) {
    whereClause.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phone: { contains: search, mode: "insensitive" } },
    ];
  }

  // Calculate skip for pagination
  const skip = (page - 1) * pageSize;

  // Build orderBy clause - default to createdAt desc if no sort specified
  const orderBy: Prisma.usersOrderByWithRelationInput = sortBy
    ? { [sortBy]: sortOrder }
    : { createdAt: "desc" };

  // Get filtered count, paginated customers, and recent sign-ups in parallel
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [filteredCount, rawCustomers, totalCustomersCount, recentSignupsCount, tenantQuestionnaires] =
    await Promise.all([
      prisma.users.count({ where: whereClause }),
      prisma.users.findMany({
        where: whereClause,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          createdAt: true,
          _count: {
            select: {
              orders: true,
            },
          },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      // Total customers count (without search filter) for stats
      prisma.users.count({
        where: {
          role: "PATIENT",
          ...(tenantId && { tenantId }),
          ...notErased,
        },
      }),
      // Count recent sign-ups (last 30 days)
      prisma.users.count({
        where: {
          role: "PATIENT",
          ...(tenantId && { tenantId }),
          ...notErased,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
      // PRD-220 Part B: customers whose inline ID-document upload failed —
      // questionnaires are keyed by (tenantId, email), not userId, so match
      // by lowercased email in JS (few failed rows per tenant; cheap fetch).
      prisma.consultation_questionnaires.findMany({
        where: {
          ...(tenantId && { tenantId }),
        },
        orderBy: { createdAt: "desc" },
        select: {
          email: true,
          idDocumentStatus: true,
          firstName: true,
          lastName: true,
          phoneCode: true,
          phoneNumber: true,
        },
      }),
    ]);

  const failedIdUploadEmails = new Set(
    tenantQuestionnaires
      .filter(
        (q: { idDocumentStatus: string | null }) =>
          q.idDocumentStatus === "UPLOAD_FAILED",
      )
      .map((q: { email: string }) => q.email.toLowerCase()),
  );
  // Backfill name/phone for customers whose intake saved the name only to
  // users.name and the phone only on the questionnaire (granular users columns
  // were left null). Latest questionnaire per email wins (rows ordered desc).
  const questionnaireByEmail = new Map<
    string,
    {
      firstName: string | null;
      lastName: string | null;
      phoneCode: string | null;
      phoneNumber: string | null;
    }
  >();
  for (const q of tenantQuestionnaires as Array<{
    email: string;
    firstName: string | null;
    lastName: string | null;
    phoneCode: string | null;
    phoneNumber: string | null;
  }>) {
    const key = q.email.toLowerCase();
    if (!questionnaireByEmail.has(key)) questionnaireByEmail.set(key, q);
  }
  const customers = rawCustomers.map(
    (customer: { email: string; name: string | null; phone: string | null }) => {
      const q = questionnaireByEmail.get(customer.email.toLowerCase());
      return {
        ...customer,
        name:
          customer.name ??
          (q ? `${q.firstName ?? ""} ${q.lastName ?? ""}`.trim() || null : null),
        phone:
          customer.phone ??
          (q?.phoneNumber ? `${q.phoneCode ?? ""} ${q.phoneNumber}`.trim() : null),
        idUploadFailed: failedIdUploadEmails.has(customer.email.toLowerCase()),
      };
    },
  );

  return (
    <div className="space-y-8">
      <header className="bs-page-header-centered">
        <h1
          className="bs-page-title"
          style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
        >
          Customer Management
        </h1>
        <p className="bs-page-subtitle">
          Manage your customer base and view engagement metrics.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          label="Total Customers"
          value={totalCustomersCount}
          icon={Users}
          hint="Registered users"
        />
        <StatCard
          label="Active Customers"
          value={totalCustomersCount}
          icon={UserCheck}
          hint="Currently active"
        />
        <StatCard
          label="Recent Sign-ups"
          value={recentSignupsCount}
          icon={UserPlus}
          hint="Last 30 days"
        />
      </div>

      <CustomersTable customers={customers} totalCount={filteredCount} />
    </div>
  );
}
