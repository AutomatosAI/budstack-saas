import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { Package, RefreshCw } from "lucide-react";
import { ProductsTable } from "./products-table";

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
  const orderBy: any = sortBy
    ? { [sortBy]: sortOrder }
    : { displayOrder: "asc" };

  // Get filtered count and paginated products in parallel
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
    }
  );

  return (
    <div className="space-y-8">
      {/* Centered Header with Absolute Right Button */}
      <div className="relative mb-8">
        <div className="text-center max-w-2xl mx-auto">
          <div className="section-badge mb-4 inline-flex">
            <Package className="h-4 w-4" />
            Products
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Product Catalog
          </h1>
          <p className="mt-3 text-muted-foreground">
            Manage your product catalog and inventory.
          </p>
        </div>
        <div className="mt-4 flex justify-center sm:absolute sm:right-0 sm:top-0 sm:mt-0">
          <Button variant="hero" size="lg" className="rounded-xl shadow-lg hover:shadow-xl transition-all">
            <RefreshCw className="mr-2 h-4 w-4" />
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
