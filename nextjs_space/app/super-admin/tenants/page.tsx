import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { TenantsTable } from "./tenants-table";

/** Default pagination settings */
const DEFAULT_PAGE_SIZE = 20;
const VALID_PAGE_SIZES = [10, 20, 50, 100];

/** Valid sort columns for tenants table */
const VALID_SORT_COLUMNS = [
  "businessName",
  "subdomain",
  "nftTokenId",
  "createdAt",
  "isActive",
] as const;
type SortColumn = (typeof VALID_SORT_COLUMNS)[number];

interface TenantsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function TenantsPage({ searchParams }: TenantsPageProps) {
  const user = await currentUser();

  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/sign-in");
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

  // Parse search and filter params from URL
  const search = typeof params.search === "string" ? params.search.trim() : "";
  const statusFilter =
    typeof params.status === "string" ? params.status : "all";

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
  const whereClause: Prisma.tenantsWhereInput = {};

  // Apply search filter (case-insensitive across multiple fields)
  if (search) {
    whereClause.OR = [
      { businessName: { contains: search, mode: "insensitive" } },
      { subdomain: { contains: search, mode: "insensitive" } },
      { customDomain: { contains: search, mode: "insensitive" } },
      { nftTokenId: { contains: search, mode: "insensitive" } },
    ];
  }

  // Apply status filter
  if (statusFilter === "active") {
    whereClause.isActive = true;
  } else if (statusFilter === "inactive") {
    whereClause.isActive = false;
  }

  // Calculate skip for pagination
  const skip = (page - 1) * pageSize;

  // Build orderBy clause - default to createdAt desc if no sort specified
  const orderBy: Prisma.tenantsOrderByWithRelationInput = sortBy
    ? { [sortBy]: sortOrder }
    : { createdAt: "desc" };

  // Get filtered count and paginated tenants in parallel
  // Also get counts for filter badges (active/inactive)
  const [filteredCount, tenants, activeCount, inactiveCount] =
    await Promise.all([
      prisma.tenants.count({ where: whereClause }),
      prisma.tenants.findMany({
        where: whereClause,
        include: {
          _count: {
            select: {
              users: true,
              products: true,
              orders: true,
            },
          },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      // Count active tenants (with search applied if present)
      prisma.tenants.count({
        where: {
          ...(search
            ? {
              OR: [
                { businessName: { contains: search, mode: "insensitive" } },
                { subdomain: { contains: search, mode: "insensitive" } },
                { customDomain: { contains: search, mode: "insensitive" } },
                { nftTokenId: { contains: search, mode: "insensitive" } },
              ],
            }
            : {}),
          isActive: true,
        },
      }),
      // Count inactive tenants (with search applied if present)
      prisma.tenants.count({
        where: {
          ...(search
            ? {
              OR: [
                { businessName: { contains: search, mode: "insensitive" } },
                { subdomain: { contains: search, mode: "insensitive" } },
                { customDomain: { contains: search, mode: "insensitive" } },
                { nftTokenId: { contains: search, mode: "insensitive" } },
              ],
            }
            : {}),
          isActive: false,
        },
      }),
    ]);

  return (
    <div className="space-y-8">
      {/* Centered Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="section-badge mb-4 inline-flex">
          Tenants
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          All Tenants
        </h1>
        <p className="mt-3 text-muted-foreground">
          Manage all tenant accounts and NFT holders from a single view.
        </p>
        <div className="mt-6">
          <Link href="/super-admin/onboarding">
            <Button variant="hero" size="lg" className="rounded-xl">
              Review Applications
            </Button>
          </Link>
        </div>
      </div>

      {/* Tenants Table with Search and Pagination */}
      <TenantsTable
        tenants={tenants}
        totalCount={filteredCount}
        activeCount={activeCount}
        inactiveCount={inactiveCount}
      />
    </div>
  );
}
