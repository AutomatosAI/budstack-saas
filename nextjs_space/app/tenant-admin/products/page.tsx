import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { ProductsTable } from "./products-table";
import { Breadcrumbs } from "@/components/admin/shared";

/** Default pagination settings */
const DEFAULT_PAGE_SIZE = 20;
const VALID_PAGE_SIZES = [10, 20, 50, 100];

/** Valid sort columns for products table */
const VALID_SORT_COLUMNS = [
  "name",
  "category",
  "price",
  "stock",
  "thcContent",
  "cbdContent",
  "createdAt",
] as const;
type SortColumn = (typeof VALID_SORT_COLUMNS)[number];

interface ProductsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const session = await getServerSession(authOptions);

  if (
    !session ||
    (session.user.role !== "TENANT_ADMIN" &&
      session.user.role !== "SUPER_ADMIN")
  ) {
    redirect("/auth/login");
  }

  const user = await prisma.users.findUnique({
    where: { id: session.user.id },
    select: { tenantId: true },
  });

  if (!user?.tenantId) {
    redirect("/tenant-admin");
  }

  const tenantId = user.tenantId;

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
  const categoryFilter =
    typeof params.category === "string" ? params.category : "all";
  const stockFilter = typeof params.stock === "string" ? params.stock : "all";

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
  const whereClause: Prisma.productsWhereInput = {
    tenantId,
  };

  // Apply search filter (case-insensitive across multiple fields)
  if (search) {
    whereClause.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { category: { contains: search, mode: "insensitive" } },
      { slug: { contains: search, mode: "insensitive" } },
    ];
  }

  // Apply category filter
  if (categoryFilter !== "all") {
    whereClause.category = { equals: categoryFilter, mode: "insensitive" };
  }

  // Apply stock filter
  if (stockFilter === "in-stock") {
    whereClause.stock = { gt: 0 };
  } else if (stockFilter === "out-of-stock") {
    whereClause.stock = { equals: 0 };
  }

  // Calculate skip for pagination
  const skip = (page - 1) * pageSize;

  // Build orderBy clause - default to displayOrder asc if no sort specified
  const orderBy: Prisma.productsOrderByWithRelationInput = sortBy
    ? { [sortBy]: sortOrder }
    : { displayOrder: "asc" };

  // Get filtered count and paginated products in parallel
  // Also get counts for filter badges
  const [
    filteredCount,
    products,
    inStockCount,
    outOfStockCount,
    categoryCounts,
  ] = await Promise.all([
    prisma.products.count({ where: whereClause }),
    prisma.products.findMany({
      where: whereClause,
      orderBy,
      skip,
      take: pageSize,
    }),
    // Count in-stock products (with search applied if present)
    prisma.products.count({
      where: {
        tenantId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { category: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
        stock: { gt: 0 },
      },
    }),
    // Count out-of-stock products (with search applied if present)
    prisma.products.count({
      where: {
        tenantId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { category: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
        stock: { equals: 0 },
      },
    }),
    // Get category counts for filter badges
    prisma.products.groupBy({
      by: ["category"],
      where: {
        tenantId,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { category: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      _count: { id: true },
    }),
  ]);

  // Transform category counts into a map
  const categoryCountsMap: Record<string, number> = {};
  categoryCounts.forEach(
    (item: { category: string | null; _count: { id: number } }) => {
      const cat = item.category?.toLowerCase() || "uncategorized";
      categoryCountsMap[cat] = item._count.id;
    },
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/tenant-admin" },
          { label: "Products" },
        ]}
        className="mb-4"
      />

      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Product Management
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1 sm:mt-2">
              Manage your product catalog
            </p>
          </div>
          <Button className="w-full sm:w-auto bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-medium shadow-md hover:shadow-lg transition-all">
            Sync from Dr Green Admin
          </Button>
        </div>
      </div>

      <ProductsTable
        products={products}
        totalCount={filteredCount}
        inStockCount={inStockCount}
        outOfStockCount={outOfStockCount}
        categoryCounts={categoryCountsMap}
      />
    </div>
  );
}
