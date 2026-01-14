import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { Users } from "lucide-react";
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
  const session = await getServerSession(authOptions);

  if (
    !session ||
    !["TENANT_ADMIN", "SUPER_ADMIN"].includes(session.user.role!)
  ) {
    redirect("/auth/login");
  }

  // Tenant admins only see their own customers
  const tenantId =
    session.user.role === "TENANT_ADMIN" ? session.user.tenantId : undefined;

  if (!tenantId && session.user.role === "TENANT_ADMIN") {
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

  // Build Prisma where clause for server-side filtering
  const whereClause: Prisma.usersWhereInput = {
    role: "PATIENT",
    ...(tenantId && { tenantId }),
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

  const [filteredCount, customers, totalCustomersCount, recentSignupsCount] =
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
        },
      }),
      // Count recent sign-ups (last 30 days)
      prisma.users.count({
        where: {
          role: "PATIENT",
          ...(tenantId && { tenantId }),
          createdAt: { gte: thirtyDaysAgo },
        },
      }),
    ]);

  return (
    <div className="space-y-8">
      {/* Centered Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="section-badge mb-4 inline-flex">
          <Users className="h-4 w-4" />
          Customers
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Customer Management
        </h1>
        <p className="mt-3 text-muted-foreground">
          Manage your customer base and view engagement metrics.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card-floating p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Total Customers
              </p>
              <p className="font-display text-3xl font-bold tracking-tight text-foreground">
                {totalCustomersCount}
              </p>
              <p className="text-xs text-muted-foreground">Registered users</p>
            </div>
            <div className="rounded-2xl bg-primary p-3">
              <Users className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>

        <div className="card-floating p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Active Customers
              </p>
              <p className="font-display text-3xl font-bold tracking-tight text-foreground">
                {totalCustomersCount}
              </p>
              <p className="text-xs text-muted-foreground">Currently active</p>
            </div>
            <div className="rounded-2xl bg-emerald-500 p-3">
              <Users className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>

        <div className="card-floating p-6">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                Recent Sign-ups
              </p>
              <p className="font-display text-3xl font-bold tracking-tight text-foreground">
                {recentSignupsCount}
              </p>
              <p className="text-xs text-muted-foreground">Last 30 days</p>
            </div>
            <div className="rounded-2xl bg-purple-600 p-3">
              <Users className="h-5 w-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Customers Table with Search and Pagination */}
      <CustomersTable customers={customers} totalCount={filteredCount} />
    </div>
  );
}
