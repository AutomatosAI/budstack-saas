'use client';

import { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  Package,
  Search,
  Leaf,
  PackageCheck,
  PackageMinus,
  Download,
  Trash2,
  AlertTriangle,
  RefreshCw,
  GripVertical,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  SearchInput,
  StatusFilter,
  EmptyState,
  Pagination,
  SortableTableHeader,
  BulkActionBar,
  ExportButton,
} from '@/components/admin/shared';
import type { StatusFilterOption, BulkAction } from '@/components/admin/shared';
import { useTableState } from '@/lib/admin/url-state';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { exportToCSV } from '@/lib/admin/csv-export';

/** Filter types for product table */
type CategoryFilter = 'all' | 'flower' | 'edibles' | 'concentrates' | 'pre-rolls' | 'topicals' | 'accessories';
type StockFilter = 'all' | 'in-stock' | 'out-of-stock';

/** Type for bulk action confirmation dialog */
type BulkActionType = 'set-in-stock' | 'set-out-of-stock' | 'delete' | null;

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
  displayOrder: number;
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
 * SortableProductRow - Draggable table row component
 */
interface SortableProductRowProps {
  product: Product;
  isSelected: boolean;
  onSelectOne: (id: string, checked: boolean) => void;
  getStrainBadgeClasses: (name: string) => string;
  getStrainLabel: (name: string) => string;
}

