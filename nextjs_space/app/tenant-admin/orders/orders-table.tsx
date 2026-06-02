"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  Package,
  Search,
  Eye,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Download,
  ShoppingCart,
} from "lucide-react";
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
  type RowPillTone,
} from "@/components/admin/shared";
import type { StatusFilterOption, BulkAction } from "@/components/admin/shared";
import { useTableState } from "@/lib/admin/url-state";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { exportToCSV } from "@/lib/admin/csv-export";

import { OrdersDateRangeFilter } from "./orders-table-date-filter";
import { OrdersBulkConfirmDialog } from "./orders-table-confirm-dialog";
import type {
  OrderStatus,
  DateRangePreset,
  OrderFilters,
  BulkActionType,
  OrdersTableProps,
} from "./orders-table-types";

export function OrdersTable({
  orders,
  totalCount,
  statusCounts,
  onViewOrder,
}: OrdersTableProps) {
  const router = useRouter();
  const [
    { search, filters, page, pageSize, sort },
    { setSearch, setFilter, setPage, setPageSize, setSort },
  ] = useTableState<OrderFilters>({
    defaultFilters: {
      status: "all",
      dateRange: "all",
      dateFrom: "",
      dateTo: "",
    },
    defaultPageSize: 20,
  });

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [confirmAction, setConfirmAction] = useState<BulkActionType>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const statusFilter = filters.status || "all";
  const dateRangeFilter = filters.dateRange || "all";
  const dateFromFilter = filters.dateFrom || "";
  const dateToFilter = filters.dateTo || "";

  const totalSearchCount =
    statusCounts.PENDING +
    statusCounts.PROCESSING +
    statusCounts.COMPLETED +
    statusCounts.CANCELLED;

  const statusOptions: StatusFilterOption<OrderStatus>[] = useMemo(
    () => [
      { value: "all", label: "All Orders", count: totalSearchCount },
      { value: "PENDING", label: "Pending", count: statusCounts.PENDING },
      {
        value: "PROCESSING",
        label: "Processing",
        count: statusCounts.PROCESSING,
      },
      { value: "COMPLETED", label: "Completed", count: statusCounts.COMPLETED },
      { value: "CANCELLED", label: "Cancelled", count: statusCounts.CANCELLED },
    ],
    [totalSearchCount, statusCounts],
  );

  const handleQuickFilter = (status: OrderStatus) => {
    if (statusFilter === status) {
      setFilter("status", "all");
    } else {
      setFilter("status", status);
    }
  };

  const handleDateRangePreset = (preset: DateRangePreset) => {
    setFilter("dateRange", preset);
    if (preset !== "custom") {
      setFilter("dateFrom", "");
      setFilter("dateTo", "");
      setCustomDateFrom(undefined);
      setCustomDateTo(undefined);
    }
  };

  const handleCustomDateSelect = () => {
    if (customDateFrom && customDateTo) {
      setFilter("dateRange", "custom");
      setFilter("dateFrom", format(customDateFrom, "yyyy-MM-dd"));
      setFilter("dateTo", format(customDateTo, "yyyy-MM-dd"));
      setCalendarOpen(false);
    }
  };

  const handleClearFilters = () => {
    setSearch("");
    setFilter("status", "all");
    setFilter("dateRange", "all");
    setFilter("dateFrom", "");
    setFilter("dateTo", "");
    setCustomDateFrom(undefined);
    setCustomDateTo(undefined);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case "PROCESSING":
        return <Truck className="w-3.5 h-3.5" />;
      case "PENDING":
        return <Clock className="w-3.5 h-3.5" />;
      case "CANCELLED":
        return <XCircle className="w-3.5 h-3.5" />;
      default:
        return <Package className="w-3.5 h-3.5" />;
    }
  };

  const getStatusTone = (status: string): RowPillTone => {
    switch (status) {
      case "COMPLETED":
        return "emerald";
      case "PROCESSING":
        return "blue";
      case "PENDING":
      case "PENDING_SYNC":
        return "amber";
      case "CANCELLED":
        return "red";
      default:
        return "slate";
    }
  };

  const getDateRangeLabel = () => {
    switch (dateRangeFilter) {
      case "7days":
        return "Last 7 days";
      case "30days":
        return "Last 30 days";
      case "90days":
        return "Last 90 days";
      case "custom":
        if (dateFromFilter && dateToFilter) {
          return `${format(parseISO(dateFromFilter), "MMM d")} - ${format(parseISO(dateToFilter), "MMM d, yyyy")}`;
        }
        return "Custom range";
      default:
        return "All time";
    }
  };

  const hasSearchQuery = search.trim().length > 0;
  const hasStatusFilter = statusFilter !== "all";
  const hasDateFilter = dateRangeFilter !== "all";
  const hasFilters = hasSearchQuery || hasStatusFilter || hasDateFilter;
  const noResults = totalCount === 0 && hasFilters;

  const emptyDescription = useMemo(() => {
    const activeFilters: string[] = [];
    if (hasStatusFilter) activeFilters.push(statusFilter.toLowerCase());
    if (hasDateFilter) activeFilters.push(getDateRangeLabel().toLowerCase());

    if (hasSearchQuery && activeFilters.length > 0) {
      return `No orders match "${search}" with the selected filters. Try adjusting your filters.`;
    }
    if (hasSearchQuery) {
      return `No orders match "${search}". Try a different search term.`;
    }
    if (activeFilters.length > 0) {
      return `No orders found with the selected filters.`;
    }
    return "No orders found.";
  }, [hasSearchQuery, hasStatusFilter, hasDateFilter, search, statusFilter]);

  const isAllSelected =
    orders.length > 0 && orders.every((o) => selectedIds.has(o.id));
  const isSomeSelected =
    orders.some((o) => selectedIds.has(o.id)) && !isAllSelected;

  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        orders.forEach((o) => next.delete(o.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        orders.forEach((o) => next.add(o.id));
        return next;
      });
    }
  }, [isAllSelected, orders]);

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

  const handleMarkProcessing = useCallback(() => {
    setConfirmAction("mark-processing");
  }, []);

  const handleMarkCompleted = useCallback(() => {
    setConfirmAction("mark-completed");
  }, []);

  const handleExportAll = useCallback(async () => {
    if (orders.length === 0) return;

    const exportData = orders.map((o) => ({
      orderNumber: o.orderNumber,
      customerName: o.user?.name || "Guest",
      customerEmail: o.user?.email || "N/A",
      status: o.status,
      items: o.items.length,
      total: `$${o.total.toFixed(2)}`,
      createdAt: format(new Date(o.createdAt), "yyyy-MM-dd"),
    }));

    const csvHeaders = [
      { key: "orderNumber" as const, label: "Order Number" },
      { key: "customerName" as const, label: "Customer Name" },
      { key: "customerEmail" as const, label: "Customer Email" },
      { key: "status" as const, label: "Status" },
      { key: "items" as const, label: "Items" },
      { key: "total" as const, label: "Total" },
      { key: "createdAt" as const, label: "Date" },
    ];

    await exportToCSV(
      exportData,
      csvHeaders,
      "orders",
      undefined,
      (recordCount, fileSize) => {
        toast.success(`Exported ${recordCount} orders to CSV (${fileSize})`);
      },
      (error) => {
        toast.error(`Export failed: ${error.message}`);
      },
    );
  }, [orders]);

  const handleExportCSV = useCallback(async () => {
    const selectedOrders = orders.filter((o) => selectedIds.has(o.id));
    if (selectedOrders.length === 0) return;

    const exportData = selectedOrders.map((o) => ({
      orderNumber: o.orderNumber,
      customerName: o.user?.name || "Guest",
      customerEmail: o.user?.email || "N/A",
      status: o.status,
      items: o.items.length,
      total: `$${o.total.toFixed(2)}`,
      createdAt: format(new Date(o.createdAt), "yyyy-MM-dd"),
    }));

    const csvHeaders = [
      { key: "orderNumber" as const, label: "Order Number" },
      { key: "customerName" as const, label: "Customer Name" },
      { key: "customerEmail" as const, label: "Customer Email" },
      { key: "status" as const, label: "Status" },
      { key: "items" as const, label: "Items" },
      { key: "total" as const, label: "Total" },
      { key: "createdAt" as const, label: "Date" },
    ];

    await exportToCSV(
      exportData,
      csvHeaders,
      "orders",
      undefined,
      (recordCount, fileSize) => {
        toast.success(
          `Exported ${recordCount} selected orders to CSV (${fileSize})`,
        );
        clearSelection();
      },
      (error) => {
        toast.error(`Export failed: ${error.message}`);
      },
    );
  }, [orders, selectedIds, clearSelection]);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction || selectedIds.size === 0) return;

    setIsProcessing(true);

    try {
      const response = await fetch("/api/tenant-admin/orders/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: confirmAction,
          orderIds: Array.from(selectedIds),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to perform action");
      }

      const actionMessages: Record<string, string> = {
        "mark-processing": "marked as Processing",
        "mark-completed": "marked as Completed",
      };

      toast.success(
        `${data.count} order${data.count === 1 ? "" : "s"} ${actionMessages[confirmAction]} successfully`,
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
        id: "mark-processing",
        label: "Mark Processing",
        icon: Truck,
        onClick: handleMarkProcessing,
        variant: "default",
      },
      {
        id: "mark-completed",
        label: "Mark Completed",
        icon: CheckCircle2,
        onClick: handleMarkCompleted,
        variant: "outline",
      },
      {
        id: "export",
        label: "Export CSV",
        icon: Download,
        onClick: handleExportCSV,
        variant: "outline",
      },
    ],
    [handleMarkProcessing, handleMarkCompleted, handleExportCSV],
  );

  const selectedOrderNumbers = useMemo(() => {
    return orders
      .filter((o) => selectedIds.has(o.id))
      .map((o) => `#${o.orderNumber.slice(-8).toUpperCase()}`)
      .slice(0, 5);
  }, [orders, selectedIds]);

  return (
    <>
      <div className="bs-card overflow-hidden">
        <div className="border-b border-bs-border-100 px-6 py-5">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-bs-border-100 bg-bs-card-2 p-2.5">
                  <ShoppingCart className="h-5 w-5 text-bs-green-soft" aria-hidden="true" />
                </div>
                <h2
                  className="text-[22px] text-bs-fg"
                  style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
                >
                  {hasFilters
                    ? `Results (${totalCount})`
                    : `All Orders (${totalSearchCount})`}
                </h2>
              </div>

              <div className="flex flex-col gap-3 w-full xl:w-auto xl:flex-row xl:items-center">
                <div className="w-full xl:w-72">
                  <SearchInput
                    value={search}
                    onChange={setSearch}
                    placeholder="Search orders..."
                    aria-label="Search orders by order number, customer name, or email"
                    debounceMs={300}
                  />
                </div>

                <StatusFilter<OrderStatus>
                  value={statusFilter}
                  onChange={(value) => setFilter("status", value)}
                  options={statusOptions}
                  aria-label="Filter by order status"
                  placeholder="All Orders"
                  showIcon={false}
                  className="w-full xl:w-[160px]"
                />

                <OrdersDateRangeFilter
                  open={calendarOpen}
                  onOpenChange={setCalendarOpen}
                  dateRangeFilter={dateRangeFilter}
                  dateRangeLabel={getDateRangeLabel()}
                  onPresetSelect={handleDateRangePreset}
                  customDateFrom={customDateFrom}
                  onCustomDateFromChange={setCustomDateFrom}
                  customDateTo={customDateTo}
                  onCustomDateToChange={setCustomDateTo}
                  onApplyCustom={handleCustomDateSelect}
                />

                <ExportButton
                  onExport={handleExportAll}
                  recordCount={orders.length}
                  theme="tenant-admin"
                  disabled={orders.length === 0}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-bs-fg-muted mr-1">
                Quick filters:
              </span>

              <button
                type="button"
                onClick={() => handleQuickFilter("PENDING")}
                className={cn(
                  "bs-btn bs-btn-sm gap-1.5 rounded-full",
                  statusFilter === "PENDING" ? "bs-btn-green" : "bs-btn-ghost",
                )}
              >
                <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />
                Needs Attention
                <RowPill tone="amber" className="ml-1">
                  {statusCounts.PENDING}
                </RowPill>
              </button>

              <button
                type="button"
                onClick={() => handleQuickFilter("PROCESSING")}
                className={cn(
                  "bs-btn bs-btn-sm gap-1.5 rounded-full",
                  statusFilter === "PROCESSING"
                    ? "bs-btn-green"
                    : "bs-btn-ghost",
                )}
              >
                <Loader2 className="w-3.5 h-3.5" aria-hidden="true" />
                In Progress
                <RowPill tone="emerald" className="ml-1">
                  {statusCounts.PROCESSING}
                </RowPill>
              </button>

              {hasFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="inline-flex items-center gap-1 px-2 py-1 text-sm text-bs-fg-muted hover:text-bs-fg transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                  Clear all
                </button>
              )}
            </div>
          </div>
        </div>

        <div>
          {noResults ? (
            <EmptyState
              icon={Search}
              heading="No orders found"
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
          ) : orders.length === 0 && !hasFilters ? (
            <EmptyState
              icon={ShoppingCart}
              heading="No orders yet"
              description="Your orders will appear here once customers start purchasing from your store."
              size="lg"
              theme="purple"
              showDecoration
              className="my-8"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="bs-table w-full">
                <thead>
                  <tr>
                    <th className="w-12">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label={
                          isAllSelected
                            ? "Deselect all orders"
                            : "Select all orders"
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
                      columnKey="orderNumber"
                      label="Order ID"
                      sortState={sort}
                      onSort={setSort}
                    />
                    <th className="text-left">Customer</th>
                    <SortableTableHeader
                      columnKey="status"
                      label="Status"
                      sortState={sort}
                      onSort={setSort}
                    />
                    <th className="text-center">Items</th>
                    <SortableTableHeader
                      columnKey="total"
                      label="Total"
                      sortState={sort}
                      onSort={setSort}
                      align="right"
                    />
                    <SortableTableHeader
                      columnKey="createdAt"
                      label="Date"
                      sortState={sort}
                      onSort={setSort}
                    />
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const isSelected = selectedIds.has(order.id);
                    return (
                      <tr
                        key={order.id}
                        className={cn(
                          "transition-colors hover:bg-bs-card-2",
                          isSelected && "bg-bs-card-2/60",
                        )}
                      >
                        <td className="w-12">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) =>
                              handleSelectOne(order.id, checked === true)
                            }
                            aria-label={`Select order ${order.orderNumber.slice(-8).toUpperCase()}`}
                            className="border-bs-border data-[state=checked]:bg-bs-green-soft data-[state=checked]:border-bs-green-soft"
                          />
                        </td>
                        <td className="font-mono font-medium text-bs-fg">
                          #{order.orderNumber.slice(-8).toUpperCase()}
                        </td>
                        <td>
                          <div>
                            <p className="font-medium text-bs-fg">
                              {order.user?.name || "Guest"}
                            </p>
                            <p className="text-sm text-bs-fg-muted">
                              {order.user?.email || "N/A"}
                            </p>
                          </div>
                        </td>
                        <td>
                          <RowPill tone={getStatusTone(order.status)}>
                            {getStatusIcon(order.status)}
                            {order.status}
                          </RowPill>
                        </td>
                        <td className="text-center text-bs-fg-muted">
                          {order.items.length}
                        </td>
                        <td className="text-right font-mono tabular-nums font-medium text-bs-fg">
                          €{order.total.toFixed(2)}
                        </td>
                        <td className="font-mono text-bs-fg-muted">
                          {format(new Date(order.createdAt), "MMM d, yyyy")}
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => onViewOrder(order)}
                            className="bs-btn bs-btn-ghost bs-btn-sm gap-2"
                          >
                            <Eye className="w-4 h-4" aria-hidden="true" />
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {orders.length > 0 && (
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
        itemLabel="orders"
        actions={bulkActions}
        onClearSelection={clearSelection}
      />

      <OrdersBulkConfirmDialog
        confirmAction={confirmAction}
        selectedCount={selectedIds.size}
        selectedOrderNumbers={selectedOrderNumbers}
        isProcessing={isProcessing}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirmAction}
      />
    </>
  );
}
