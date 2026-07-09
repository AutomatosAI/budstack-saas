import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePagePermission } from "@/lib/permissions/require-page-permission";
import { Prisma } from "@prisma/client";
import { ProductsTable } from "./products-table";
import { SyncButton } from "./sync-button";

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
  await requirePagePermission("canViewProducts");
  const user = await currentUser();

  if (
    !user ||
    (user.publicMetadata.role !== "TENANT_ADMIN" &&
      user.publicMetadata.role !== "SUPER_ADMIN")
  ) {
    redirect("/auth/login");
  }

  const email = user.emailAddresses[0]?.emailAddress;
  const localUser = await prisma.users.findFirst({
    where: { email: email },
    select: { tenantId: true },
  });

  if (!localUser?.tenantId) {
    redirect("/tenant-admin");
  }

  const tenantId = localUser.tenantId;

  // Get tenant currency symbol from country code
  const tenant = await prisma.tenants.findUnique({
    where: { id: tenantId },
    select: { countryCode: true },
  });
  const CURRENCY_SYMBOLS: Record<string, string> = {
    ZA: "R", ZAR: "R", GB: "£", GBP: "£", US: "$", USD: "$",
    EU: "€", EUR: "€", PT: "€", DE: "€", FR: "€", ES: "€",
    IT: "€", NL: "€", BE: "€", AT: "€", IE: "€", GR: "€",
    CA: "C$", AU: "A$", NZ: "NZ$", CH: "CHF", SE: "kr",
  };
  const currencySymbol = CURRENCY_SYMBOLS[tenant?.countryCode || "ZA"] || "R";

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
      <div className="bs-page-header-compact flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="bs-page-title"
            style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
          >
            Product Catalog
          </h1>
          <p className="bs-page-subtitle">
            Manage your product catalog and inventory.
          </p>
        </div>
        <div className="flex justify-start sm:justify-end">
          <SyncButton />
        </div>
      </div>

      <ProductsTable
        products={products}
        totalCount={filteredCount}
        inStockCount={inStockCount}
        outOfStockCount={outOfStockCount}
        categoryCounts={categoryCountsMap}
        currencySymbol={currencySymbol}
      />
    </div>
  );
}
