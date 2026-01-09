'use client';

import { useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  ExternalLink,
  Building2,
  Search,
  CheckCircle2,
  XCircle,
  Download,
  AlertTriangle,
  FileCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { getTenantUrl } from '@/lib/tenant-utils';
import { toast } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';
import { exportToCSV } from '@/lib/admin/csv-export';

/** Filter type for tenant status */
type TenantStatusFilter = 'all' | 'active' | 'inactive';

/** Typed filters for tenant table - uses Record index signature for URL state compatibility */
type TenantFilters = {
  status: TenantStatusFilter;
} & Record<string, string>;

/**
 * Tenant data shape from Prisma query
 */
interface Tenant {
  id: string;
  businessName: string;
  subdomain: string;
  customDomain: string | null;
  nftTokenId: string | null;
  isActive: boolean;
  createdAt: Date;
  _count: {
    users: number;
    products: number;
    orders: number;
  };
}

interface TenantsTableProps {
  /** Array of tenant data from server (paginated and filtered) */
  tenants: Tenant[];
  /** Total count of filtered tenants (for pagination) */
  totalCount: number;
  /** Count of active tenants (with search applied) */
  activeCount: number;
  /** Count of inactive tenants (with search applied) */
  inactiveCount: number;
}

/** Type for confirmation dialog action */
type BulkActionType = 'activate' | 'deactivate' | null;

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
    defaultFilters: { status: 'all' },
    defaultPageSize: 20,
  });

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Confirmation dialog state
  const [confirmAction, setConfirmAction] = useState<BulkActionType>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const statusFilter = filters.status || 'all';

  // Status filter options with server-provided counts
  const statusOptions: StatusFilterOption<TenantStatusFilter>[] = useMemo(
    () => [
      {
        value: 'all',
        label: 'All Tenants',
        count: activeCount + inactiveCount,
      },
      { value: 'active', label: 'Active Only', count: activeCount },
      { value: 'inactive', label: 'Inactive Only', count: inactiveCount },
    ],
    [activeCount, inactiveCount]
  );

  // Server-side filtering is now applied - tenants array is already filtered
  const hasSearchQuery = search.trim().length > 0;
  const hasStatusFilter = statusFilter !== 'all';
  const hasFilters = hasSearchQuery || hasStatusFilter;
  const noResults = totalCount === 0 && hasFilters;

  // Build description for empty state
  const emptyDescription = useMemo(() => {
    if (hasSearchQuery && hasStatusFilter) {
      const statusLabel = statusFilter === 'active' ? 'active' : 'inactive';
      return `No ${statusLabel} tenants match "${search}". Try adjusting your filters.`;
    }
    if (hasSearchQuery) {
      return `No tenants match "${search}". Try a different search term.`;
    }
    if (hasStatusFilter) {
      const statusLabel = statusFilter === 'active' ? 'active' : 'inactive';
      return `No ${statusLabel} tenants found.`;
    }
    return 'No tenants found.';
  }, [hasSearchQuery, hasStatusFilter, search, statusFilter]);

  // Total count for display (all tenants matching search, regardless of status filter)
  const totalSearchCount = activeCount + inactiveCount;

  // Clear filters handler
  const handleClearFilters = () => {
    setSearch('');
    setFilter('status', 'all');
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
    setConfirmAction('activate');
  }, []);

  const handleBulkDeactivate = useCallback(() => {
    setConfirmAction('deactivate');
  }, []);

  // Export ALL filtered tenants (the main export button)
  const handleExportAll = useCallback(async () => {
    if (tenants.length === 0) return;

    const headers = [
      { key: 'businessName' as keyof Tenant, label: 'Business Name' },
      { key: 'nftTokenId' as keyof Tenant, label: 'NFT Token ID' },
      { key: 'subdomain' as keyof Tenant, label: 'Subdomain' },
      { key: 'customDomain' as keyof Tenant, label: 'Custom Domain' },
      { key: 'isActive' as keyof Tenant, label: 'Status' },
      { key: '_count' as keyof Tenant, label: 'Users' },
      { key: '_count' as keyof Tenant, label: 'Products' },
      { key: '_count' as keyof Tenant, label: 'Orders' },
      { key: 'createdAt' as keyof Tenant, label: 'Created' },
    ];

    // Transform data for CSV export
    const exportData = tenants.map((t) => ({
      businessName: t.businessName,
      nftTokenId: t.nftTokenId || '',
      subdomain: t.subdomain,
      customDomain: t.customDomain || '',
      isActive: t.isActive ? 'Active' : 'Inactive',
      users: t._count.users,
      products: t._count.products,
      orders: t._count.orders,
      createdAt: format(new Date(t.createdAt), 'yyyy-MM-dd'),
    }));

    const csvHeaders = [
      { key: 'businessName' as const, label: 'Business Name' },
      { key: 'nftTokenId' as const, label: 'NFT Token ID' },
      { key: 'subdomain' as const, label: 'Subdomain' },
      { key: 'customDomain' as const, label: 'Custom Domain' },
      { key: 'isActive' as const, label: 'Status' },
      { key: 'users' as const, label: 'Users' },
      { key: 'products' as const, label: 'Products' },
      { key: 'orders' as const, label: 'Orders' },
      { key: 'createdAt' as const, label: 'Created' },
    ];

    await exportToCSV(
      exportData,
      csvHeaders,
      'tenants',
      undefined,
      (recordCount, fileSize) => {
        toast.success(`Exported ${recordCount} tenants to CSV (${fileSize})`);
      },
      (error) => {
        toast.error(`Export failed: ${error.message}`);
      }
    );
  }, [tenants]);

  // Export SELECTED tenants (for bulk action bar)
  const handleExportCSV = useCallback(async () => {
    const selectedTenants = tenants.filter((t) => selectedIds.has(t.id));
    if (selectedTenants.length === 0) return;

    const exportData = selectedTenants.map((t) => ({
      businessName: t.businessName,
      nftTokenId: t.nftTokenId || '',
      subdomain: t.subdomain,
      customDomain: t.customDomain || '',
      isActive: t.isActive ? 'Active' : 'Inactive',
      users: t._count.users,
      products: t._count.products,
      orders: t._count.orders,
      createdAt: format(new Date(t.createdAt), 'yyyy-MM-dd'),
    }));

    const csvHeaders = [
      { key: 'businessName' as const, label: 'Business Name' },
      { key: 'nftTokenId' as const, label: 'NFT Token ID' },
      { key: 'subdomain' as const, label: 'Subdomain' },
      { key: 'customDomain' as const, label: 'Custom Domain' },
      { key: 'isActive' as const, label: 'Status' },
      { key: 'users' as const, label: 'Users' },
      { key: 'products' as const, label: 'Products' },
      { key: 'orders' as const, label: 'Orders' },
      { key: 'createdAt' as const, label: 'Created' },
    ];

    await exportToCSV(
      exportData,
      csvHeaders,
      'tenants',
      undefined,
      (recordCount, fileSize) => {
        toast.success(`Exported ${recordCount} selected tenants to CSV (${fileSize})`);
        clearSelection();
      },
      (error) => {
        toast.error(`Export failed: ${error.message}`);
      }
    );
  }, [tenants, selectedIds, clearSelection]);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmAction || selectedIds.size === 0) return;

    setIsProcessing(true);

    try {
      const response = await fetch('/api/super-admin/tenants/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: confirmAction,
          tenantIds: Array.from(selectedIds),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to perform action');
      }

      toast.success(
        `${data.count} tenant${data.count === 1 ? '' : 's'} ${confirmAction}d successfully`
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
        id: 'activate',
        label: 'Activate',
        icon: CheckCircle2,
        onClick: handleBulkActivate,
        variant: 'default',
      },
      {
        id: 'deactivate',
        label: 'Deactivate',
        icon: XCircle,
        onClick: handleBulkDeactivate,
        variant: 'outline',
      },
      {
        id: 'export',
        label: 'Export CSV',
        icon: Download,
        onClick: handleExportCSV,
        variant: 'outline',
      },
    ],
    [handleBulkActivate, handleBulkDeactivate, handleExportCSV]
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
      <Card className="shadow-lg border-slate-200">
        <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle className="flex items-center gap-3">
              <span>
                {hasFilters
                  ? `Results (${totalCount})`
                  : `All Tenants (${totalSearchCount})`}
              </span>
              <Badge variant="outline" className="text-sm font-normal">
                {activeCount} Active
              </Badge>
            </CardTitle>

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
                onChange={(value) => setFilter('status', value)}
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
        </CardHeader>

        <CardContent className="p-0">
          {noResults ? (
            <EmptyState
              icon={Search}
              heading="No tenants found"
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
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50">
                    {/* Select All Checkbox */}
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label={
                          isAllSelected
                            ? 'Deselect all tenants'
                            : 'Select all tenants'
                        }
                        className={cn(
                          'border-slate-400 data-[state=checked]:bg-slate-700 data-[state=checked]:border-slate-700',
                          isSomeSelected && 'data-[state=checked]:bg-slate-500'
                        )}
                        {...(isSomeSelected && { 'data-state': 'checked' })}
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
                    />
                    <SortableTableHeader
                      columnKey="subdomain"
                      label="Store URL"
                      sortState={sort}
                      onSort={setSort}
                    />
                    <SortableTableHeader
                      columnKey="isActive"
                      label="Status"
                      sortState={sort}
                      onSort={setSort}
                    />
                    <TableHead className="font-semibold text-center">
                      Users
                    </TableHead>
                    <TableHead className="font-semibold text-center">
                      Products
                    </TableHead>
                    <TableHead className="font-semibold text-center">
                      Orders
                    </TableHead>
                    <SortableTableHeader
                      columnKey="createdAt"
                      label="Created"
                      sortState={sort}
                      onSort={setSort}
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
                            label: 'Review Applications',
                            href: '/super-admin/onboarding',
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
                            'hover:bg-slate-50 transition-colors',
                            isSelected && 'bg-slate-100/70'
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
                              className="border-slate-400 data-[state=checked]:bg-slate-700 data-[state=checked]:border-slate-700"
                            />
                          </TableCell>
                          <TableCell className="font-medium text-slate-900">
                            {tenant.businessName}
                          </TableCell>
                          <TableCell className="text-slate-600 font-mono text-sm">
                            {tenant.nftTokenId || (
                              <span className="text-slate-400">N/A</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <a
                              href={tenantUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-cyan-600 hover:text-cyan-700 hover:underline flex items-center gap-1 transition-colors"
                            >
                              <span className="truncate max-w-[200px]">
                                {tenantUrl}
                              </span>
                              <ExternalLink className="h-3 w-3 flex-shrink-0" />
                            </a>
                          </TableCell>
                          <TableCell>
                            {tenant.isActive ? (
                              <Badge
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                aria-label="Status: Active"
                              >
                                Active
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="bg-slate-200 text-slate-800"
                                aria-label="Status: Inactive"
                              >
                                Inactive
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
                              {tenant._count.users}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-800 text-sm font-medium">
                              {tenant._count.products}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-800 text-sm font-medium">
                              {tenant._count.orders}
                            </span>
                          </TableCell>
                          <TableCell className="text-slate-600 text-sm">
                            {format(new Date(tenant.createdAt), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            <Link href={`/super-admin/tenants/${tenant.id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-300 transition-colors"
                              >
                                Manage
                              </Button>
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
        itemLabel="tenants"
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
              {confirmAction === 'activate' ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span>Activate Tenants</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <span>Deactivate Tenants</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription className="pt-2">
              {confirmAction === 'activate' ? (
                <span>
                  Are you sure you want to activate{' '}
                  <strong>{selectedIds.size}</strong> tenant
                  {selectedIds.size === 1 ? '' : 's'}? They will be able to
                  access their stores.
                </span>
              ) : (
                <span>
                  Are you sure you want to deactivate{' '}
                  <strong>{selectedIds.size}</strong> tenant
                  {selectedIds.size === 1 ? '' : 's'}? Their stores will become
                  inaccessible.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Show tenant names */}
          {selectedTenantNames.length > 0 && (
            <div className="py-2">
              <p className="text-xs text-muted-foreground mb-2">
                Affected tenants:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedTenantNames.map((name) => (
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
              variant={confirmAction === 'activate' ? 'default' : 'destructive'}
              onClick={handleConfirmAction}
              disabled={isProcessing}
              className={cn(
                confirmAction === 'activate' &&
                  'bg-emerald-600 hover:bg-emerald-700'
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
              ) : confirmAction === 'activate' ? (
                'Activate'
              ) : (
                'Deactivate'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