function SortableProductRow({
  product,
  isSelected,
  onSelectOne,
  getStrainBadgeClasses,
  getStrainLabel,
}: SortableProductRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={cn(
        'hover:bg-slate-50 transition-colors',
        isSelected && 'bg-emerald-50/70',
        isDragging && 'relative z-50 shadow-lg'
      )}
    >
      {/* Drag Handle */}
      <TableCell className="w-12 cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
        <GripVertical className="h-5 w-5 text-slate-400 hover:text-slate-600 transition-colors" />
      </TableCell>

      {/* Row Checkbox */}
      <TableCell className="w-12">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(checked) => onSelectOne(product.id, checked === true)}
          aria-label={`Select ${product.name}`}
          className="border-emerald-400 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
        />
      </TableCell>

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
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-slate-100 text-slate-700'
        }`}>
          {product.stock}
        </span>
      </TableCell>

      <TableCell>
        <Badge
          className={cn(
            'font-medium',
            product.stock > 0
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
          )}
          aria-label={`Status: ${product.stock > 0 ? 'In Stock' : 'Out of Stock'}`}
        >
          {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
        </Badge>
      </TableCell>
    </TableRow>
  );
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
  const router = useRouter();
  const [{ search, filters, page, pageSize, sort }, { setSearch, setFilter, setPage, setPageSize, setSort }] = useTableState<ProductFilters>({
    defaultFilters: { category: 'all', stock: 'all' },
    defaultPageSize: 20,
  });

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<BulkActionType>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Drag-and-drop state - local ordering of products
  const [orderedProducts, setOrderedProducts] = useState<Product[]>(products);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  // Update ordered products when products prop changes
  useMemo(() => {
    setOrderedProducts(products);
  }, [products]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  // Selection handlers
  const isAllSelected =
    products.length > 0 && products.every((p) => selectedIds.has(p.id));
  const isSomeSelected =
    products.some((p) => selectedIds.has(p.id)) && !isAllSelected;

  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      // Deselect all on current page
      setSelectedIds((prev) => {
        const next = new Set(prev);
        products.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      // Select all on current page
      setSelectedIds((prev) => {
        const next = new Set(prev);
        products.forEach((p) => next.add(p.id));
        return next;
      });
    }
  }, [isAllSelected, products]);

  const handleSelectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Bulk action handlers
  const handleSetInStock = useCallback(() => {
    setConfirmAction('set-in-stock');
  }, []);

  const handleSetOutOfStock = useCallback(() => {
    setConfirmAction('set-out-of-stock');
  }, []);

  const handleDelete = useCallback(() => {
    setConfirmAction('delete');
  }, []);

  // Drag end handler
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = orderedProducts.findIndex((p) => p.id === active.id);
    const newIndex = orderedProducts.findIndex((p) => p.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Update local state immediately for smooth UX
    const newOrder = arrayMove(orderedProducts, oldIndex, newIndex);
    setOrderedProducts(newOrder);

    // Persist to server
    setIsSavingOrder(true);
    try {
      const orderUpdates = newOrder.map((product, index) => ({
        id: product.id,
        displayOrder: index,
      }));

      const response = await fetch('/api/tenant-admin/products/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: orderUpdates }),
      });

      if (!response.ok) {
        throw new Error('Failed to update product order');
      }

      toast.success('Product order updated successfully');
      router.refresh();
    } catch (error) {
      console.error('Error updating product order:', error);
      toast.error('Failed to update product order');
      // Revert to original order on error
      setOrderedProducts(products);
    } finally {
      setIsSavingOrder(false);
    }
  }, [orderedProducts, products, router]);

  // Export ALL filtered products (the main export button)
  const handleExportAll = useCallback(async () => {
    if (products.length === 0) return;

    const exportData = products.map((p) => ({
      name: p.name,
      category: p.category || '',
      thcContent: p.thcContent != null ? `${p.thcContent}%` : '',
      cbdContent: p.cbdContent != null ? `${p.cbdContent}%` : '',
      price: `$${p.price.toFixed(2)}`,
      stock: p.stock,
      status: p.stock > 0 ? 'In Stock' : 'Out of Stock',
      createdAt: format(new Date(p.createdAt), 'yyyy-MM-dd'),
    }));

    const csvHeaders = [
      { key: 'name' as const, label: 'Name' },
      { key: 'category' as const, label: 'Category' },
      { key: 'thcContent' as const, label: 'THC %' },
      { key: 'cbdContent' as const, label: 'CBD %' },
      { key: 'price' as const, label: 'Price' },
      { key: 'stock' as const, label: 'Stock' },
      { key: 'status' as const, label: 'Status' },
      { key: 'createdAt' as const, label: 'Created' },
    ];

    await exportToCSV(
      exportData,
      csvHeaders,
      'products',
      undefined,
      (recordCount, fileSize) => {
        toast.success(`Exported ${recordCount} products to CSV (${fileSize})`);
      },
      (error) => {
        toast.error(`Export failed: ${error.message}`);
      }
    );
  }, [products]);

  // Export SELECTED products (for bulk action bar)
  const handleExportCSV = useCallback(async () => {
    const selectedProducts = products.filter((p) => selectedIds.has(p.id));
    if (selectedProducts.length === 0) return;

    const exportData = selectedProducts.map((p) => ({
      name: p.name,
      category: p.category || '',
      thcContent: p.thcContent != null ? `${p.thcContent}%` : '',
      cbdContent: p.cbdContent != null ? `${p.cbdContent}%` : '',
      price: `$${p.price.toFixed(2)}`,
      stock: p.stock,
      status: p.stock > 0 ? 'In Stock' : 'Out of Stock',
      createdAt: format(new Date(p.createdAt), 'yyyy-MM-dd'),
    }));

    const csvHeaders = [
      { key: 'name' as const, label: 'Name' },
      { key: 'category' as const, label: 'Category' },
      { key: 'thcContent' as const, label: 'THC %' },
      { key: 'cbdContent' as const, label: 'CBD %' },
      { key: 'price' as const, label: 'Price' },
      { key: 'stock' as const, label: 'Stock' },
      { key: 'status' as const, label: 'Status' },
      { key: 'createdAt' as const, label: 'Created' },
    ];

    await exportToCSV(
      exportData,
      csvHeaders,
      'products',
      undefined,
      (recordCount, fileSize) => {
        toast.success(`Exported ${recordCount} selected products to CSV (${fileSize})`);
        clearSelection();
      },
      (error) => {
        toast.error(`Export failed: ${error.message}`);
      }
    );
  }, [products, selectedIds, clearSelection]);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction || selectedIds.size === 0) return;

    setIsProcessing(true);

    try {
      const response = await fetch('/api/tenant-admin/products/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: confirmAction,
          productIds: Array.from(selectedIds),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to perform action');
      }

      // Display appropriate success message
      const actionMessages: Record<string, string> = {
        'set-in-stock': 'set to In Stock',
        'set-out-of-stock': 'set to Out of Stock',
        'delete': 'deleted',
      };

      toast.success(
        `${data.count} product${data.count === 1 ? '' : 's'} ${actionMessages[confirmAction]} successfully`
      );

      // Clear selection and refresh
      clearSelection();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'An error occurred'
      );
    } finally {
      setIsProcessing(false);
      setConfirmAction(null);
    }
  }, [confirmAction, selectedIds, clearSelection, router]);

  // Bulk actions configuration
  const bulkActions: BulkAction[] = useMemo(
    () => [
      {
        id: 'set-in-stock',
        label: 'Set In Stock',
        icon: PackageCheck,
        onClick: handleSetInStock,
        variant: 'default',
      },
      {
        id: 'set-out-of-stock',
        label: 'Set Out of Stock',
        icon: PackageMinus,
        onClick: handleSetOutOfStock,
        variant: 'outline',
      },
      {
        id: 'export',
        label: 'Export CSV',
        icon: Download,
        onClick: handleExportCSV,
        variant: 'outline',
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: Trash2,
        onClick: handleDelete,
        variant: 'destructive',
      },
    ],
    [handleSetInStock, handleSetOutOfStock, handleExportCSV, handleDelete]
  );

  // Get selected product names for confirmation dialog
  const selectedProductNames = useMemo(() => {
    return products
      .filter((p) => selectedIds.has(p.id))
      .map((p) => p.name)
      .slice(0, 5);
  }, [products, selectedIds]);

  // Get strain badge color (using hash for demo since strain isn't in schema)
  // Updated with darker text colors for WCAG AA compliance (4.5:1 contrast on light backgrounds)
  const getStrainBadgeClasses = (productName: string) => {
    const nameHash = productName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const strainIndex = nameHash % 3;
    switch (strainIndex) {
      case 0: // Sativa
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 1: // Indica
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 2: // Hybrid
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getStrainLabel = (productName: string) => {
    const nameHash = productName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const strainTypes = ['Sativa', 'Indica', 'Hybrid'];
    return strainTypes[nameHash % 3];
  };

  return (
    <>
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

              {/* Export Button */}
              <ExportButton
                onExport={handleExportAll}
                recordCount={products.length}
                theme="tenant-admin"
                disabled={products.length === 0}
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
            description="Sync your products from Dr Green Admin to get started with your store catalog."
            size="lg"
            theme="emerald"
            showDecoration
            action={{
              label: 'Sync from Dr Green Admin',
              href: '/tenant-admin/settings',
              icon: RefreshCw,
            }}
            className="my-8"
          />
        ) : (
          <div className="overflow-x-auto">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    {/* Drag Handle Column */}
                    <TableHead className="w-12" />
                    {/* Select All Checkbox */}
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label={
                          isAllSelected
                            ? 'Deselect all products'
                            : 'Select all products'
                        }
                        className={cn(
                          'border-emerald-400 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600',
                          isSomeSelected && 'data-[state=checked]:bg-emerald-400'
                        )}
                        {...(isSomeSelected && { 'data-state': 'checked' })}
                      />
                    </TableHead>
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
              <SortableContext
                items={orderedProducts.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <TableBody>
                  {orderedProducts.map((product) => (
                    <SortableProductRow
                      key={product.id}
                      product={product}
                      isSelected={selectedIds.has(product.id)}
                      onSelectOne={handleSelectOne}
                      getStrainBadgeClasses={getStrainBadgeClasses}
                      getStrainLabel={getStrainLabel}
                    />
                  ))}
                </TableBody>
              </SortableContext>
            </Table>
          </DndContext>
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

    {/* Bulk Action Bar */}
    <BulkActionBar
      selectedCount={selectedIds.size}
      itemLabel="products"
      actions={bulkActions}
      onClearSelection={clearSelection}
    />

    {/* Confirmation Dialog */}
    <Dialog
      open={confirmAction !== null}
      onOpenChange={(open) => !open && setConfirmAction(null)}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {confirmAction === 'delete' ? (
              <>
                <Trash2 className="h-5 w-5 text-red-500" />
                <span>Delete Products</span>
              </>
            ) : confirmAction === 'set-in-stock' ? (
              <>
                <PackageCheck className="h-5 w-5 text-emerald-500" />
                <span>Set In Stock</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <span>Set Out of Stock</span>
              </>
            )}
          </DialogTitle>
          <DialogDescription className="pt-2">
            {confirmAction === 'delete' ? (
              <span className="text-red-600">
                Are you sure you want to delete{' '}
                <strong>{selectedIds.size}</strong> product
                {selectedIds.size === 1 ? '' : 's'}? This cannot be undone.
              </span>
            ) : confirmAction === 'set-in-stock' ? (
              <span>
                Set <strong>{selectedIds.size}</strong> product
                {selectedIds.size === 1 ? '' : 's'} to In Stock?
              </span>
            ) : (
              <span>
                Set <strong>{selectedIds.size}</strong> product
                {selectedIds.size === 1 ? '' : 's'} to Out of Stock?
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Show product names */}
        {selectedProductNames.length > 0 && (
          <div className="py-2">
            <p className="text-xs text-muted-foreground mb-2">
              Affected products:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {selectedProductNames.map((name) => (
                <Badge
                  key={name}
                  variant="secondary"
                  className="text-xs font-normal"
                >
                  {name}
                </Badge>
              ))}
              {selectedIds.size > 5 && (
                <Badge variant="outline" className="text-xs font-normal">
                  +{selectedIds.size - 5} more
                </Badge>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => setConfirmAction(null)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button
            variant={confirmAction === 'delete' ? 'destructive' : 'default'}
            onClick={handleConfirmAction}
            disabled={isProcessing}
            className={cn(
              confirmAction === 'set-in-stock' &&
                'bg-emerald-600 hover:bg-emerald-700',
              confirmAction === 'set-out-of-stock' &&
                'bg-amber-600 hover:bg-amber-700'
            )}
          >
            {isProcessing ? (
              <>
                <span className="animate-spin mr-2">
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </span>
                Processing...
              </>
            ) : confirmAction === 'delete' ? (
              'Delete'
            ) : confirmAction === 'set-in-stock' ? (
              'Set In Stock'
            ) : (
              'Set Out of Stock'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
