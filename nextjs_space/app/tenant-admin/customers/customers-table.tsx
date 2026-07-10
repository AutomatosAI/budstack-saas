"use client";

import { useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Users, Search, Phone, ShoppingBag, Share2, Eye } from "lucide-react";
import {
  SearchInput,
  EmptyState,
  Pagination,
  SortableTableHeader,
  ExportButton,
  RowPill,
} from "@/components/admin/shared";
import { useTableState } from "@/lib/admin/url-state";
import { exportToCSV } from "@/lib/admin/csv-export";
import { toast } from "@/components/ui/sonner";
import { useCallback } from "react";

export interface Customer {
  id: string;
  email: string;
  name: string | null;
  phone?: string | null;
  createdAt: Date;
  _count: {
    orders: number;
  };
  // PRD-220 Part B: inline ID-document upload failed during registration —
  // the customer is stuck unverified until they (or we) re-upload.
  idUploadFailed?: boolean;
}

interface CustomersTableProps {
  customers: Customer[];
  totalCount: number;
}

export function CustomersTable({ customers, totalCount }: CustomersTableProps) {
  const [
    { search, page, pageSize, sort },
    { setSearch, setPage, setPageSize, setSort },
  ] = useTableState({
    defaultPageSize: 20,
  });

  const hasSearchQuery = search.trim().length > 0;
  const noResults = totalCount === 0 && hasSearchQuery;

  const emptyDescription = useMemo(() => {
    if (hasSearchQuery) {
      return `No customers found matching "${search}". Try a different search term.`;
    }
    return "No customers yet. Share your store URL to get started.";
  }, [hasSearchQuery, search]);

  const handleClearSearch = () => {
    setSearch("");
  };

  const handleExportAll = useCallback(async () => {
    if (customers.length === 0) return;

    const exportData = customers.map((c) => ({
      name: c.name || "N/A",
      email: c.email,
      phone: c.phone || "N/A",
      orders: c._count.orders,
      createdAt: format(new Date(c.createdAt), "yyyy-MM-dd"),
    }));

    const csvHeaders = [
      { key: "name" as const, label: "Name" },
      { key: "email" as const, label: "Email" },
      { key: "phone" as const, label: "Phone" },
      { key: "orders" as const, label: "Orders" },
      { key: "createdAt" as const, label: "Joined" },
    ];

    await exportToCSV(
      exportData,
      csvHeaders,
      "customers",
      undefined,
      (recordCount, fileSize) => {
        toast.success(`Exported ${recordCount} customers to CSV (${fileSize})`);
      },
      (error) => {
        toast.error(`Export failed: ${error.message}`);
      },
    );
  }, [customers]);

  const getInitials = (name: string | null): string => {
    if (!name) return "?";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="bs-card overflow-hidden">
      <div className="border-b border-bs-border-100 px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-bs-border-100 bg-bs-card-2 p-2.5">
              <Users className="h-5 w-5 text-bs-green-soft" aria-hidden="true" />
            </div>
            <h2
              className="text-[22px] text-bs-fg"
              style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
            >
              {hasSearchQuery
                ? `Results (${totalCount})`
                : `All Customers (${totalCount})`}
            </h2>
          </div>

          <div className="flex flex-col gap-3 w-full sm:w-auto sm:flex-row">
            <div className="w-full sm:w-72">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search customers..."
                aria-label="Search customers"
                debounceMs={300}
              />
            </div>

            <ExportButton
              onExport={handleExportAll}
              recordCount={customers.length}
              theme="tenant-admin"
              disabled={customers.length === 0}
            />
          </div>
        </div>
      </div>

      <div>
        {noResults ? (
          <EmptyState
            icon={Search}
            heading="No customers found"
            description={emptyDescription}
            variant="muted"
            size="default"
            action={{
              label: "Clear search",
              onClick: handleClearSearch,
              variant: "outline",
            }}
            className="my-8"
          />
        ) : customers.length === 0 && !hasSearchQuery ? (
          <EmptyState
            icon={Users}
            heading="No customers yet"
            description="Share your store URL with potential customers to start building your customer base."
            size="lg"
            theme="cyan"
            showDecoration
            action={{
              label: "Copy Store URL",
              onClick: () => {
                navigator.clipboard.writeText(window.location.origin);
              },
              icon: Share2,
            }}
            className="my-8"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="bs-table w-full">
              <thead>
                <tr>
                  <SortableTableHeader
                    columnKey="name"
                    label="Customer"
                    sortState={sort}
                    onSort={setSort}
                  />
                  <SortableTableHeader
                    columnKey="email"
                    label="Email"
                    sortState={sort}
                    onSort={setSort}
                    className="hidden md:table-cell"
                  />
                  <th className="text-center hidden sm:table-cell">
                    <span className="flex items-center justify-center gap-1.5">
                      <ShoppingBag className="h-3.5 w-3.5 text-bs-fg-muted" aria-hidden="true" />
                      Orders
                    </span>
                  </th>
                  <SortableTableHeader
                    columnKey="createdAt"
                    label="Joined"
                    sortState={sort}
                    onSort={setSort}
                    className="hidden sm:table-cell"
                  />
                  <th className="text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-bs-card-2 transition-colors group"
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="bs-avatar flex-shrink-0 w-10 h-10 text-sm">
                          {getInitials(customer.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-bs-fg truncate">
                            {customer.name || "N/A"}
                          </p>
                          {customer.idUploadFailed && (
                            <RowPill tone="red" className="mt-0.5">
                              ID upload failed
                            </RowPill>
                          )}
                          <a
                            href={`mailto:${customer.email}`}
                            className="text-xs font-mono text-bs-fg-muted hover:text-bs-green-soft md:hidden truncate block"
                          >
                            {customer.email}
                          </a>
                          {customer.phone && (
                            <p className="text-xs text-bs-fg-muted items-center gap-1 hidden md:flex">
                              <Phone className="h-3 w-3" aria-hidden="true" />
                              {customer.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="text-bs-fg-muted hidden md:table-cell">
                      <a
                        href={`mailto:${customer.email}`}
                        className="font-mono hover:text-bs-green-soft hover:underline transition-colors"
                      >
                        {customer.email}
                      </a>
                    </td>
                    <td className="text-center hidden sm:table-cell">
                      <RowPill tone="gold">{customer._count.orders}</RowPill>
                    </td>
                    <td className="text-bs-fg-muted text-sm font-mono hidden sm:table-cell">
                      {format(new Date(customer.createdAt), "MMM d, yyyy")}
                    </td>
                    <td>
                      <Link
                        href={`/tenant-admin/customers/${customer.id}`}
                        className="bs-btn bs-btn-ghost bs-btn-sm gap-2"
                      >
                        <Eye className="w-4 h-4" aria-hidden="true" />
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {customers.length > 0 && (
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
  );
}
