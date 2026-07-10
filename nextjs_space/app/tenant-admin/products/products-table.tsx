"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  Package,
  Search,
  PackageCheck,
  PackageMinus,
  Download,
  Trash2,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Checkbox } from "@/components/ui/checkbox";
import {
  SearchInput,
  StatusFilter,
  EmptyState,
  Pagination,
  SortableTableHeader,
  BulkActionBar,
  ExportButton,
  RowPill,
} from "@/components/admin/shared";
import type { StatusFilterOption, BulkAction } from "@/components/admin/shared";
import { useTableState } from "@/lib/admin/url-state";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { exportToCSV } from "@/lib/admin/csv-export";

import { SortableProductRow } from "./products-table-row";
import { ProductsBulkConfirmDialog } from "./products-table-confirm-dialog";
import type {
  CategoryFilter,
  StockFilter,
  BulkActionType,
  ProductFilters,
  Product,
  ProductsTableProps,
} from "./products-table-types";

export function ProductsTable({
  products,
  totalCount,
  inStockCount,
  outOfStockCount,
  categoryCounts,
  currencySymbol = "R",
}: ProductsTableProps) {
  const router = useRouter();
  const [
    { search, filters, page, pageSize, sort },
    { setSearch, setFilter, setPage, setPageSize, setSort },
  ] = useTableState<ProductFilters>({
    defaultFilters: { category: "all", stock: "all" },
    defaultPageSize: 20,
  });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [confirmAction, setConfirmAction] = useState<BulkActionType>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [orderedProducts, setOrderedProducts] = useState<Product[]>(products);
  const [isSavingOrder, setIsSavingOrder] = useState(false);

  useMemo(() => {
    setOrderedProducts(products);
  }, [products]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const categoryFilter = filters.category || "all";
  const stockFilter = filters.stock || "all";

  const totalSearchCount = inStockCount + outOfStockCount;

  const categoryOptions: StatusFilterOption<CategoryFilter>[] = useMemo(
    () => [
      { value: "all", label: "All Categories", count: totalSearchCount },
      { value: "flower", label: "Flower", count: categoryCounts.flower || 0 },
      {
        value: "edibles",
        label: "Edibles",
        count: categoryCounts.edibles || 0,
      },
      {
        value: "concentrates",
        label: "Concentrates",
        count: categoryCounts.concentrates || 0,
      },
      {
        value: "pre-rolls",
        label: "Pre-Rolls",
        count: categoryCounts["pre-rolls"] || 0,
      },
      {
        value: "topicals",
        label: "Topicals",
        count: categoryCounts.topicals || 0,
      },
      {
        value: "accessories",
        label: "Accessories",
        count: categoryCounts.accessories || 0,
      },
    ],
    [totalSearchCount, categoryCounts],
  );

  const stockOptions: StatusFilterOption<StockFilter>[] = useMemo(
    () => [
      { value: "all", label: "All Stock", count: totalSearchCount },
      { value: "in-stock", label: "In Stock", count: inStockCount },
      { value: "out-of-stock", label: "Out of Stock", count: outOfStockCount },
    ],
    [totalSearchCount, inStockCount, outOfStockCount],
  );

  const hasSearchQuery = search.trim().length > 0;
  const hasCategoryFilter = categoryFilter !== "all";
  const hasStockFilter = stockFilter !== "all";
  const hasFilters = hasSearchQuery || hasCategoryFilter || hasStockFilter;
  const noResults = totalCount === 0 && hasFilters;

  const emptyDescription = useMemo(() => {
    const activeFilters: string[] = [];
    if (hasCategoryFilter) activeFilters.push(categoryFilter);
    if (hasStockFilter)
      activeFilters.push(
        stockFilter === "in-stock" ? "in stock" : "out of stock",
      );

    if (hasSearchQuery && activeFilters.length > 0) {
      return `No products match "${search}" with the selected filters. Try adjusting your filters.`;
    }
    if (hasSearchQuery) {
      return `No products match "${search}". Try a different search term.`;
    }
    if (activeFilters.length > 0) {
      return `No products found with the selected filters.`;
    }
    return "No products found.";
  }, [
    hasSearchQuery,
    hasCategoryFilter,
    hasStockFilter,
    search,
    categoryFilter,
    stockFilter,
  ]);

  const handleClearFilters = () => {
    setSearch("");
    setFilter("category", "all");
    setFilter("stock", "all");
  };

  const isAllSelected =
    products.length > 0 && products.every((p) => selectedIds.has(p.id));
  const isSomeSelected =
    products.some((p) => selectedIds.has(p.id)) && !isAllSelected;

  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        products.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
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

  const handleSetInStock = useCallback(() => {
    setConfirmAction("set-in-stock");
  }, []);

  const handleSetOutOfStock = useCallback(() => {
    setConfirmAction("set-out-of-stock");
  }, []);

  const handleDelete = useCallback(() => {
    setConfirmAction("delete");
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = orderedProducts.findIndex((p) => p.id === active.id);
      const newIndex = orderedProducts.findIndex((p) => p.id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const newOrder = arrayMove(orderedProducts, oldIndex, newIndex);
      setOrderedProducts(newOrder);

      setIsSavingOrder(true);
      try {
        const orderUpdates = newOrder.map((product, index) => ({
          id: product.id,
          displayOrder: index,
        }));

        const response = await fetch("/api/tenant-admin/products/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ products: orderUpdates }),
        });

        if (!response.ok) {
          throw new Error("Failed to update product order");
        }

        toast.success("Product order updated successfully");
        router.refresh();
      } catch (error) {
        console.error("Error updating product order:", error);
        toast.error("Failed to update product order");
        setOrderedProducts(products);
      } finally {
        setIsSavingOrder(false);
      }
    },
    [orderedProducts, products, router],
  );

  const handleExportAll = useCallback(async () => {
    if (products.length === 0) return;

    const exportData = products.map((p) => ({
      name: p.name,
      category: p.category || "",
      thcContent: p.thcContent != null ? `${p.thcContent}%` : "",
      cbdContent: p.cbdContent != null ? `${p.cbdContent}%` : "",
      price: `${currencySymbol}${p.price.toFixed(2)}`,
      stock: p.stock,
      status: p.stock > 0 ? "In Stock" : "Out of Stock",
      createdAt: format(new Date(p.createdAt), "yyyy-MM-dd"),
    }));

    const csvHeaders = [
      { key: "name" as const, label: "Name" },
      { key: "category" as const, label: "Category" },
      { key: "thcContent" as const, label: "THC %" },
      { key: "cbdContent" as const, label: "CBD %" },
      { key: "price" as const, label: "Price" },
      { key: "stock" as const, label: "Stock" },
      { key: "status" as const, label: "Status" },
      { key: "createdAt" as const, label: "Created" },
    ];

    await exportToCSV(
      exportData,
      csvHeaders,
      "products",
      undefined,
      (recordCount, fileSize) => {
        toast.success(`Exported ${recordCount} products to CSV (${fileSize})`);
      },
      (error) => {
        toast.error(`Export failed: ${error.message}`);
      },
    );
  }, [products, currencySymbol]);

  const handleExportCSV = useCallback(async () => {
    const selectedProducts = products.filter((p) => selectedIds.has(p.id));
    if (selectedProducts.length === 0) return;

    const exportData = selectedProducts.map((p) => ({
      name: p.name,
      category: p.category || "",
      thcContent: p.thcContent != null ? `${p.thcContent}%` : "",
      cbdContent: p.cbdContent != null ? `${p.cbdContent}%` : "",
      price: `${currencySymbol}${p.price.toFixed(2)}`,
      stock: p.stock,
      status: p.stock > 0 ? "In Stock" : "Out of Stock",
      createdAt: format(new Date(p.createdAt), "yyyy-MM-dd"),
    }));

    const csvHeaders = [
      { key: "name" as const, label: "Name" },
      { key: "category" as const, label: "Category" },
      { key: "thcContent" as const, label: "THC %" },
      { key: "cbdContent" as const, label: "CBD %" },
      { key: "price" as const, label: "Price" },
      { key: "stock" as const, label: "Stock" },
      { key: "status" as const, label: "Status" },
      { key: "createdAt" as const, label: "Created" },
    ];

    await exportToCSV(
      exportData,
      csvHeaders,
      "products",
      undefined,
      (recordCount, fileSize) => {
        toast.success(
          `Exported ${recordCount} selected products to CSV (${fileSize})`,
        );
        clearSelection();
      },
      (error) => {
        toast.error(`Export failed: ${error.message}`);
      },
    );
  }, [products, selectedIds, clearSelection, currencySymbol]);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction || selectedIds.size === 0) return;

    setIsProcessing(true);

    try {
      const response = await fetch("/api/tenant-admin/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: confirmAction,
          productIds: Array.from(selectedIds),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to perform action");
      }

      const actionMessages: Record<string, string> = {
        "set-in-stock": "set to In Stock",
        "set-out-of-stock": "set to Out of Stock",
        delete: "deleted",
      };

      toast.success(
        `${data.count} product${data.count === 1 ? "" : "s"} ${actionMessages[confirmAction]} successfully`,
      );

      clearSelection();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsProcessing(false);
      setConfirmAction(null);
    }
  }, [confirmAction, selectedIds, clearSelection, router]);

  const bulkActions: BulkAction[] = useMemo(
    () => [
      {
        id: "set-in-stock",
        label: "Set In Stock",
        icon: PackageCheck,
        onClick: handleSetInStock,
        variant: "default",
      },
      {
        id: "set-out-of-stock",
        label: "Set Out of Stock",
        icon: PackageMinus,
        onClick: handleSetOutOfStock,
        variant: "outline",
      },
      {
        id: "export",
        label: "Export CSV",
        icon: Download,
        onClick: handleExportCSV,
        variant: "outline",
      },
      {
        id: "delete",
        label: "Delete",
        icon: Trash2,
        onClick: handleDelete,
        variant: "destructive",
      },
    ],
    [handleSetInStock, handleSetOutOfStock, handleExportCSV, handleDelete],
  );

  const selectedProductNames = useMemo(() => {
    return products
      .filter((p) => selectedIds.has(p.id))
      .map((p) => p.name)
      .slice(0, 5);
  }, [products, selectedIds]);

  const getStrainLabel = (productName: string) => {
    const nameHash = productName
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const strainTypes = ["Sativa", "Indica", "Hybrid"];
    return strainTypes[nameHash % 3];
  };

  return (
    <>
      <div className="bs-card overflow-hidden">
        <div className="border-b border-bs-border-100 px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-bs-border-100 bg-bs-card-2 p-2.5">
                <Package className="h-5 w-5 text-bs-green-soft" aria-hidden="true" />
              </div>
              <h2
                className="text-[22px] text-bs-fg"
                style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
              >
                {hasFilters
                  ? `Results (${totalCount})`
                  : `All Products (${totalSearchCount})`}
              </h2>
              <RowPill tone="gold" className="text-sm font-normal">
                {inStockCount} In Stock
              </RowPill>
            </div>

            <div className="flex flex-col gap-3 w-full xl:w-auto">
              <div className="w-full xl:w-72">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search products..."
                  aria-label="Search products"
                  debounceMs={300}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <StatusFilter<CategoryFilter>
                  value={categoryFilter}
                  onChange={(value) => setFilter("category", value)}
                  options={categoryOptions}
                  aria-label="Filter by category"
                  placeholder="All Categories"
                  showIcon={false}
                  className="w-[150px]"
                />

                <StatusFilter<StockFilter>
                  value={stockFilter}
                  onChange={(value) => setFilter("stock", value)}
                  options={stockOptions}
                  aria-label="Filter by stock status"
                  placeholder="All Stock"
                  showIcon={false}
                  className="w-[140px]"
                />

                <ExportButton
                  onExport={handleExportAll}
                  recordCount={products.length}
                  theme="tenant-admin"
                  disabled={products.length === 0}
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          {noResults ? (
            <EmptyState
              icon={Search}
              heading="No products found"
              description={emptyDescription}
              variant="muted"
              size="default"
              action={{
                label: "Clear filters",
                onClick: handleClearFilters,
                variant: "outline",
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
              className="my-8"
            />
          ) : (
            <div className="overflow-x-auto">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <table className="bs-table w-full">
                  <thead>
                    <tr>
                      <th className="w-12 hidden md:table-cell" />
                      <th className="w-12 hidden sm:table-cell">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={handleSelectAll}
                          aria-label={
                            isAllSelected
                              ? "Deselect all products"
                              : "Select all products"
                          }
                          className={cn(
                            "border-bs-border data-[state=checked]:bg-bs-green-soft data-[state=checked]:border-bs-green-soft",
                            isSomeSelected &&
                              "data-[state=checked]:bg-bs-green-soft/60",
                          )}
                          {...(isSomeSelected && { "data-state": "checked" })}
                        />
                      </th>
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
                        className="hidden md:table-cell"
                      />
                      <th className="hidden lg:table-cell text-left">Strain</th>
                      <SortableTableHeader
                        columnKey="thcContent"
                        label="THC %"
                        sortState={sort}
                        onSort={setSort}
                        align="center"
                        className="hidden lg:table-cell"
                      />
                      <SortableTableHeader
                        columnKey="cbdContent"
                        label="CBD %"
                        sortState={sort}
                        onSort={setSort}
                        align="center"
                        className="hidden lg:table-cell"
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
                        className="hidden sm:table-cell"
                      />
                      <th className="text-left">Status</th>
                    </tr>
                  </thead>
                  <SortableContext
                    items={orderedProducts.map((p) => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <tbody>
                      {orderedProducts.map((product) => (
                        <SortableProductRow
                          key={product.id}
                          product={product}
                          isSelected={selectedIds.has(product.id)}
                          onSelectOne={handleSelectOne}
                          getStrainLabel={getStrainLabel}
                          currencySymbol={currencySymbol}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </table>
              </DndContext>
            </div>
          )}

          {products.length > 0 && (
            <div className="border-t border-bs-border-100 bg-bs-card-2">
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
        </div>
      </div>

      <BulkActionBar
        selectedCount={selectedIds.size}
        itemLabel="products"
        actions={bulkActions}
        onClearSelection={clearSelection}
      />

      <ProductsBulkConfirmDialog
        confirmAction={confirmAction}
        selectedCount={selectedIds.size}
        selectedProductNames={selectedProductNames}
        isProcessing={isProcessing}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
      />
    </>
  );
}
