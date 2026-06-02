"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ExternalLink,
  Building2,
  Search,
  CheckCircle2,
  XCircle,
  Download,
  FileCheck,
  Eye,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { getTenantUrl } from "@/lib/tenant/tenant-utils";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import {
  sectionTitleStyle,
  type Tenant,
  type TenantStatusFilter,
  type TenantFilters,
  type TenantsTableProps,
  type BulkActionType,
} from "./tenants-table-helpers";
import { exportTenantsToCSV } from "./tenants-csv-export";
import { TenantBulkConfirmDialog } from "./tenant-bulk-confirm-dialog";

/**
 * TenantsTable - Client component for displaying tenants with search, filter, pagination, and bulk actions.
 *
 * Features:
 * - Server-side pagination with URL state (?page=, ?pageSize=)
 * - Debounced search across businessName, subdomain, customDomain, nftTokenId
 * - Status filter (All, Active, Inactive) with counts
 * - Case-insensitive filtering
 * - URL state persistence (?search=, ?status=, ?page=, ?pageSize=)
 * - Bulk selection with select all / individual checkboxes
 * - Bulk actions: Activate, Deactivate, Export CSV
 * - Confirmation dialogs for destructive actions
 * - Empty state for no results
 */
export function TenantsTable({
  tenants,
  totalCount,
  activeCount,
  inactiveCount,
}: TenantsTableProps) {
  const router = useRouter();
  const [
    { search, filters, page, pageSize, sort },
    { setSearch, setFilter, setPage, setPageSize, setSort },
  ] = useTableState<TenantFilters>({
    defaultFilters: { status: "all" },
    defaultPageSize: 20,
  });

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<BulkActionType>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const statusFilter = filters.status || "all";

  // Status filter options with server-provided counts
  const statusOptions: StatusFilterOption<TenantStatusFilter>[] = useMemo(
    () => [
      {
        value: "all",
        label: "All Tenants",
        count: activeCount + inactiveCount,
      },
      { value: "active", label: "Active Only", count: activeCount },
      { value: "inactive", label: "Inactive Only", count: inactiveCount },
    ],
    [activeCount, inactiveCount],
  );

  // Server-side filtering is now applied - tenants array is already filtered
  const hasSearchQuery = search.trim().length > 0;
  const hasStatusFilter = statusFilter !== "all";
  const hasFilters = hasSearchQuery || hasStatusFilter;
  const noResults = totalCount === 0 && hasFilters;

  // Build description for empty state
  const emptyDescription = useMemo(() => {
    if (hasSearchQuery && hasStatusFilter) {
      const statusLabel = statusFilter === "active" ? "active" : "inactive";
      return `No ${statusLabel} tenants match "${search}". Try adjusting your filters.`;
    }
    if (hasSearchQuery) {
      return `No tenants match "${search}". Try a different search term.`;
    }
    if (hasStatusFilter) {
      const statusLabel = statusFilter === "active" ? "active" : "inactive";
      return `No ${statusLabel} tenants found.`;
    }
    return "No tenants found.";
  }, [hasSearchQuery, hasStatusFilter, search, statusFilter]);

  // Total count for display (all tenants matching search, regardless of status filter)
  const totalSearchCount = activeCount + inactiveCount;

  // Clear filters handler
  const handleClearFilters = () => {
    setSearch("");
    setFilter("status", "all");
  };

  // Selection handlers
  const isAllSelected =
    tenants.length > 0 && tenants.every((t) => selectedIds.has(t.id));
  const isSomeSelected =
    tenants.some((t) => selectedIds.has(t.id)) && !isAllSelected;

  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      // Deselect all on current page
      setSelectedIds((prev) => {
        const next = new Set(prev);
        tenants.forEach((t) => next.delete(t.id));
        return next;
      });
    } else {
      // Select all on current page
      setSelectedIds((prev) => {
        const next = new Set(prev);
        tenants.forEach((t) => next.add(t.id));
        return next;
      });
    }
  }, [isAllSelected, tenants]);

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
  const handleBulkActivate = useCallback(() => {
    setConfirmAction("activate");
  }, []);

  const handleBulkDeactivate = useCallback(() => {
    setConfirmAction("deactivate");
  }, []);

  // Export ALL filtered tenants (the main export button)
  const handleExportAll = useCallback(async () => {
    await exportTenantsToCSV(
      tenants,
      (recordCount, fileSize) => {
        toast.success(`Exported ${recordCount} tenants to CSV (${fileSize})`);
      },
      (error) => {
        toast.error(`Export failed: ${error.message}`);
      },
    );
  }, [tenants]);

  // Export SELECTED tenants (for bulk action bar)
  const handleExportCSV = useCallback(async () => {
    const selectedTenants = tenants.filter((t) => selectedIds.has(t.id));
    await exportTenantsToCSV(
      selectedTenants,
      (recordCount, fileSize) => {
        toast.success(
          `Exported ${recordCount} selected tenants to CSV (${fileSize})`,
        );
        clearSelection();
      },
      (error) => {
        toast.error(`Export failed: ${error.message}`);
      },
    );
  }, [tenants, selectedIds, clearSelection]);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction || selectedIds.size === 0) return;

    setIsProcessing(true);

    try {
      const response = await fetch("/api/super-admin/tenants/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: confirmAction,
          tenantIds: Array.from(selectedIds),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to perform action");
      }

      toast.success(
        `${data.count} tenant${data.count === 1 ? "" : "s"} ${confirmAction}d successfully`,
      );

      // Clear selection and refresh
      clearSelection();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "An error occurred");
    } finally {
      setIsProcessing(false);
      setConfirmAction(null);
    }
  }, [confirmAction, selectedIds, clearSelection, router]);

  // Bulk actions configuration
  const bulkActions: BulkAction[] = useMemo(
    () => [
      {
        id: "activate",
        label: "Activate",
        icon: CheckCircle2,
        onClick: handleBulkActivate,
        variant: "default",
      },
      {
        id: "deactivate",
        label: "Deactivate",
        icon: XCircle,
        onClick: handleBulkDeactivate,
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
    [handleBulkActivate, handleBulkDeactivate, handleExportCSV],
  );

  // Get selected tenant names for confirmation dialog
  const selectedTenantNames = useMemo(() => {
    return tenants
      .filter((t) => selectedIds.has(t.id))
      .map((t) => t.businessName)
      .slice(0, 5);
  }, [tenants, selectedIds]);

  return (
    <>
      <div className="bs-card overflow-hidden">
        <div className="border-b border-bs-border-100 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-bs-md bg-bs-card-2 border border-bs-border-100 p-2.5">
                <Building2
                  className="h-5 w-5 text-bs-green"
                  aria-hidden="true"
                />
              </div>
              <h2
                className="text-[22px] leading-tight text-bs-fg"
                style={sectionTitleStyle}
              >
                {hasFilters
                  ? `Results (${totalCount})`
                  : `All Tenants (${totalSearchCount})`}
              </h2>
            </div>

            {/* Search and Filter Controls */}
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              {/* Search Input */}
              <div className="w-full sm:w-72">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search tenants..."
                  aria-label="Search tenants"
                  debounceMs={300}
                />
              </div>

              {/* Status Filter */}
              <StatusFilter<TenantStatusFilter>
                value={statusFilter}
                onChange={(value) => setFilter("status", value)}
                options={statusOptions}
                aria-label="Filter by status"
                placeholder="All Tenants"
              />

              {/* Export Button */}
              <ExportButton
                onExport={handleExportAll}
                recordCount={tenants.length}
                theme="super-admin"
                disabled={tenants.length === 0}
              />
            </div>
          </div>
        </div>

        <div>
          {noResults ? (
            <EmptyState
              icon={Search}
              heading="No tenants found"
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
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-bs-card-2/50">
                    {/* Select All Checkbox */}
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label={
                          isAllSelected
                            ? "Deselect all tenants"
                            : "Select all tenants"
                        }
                        className={cn(
                          "border-bs-border-100 data-[state=checked]:bg-bs-green data-[state=checked]:border-bs-green",
                          isSomeSelected &&
                            "data-[state=checked]:bg-bs-green/60",
                        )}
                        {...(isSomeSelected && { "data-state": "checked" })}
                      />
                    </TableHead>
                    <SortableTableHeader
                      columnKey="businessName"
                      label="Business Name"
                      sortState={sort}
                      onSort={setSort}
                    />
                    <SortableTableHeader
                      columnKey="nftTokenId"
                      label="NFT Token ID"
                      sortState={sort}
                      onSort={setSort}
                      className="hidden lg:table-cell"
                    />
                    <SortableTableHeader
                      columnKey="subdomain"
                      label="Store URL"
                      sortState={sort}
                      onSort={setSort}
                      className="hidden md:table-cell"
                    />
                    <SortableTableHeader
                      columnKey="isActive"
                      label="Status"
                      sortState={sort}
                      onSort={setSort}
                    />
                    <TableHead className="font-semibold text-center hidden lg:table-cell">
                      Users
                    </TableHead>
                    <TableHead className="font-semibold text-center hidden lg:table-cell">
                      Products
                    </TableHead>
                    <TableHead className="font-semibold text-center hidden lg:table-cell">
                      Orders
                    </TableHead>
                    <SortableTableHeader
                      columnKey="createdAt"
                      label="Created"
                      sortState={sort}
                      onSort={setSort}
                      className="hidden sm:table-cell"
                    />
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-48">
                        <EmptyState
                          icon={Building2}
                          heading="No tenants yet"
                          description="Review pending applications to onboard new tenants to the platform."
                          size="default"
                          theme="slate"
                          showDecoration
                          action={{
                            label: "Review Applications",
                            href: "/super-admin/onboarding",
                            icon: FileCheck,
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    tenants.map((tenant) => {
                      const tenantUrl = getTenantUrl(tenant);
                      const isSelected = selectedIds.has(tenant.id);
                      return (
                        <TableRow
                          key={tenant.id}
                          className={cn(
                            "hover:bg-bs-card-2/40 transition-colors",
                            isSelected && "bg-bs-card-2/60",
                          )}
                        >
                          {/* Row Checkbox */}
                          <TableCell className="w-12">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) =>
                                handleSelectOne(tenant.id, checked === true)
                              }
                              aria-label={`Select ${tenant.businessName}`}
                              className="border-bs-border-100 data-[state=checked]:bg-bs-green data-[state=checked]:border-bs-green"
                            />
                          </TableCell>
                          <TableCell className="font-medium text-bs-fg">
                            <div className="min-w-0">
                              <span className="block truncate">
                                {tenant.businessName}
                              </span>
                              {/* Show subdomain on mobile where Store URL column is hidden */}
                              <a
                                href={tenantUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-xs text-bs-green mt-0.5 md:hidden hover:underline truncate font-mono"
                              >
                                {tenant.subdomain}.budstack.io
                              </a>
                            </div>
                          </TableCell>
                          <TableCell
                            className="text-bs-fg-muted font-mono text-sm hidden lg:table-cell max-w-[200px] truncate"
                            title={tenant.nftTokenId || ""}
                          >
                            {tenant.nftTokenId || (
                              <span className="text-bs-fg-muted">N/A</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <a
                              href={tenantUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-bs-green hover:text-bs-green/80 hover:underline flex items-center gap-1 transition-colors font-mono text-sm"
                            >
                              <span className="truncate max-w-[200px]">
                                {tenantUrl}
                              </span>
                              <ExternalLink
                                className="h-3 w-3 flex-shrink-0"
                                aria-hidden="true"
                              />
                            </a>
                          </TableCell>
                          <TableCell>
                            <RowPill
                              tone={tenant.isActive ? "emerald" : "slate"}
                              aria-label={`Status: ${tenant.isActive ? "Active" : "Inactive"}`}
                            >
                              {tenant.isActive ? "Active" : "Inactive"}
                            </RowPill>
                          </TableCell>
                          <TableCell className="text-center hidden lg:table-cell">
                            <RowPill tone="blue">
                              {tenant._count.users}
                            </RowPill>
                          </TableCell>
                          <TableCell className="text-center hidden lg:table-cell">
                            <RowPill tone="emerald">
                              {tenant._count.products}
                            </RowPill>
                          </TableCell>
                          <TableCell className="text-center hidden lg:table-cell">
                            <RowPill tone="gold">
                              {tenant._count.orders}
                            </RowPill>
                          </TableCell>
                          <TableCell className="text-bs-fg-muted text-sm hidden sm:table-cell font-mono">
                            {format(new Date(tenant.createdAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/super-admin/tenants/${tenant.id}`}
                              className="bs-btn bs-btn-ghost bs-btn-sm gap-1.5"
                            >
                              <Eye
                                className="h-4 w-4"
                                aria-hidden="true"
                              />
                              View
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {tenants.length > 0 && (
            <div className="border-t border-bs-border-100 bg-bs-card-2/40">
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

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        itemLabel="tenants"
        actions={bulkActions}
        onClearSelection={clearSelection}
      />

      {/* Confirmation Dialog */}
      <TenantBulkConfirmDialog
        confirmAction={confirmAction}
        onClose={() => setConfirmAction(null)}
        selectedCount={selectedIds.size}
        selectedTenantNames={selectedTenantNames}
        isProcessing={isProcessing}
        onConfirm={handleConfirmAction}
      />
    </>
  );
}
