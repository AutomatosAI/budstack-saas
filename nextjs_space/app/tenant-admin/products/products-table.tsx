'use client';

import { useMemo } from 'react';
import { Package, Search, Leaf } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { SearchInput, StatusFilter, EmptyState, Pagination, SortableTableHeader } from '@/components/admin/shared';
import type { StatusFilterOption } from '@/components/admin/shared';
import { useTableState } from '@/lib/admin/url-state';

/** Filter types for product table */
type CategoryFilter = 'all' | 'flower' | 'edibles' | 'concentrates' | 'pre-rolls' | 'topicals' | 'accessories';
type StockFilter = 'all' | 'in-stock' | 'out-of-stock';

/** Typed filters for product table - uses Record index signature for URL state compatibility */
type ProductFilters = {
  category: CategoryFilter;
  stock: StockFilter;
} & Record<string, string>;

/**
 * Product data shape from Prisma query
 */
interface Product {
  id: string;
  name: string;
  category: string;
  slug: string | null;
  thcContent: number | null;
  cbdContent: number | null;
  price: number;
  stock: number;
  createdAt: Date;
}

interface ProductsTableProps {
  /** Array of product data from server (paginated and filtered) */
  products: Product[];
  /** Total count of filtered products (for pagination) */
  totalCount: number;
  /** Count of in-stock products (with search applied) */
  inStockCount: number;
  /** Count of out-of-stock products (with search applied) */
  outOfStockCount: number;
  /** Category counts map (with search applied) */
  categoryCounts: Record<string, number>;
}

/**
 * ProductsTable - Client component for displaying products with search, filter, and pagination.
 *
 * Features:
 * - Server-side pagination with URL state (?page=, ?pageSize=)
 * - Debounced search across name, category, slug fields
 * - Category filter (Flower, Edibles, Concentrates, Pre-Rolls, Topicals, Accessories)
 * - Stock status filter (In Stock, Out of Stock)
 * - Case-insensitive filtering
 * - URL state persistence (?search=, ?category=, ?stock=, ?page=, ?pageSize=)
 * - Empty state for no results
 */
