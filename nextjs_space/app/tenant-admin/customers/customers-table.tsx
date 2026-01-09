'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Users, Search, Phone, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { SearchInput, EmptyState, Pagination, SortableTableHeader } from '@/components/admin/shared';
import { useTableState } from '@/lib/admin/url-state';

/**
 * Customer data shape from Prisma query
 */
export interface Customer {
  id: string;
  email: string;
  name: string | null;
  phone?: string | null;
  createdAt: Date;
  _count: {
    orders: number;
  };
}

interface CustomersTableProps {
  /** Array of customer data from server (paginated and filtered) */
  customers: Customer[];
  /** Total count of filtered customers (for pagination) */
  totalCount: number;
}

/**
 * CustomersTable - Client component for displaying customers with search and pagination.
 *
 * Features:
 * - Server-side pagination with URL state (?page=, ?pageSize=)
 * - Debounced search across name, email, phone
 * - Case-insensitive filtering
 * - URL state persistence (?search=, ?page=, ?pageSize=)
 * - Empty state for no results with clear action
 */
export function CustomersTable({ customers, totalCount }: CustomersTableProps) {
  const [{ search, page, pageSize, sort }, { setSearch, setPage, setPageSize, setSort }] = useTableState({
    defaultPageSize: 20,
  });

  const hasSearchQuery = search.trim().length > 0;
  const noResults = totalCount === 0 && hasSearchQuery;

  // Build description for empty state
  const emptyDescription = useMemo(() => {
    if (hasSearchQuery) {
      return `No customers found matching "${search}". Try a different search term.`;
    }
    return 'No customers yet. Share your store URL to get started.';
  }, [hasSearchQuery, search]);

  // Clear search handler
  const handleClearSearch = () => {
    setSearch('');
  };

  // Get initials for avatar
  const getInitials = (name: string | null): string => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <Card className="shadow-lg border-slate-200">
      <CardHeader className="border-b bg-gradient-to-r from-cyan-50 to-blue-50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-3 text-2xl font-bold text-slate-900">
            <span>
              {hasSearchQuery
                ? `Results (${totalCount})`
                : `All Customers (${totalCount})`}
            </span>
            <Badge variant="outline" className="text-sm font-normal bg-white/60">
              {totalCount} Total
            </Badge>
          </CardTitle>

          {/* Search Input */}
          <div className="w-full sm:w-72">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search customers..."
              aria-label="Search customers"
              debounceMs={300}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {noResults ? (
          <EmptyState
            icon={Search}
            heading="No customers found"
            description={emptyDescription}
            variant="muted"
            size="default"
            action={{
              label: 'Clear search',
              onClick: handleClearSearch,
              variant: 'outline',
            }}
            className="my-8"
          />
        ) : customers.length === 0 && !hasSearchQuery ? (
          <EmptyState
            icon={Users}
            heading="No customers yet"
            description="Share your store URL to get started"
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
                    label="Customer"
                    sortState={sort}
                    onSort={setSort}
                  />
                  <SortableTableHeader
                    columnKey="email"
                    label="Email"
                    sortState={sort}
                    onSort={setSort}
                  />
                  <TableHead className="font-semibold text-center">
                    <span className="flex items-center justify-center gap-1.5">
                      <ShoppingBag className="h-3.5 w-3.5 text-slate-400" />
                      Orders
                    </span>
                  </TableHead>
                  <SortableTableHeader
                    columnKey="createdAt"
                    label="Joined"
                    sortState={sort}
                    onSort={setSort}
                  />
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow
                    key={customer.id}
                    className="hover:bg-slate-50 transition-colors group"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {/* Avatar with initials */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white font-medium text-sm shadow-sm group-hover:shadow-md transition-shadow">
                          {getInitials(customer.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">
                            {customer.name || 'N/A'}
                          </p>
                          {customer.phone && (
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {customer.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      <a
                        href={`mailto:${customer.email}`}
                        className="hover:text-cyan-600 hover:underline transition-colors"
                      >
                        {customer.email}
                      </a>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-700 text-sm font-medium">
                        {customer._count.orders}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {format(new Date(customer.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Link href={`/tenant-admin/customers/${customer.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="hover:bg-cyan-50 hover:text-cyan-700 hover:border-cyan-300 transition-colors"
                        >
                          View Details
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Controls */}
        {customers.length > 0 && (
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