export function ProductsTable({
  products,
  totalCount,
  inStockCount,
  outOfStockCount,
  categoryCounts,
}: ProductsTableProps) {
  const [{ search, filters, page, pageSize, sort }, { setSearch, setFilter, setPage, setPageSize, setSort }] = useTableState<ProductFilters>({
    defaultFilters: { category: 'all', stock: 'all' },
    defaultPageSize: 20,
  });

  const categoryFilter = filters.category || 'all';
  const stockFilter = filters.stock || 'all';

  // Total products matching search (regardless of category/stock filter)
  const totalSearchCount = inStockCount + outOfStockCount;

  // Category filter options with server-provided counts
  const categoryOptions: StatusFilterOption<CategoryFilter>[] = useMemo(
    () => [
      { value: 'all', label: 'All Categories', count: totalSearchCount },
      { value: 'flower', label: 'Flower', count: categoryCounts.flower || 0 },
      { value: 'edibles', label: 'Edibles', count: categoryCounts.edibles || 0 },
      { value: 'concentrates', label: 'Concentrates', count: categoryCounts.concentrates || 0 },
      { value: 'pre-rolls', label: 'Pre-Rolls', count: categoryCounts['pre-rolls'] || 0 },
      { value: 'topicals', label: 'Topicals', count: categoryCounts.topicals || 0 },
      { value: 'accessories', label: 'Accessories', count: categoryCounts.accessories || 0 },
    ],
    [totalSearchCount, categoryCounts]
  );

  // Stock filter options with server-provided counts
  const stockOptions: StatusFilterOption<StockFilter>[] = useMemo(
    () => [
      { value: 'all', label: 'All Stock', count: totalSearchCount },
      { value: 'in-stock', label: 'In Stock', count: inStockCount },
      { value: 'out-of-stock', label: 'Out of Stock', count: outOfStockCount },
    ],
    [totalSearchCount, inStockCount, outOfStockCount]
  );

  const hasSearchQuery = search.trim().length > 0;
  const hasCategoryFilter = categoryFilter !== 'all';
  const hasStockFilter = stockFilter !== 'all';
  const hasFilters = hasSearchQuery || hasCategoryFilter || hasStockFilter;
  const noResults = totalCount === 0 && hasFilters;

  // Build description for empty state
  const emptyDescription = useMemo(() => {
    const activeFilters: string[] = [];
    if (hasCategoryFilter) activeFilters.push(categoryFilter);
    if (hasStockFilter) activeFilters.push(stockFilter === 'in-stock' ? 'in stock' : 'out of stock');

    if (hasSearchQuery && activeFilters.length > 0) {
      return `No products match "${search}" with the selected filters. Try adjusting your filters.`;
    }
    if (hasSearchQuery) {
      return `No products match "${search}". Try a different search term.`;
    }
    if (activeFilters.length > 0) {
      return `No products found with the selected filters.`;
    }
    return 'No products found.';
  }, [hasSearchQuery, hasCategoryFilter, hasStockFilter, search, categoryFilter, stockFilter]);

  // Clear filters handler
  const handleClearFilters = () => {
    setSearch('');
    setFilter('category', 'all');
    setFilter('stock', 'all');
  };

  // Get strain badge color (using hash for demo since strain isn't in schema)
  const getStrainBadgeClasses = (productName: string) => {
    const nameHash = productName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const strainIndex = nameHash % 3;
    switch (strainIndex) {
      case 0: // Sativa
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 1: // Indica
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 2: // Hybrid
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStrainLabel = (productName: string) => {
    const nameHash = productName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const strainTypes = ['Sativa', 'Indica', 'Hybrid'];
    return strainTypes[nameHash % 3];
  };

  return (
    <Card className="shadow-lg border-slate-200">
      <CardHeader className="border-b bg-gradient-to-r from-emerald-50 to-teal-50">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <CardTitle className="flex items-center gap-3">
            <span className="text-2xl font-bold text-slate-900">
              {hasFilters
                ? `Results (${totalCount})`
                : `All Products (${totalSearchCount})`}
            </span>
            <Badge variant="outline" className="text-sm font-normal">
              {inStockCount} In Stock
            </Badge>
          </CardTitle>

          {/* Search and Filter Controls */}
          <div className="flex flex-col gap-3 w-full xl:w-auto">
            {/* Search Input - Full width on mobile */}
            <div className="w-full xl:w-72">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search products..."
                aria-label="Search products"
                debounceMs={300}
              />
            </div>

            {/* Filters Row - Wraps on smaller screens */}
            <div className="flex flex-wrap gap-2">
              {/* Category Filter */}
              <StatusFilter<CategoryFilter>
                value={categoryFilter}
                onChange={(value) => setFilter('category', value)}
                options={categoryOptions}
                aria-label="Filter by category"
                placeholder="All Categories"
                showIcon={false}
                className="w-[150px]"
              />

              {/* Stock Filter */}
              <StatusFilter<StockFilter>
                value={stockFilter}
                onChange={(value) => setFilter('stock', value)}
                options={stockOptions}
                aria-label="Filter by stock status"
                placeholder="All Stock"
                showIcon={false}
                className="w-[140px]"
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {noResults ? (
          <EmptyState
            icon={Search}
            heading="No products found"
            description={emptyDescription}
            variant="muted"
            size="default"
            action={{
              label: 'Clear filters',
              onClick: handleClearFilters,
              variant: 'outline',
            }}
            className="my-8"
          />
        ) : products.length === 0 && !hasFilters ? (
          <EmptyState
            icon={Package}
            heading="No products yet"
            description="Sync your products from Dr Green Admin to get started."
            size="default"
            className="my-8"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <SortableTableHeader
                    columnKey="name"
                    label="Name"
                    sortState={sort}
                    onSort={setSort}
                  />
                  <SortableTableHeader
                    columnKey="category"
                    label="Category"
                    sortState={sort}
                    onSort={setSort}
                  />
                  <TableHead className="font-semibold text-slate-700">Strain</TableHead>
                  <SortableTableHeader
                    columnKey="thcContent"
                    label="THC %"
                    sortState={sort}
                    onSort={setSort}
                    align="center"
                  />
                  <SortableTableHeader
                    columnKey="cbdContent"
                    label="CBD %"
                    sortState={sort}
                    onSort={setSort}
                    align="center"
                  />
                  <SortableTableHeader
                    columnKey="price"
                    label="Price"
                    sortState={sort}
                    onSort={setSort}
                    align="right"
                  />
                  <SortableTableHeader
                    columnKey="stock"
                    label="Stock"
                    sortState={sort}
                    onSort={setSort}
                    align="center"
                  />
                  <TableHead className="font-semibold text-slate-700">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow
                    key={product.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <TableCell className="font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                          <Leaf className="h-4 w-4 text-emerald-600" />
                        </div>
                        <span className="truncate max-w-[200px]">{product.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 capitalize">
                      {product.category || <span className="text-slate-400">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStrainBadgeClasses(product.name)}>
                        {getStrainLabel(product.name)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-slate-700 font-mono text-sm">
                      {product.thcContent != null ? `${product.thcContent}%` : '—'}
                    </TableCell>
                    <TableCell className="text-center text-slate-700 font-mono text-sm">
                      {product.cbdContent != null ? `${product.cbdContent}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right text-slate-700 font-medium">
                      €{typeof product.price === 'number' ? product.price.toFixed(2) : product.price}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`inline-flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-full text-sm font-medium ${
                        product.stock > 0
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {product.stock}
                      </span>
                    </TableCell>
                    <TableCell>
                      {product.stock > 0 ? (
                        <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">
                          In Stock
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                          Out of Stock
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Controls */}
        {products.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50/50">
            <Pagination
              page={page}
              pageSize={pageSize}
              totalItems={totalCount}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 20, 50, 100]}
              showPageSizeSelector
              showFirstLast
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
