'use client';

import { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Package,
  Search,
  Eye,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  Calendar,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { SearchInput, StatusFilter, EmptyState, Pagination, SortableTableHeader } from '@/components/admin/shared';
import type { StatusFilterOption } from '@/components/admin/shared';
import { useTableState } from '@/lib/admin/url-state';
import { cn } from '@/lib/utils';

/** Order status types */
type OrderStatus = 'all' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';

/** Date range preset options */
type DateRangePreset = 'all' | '7days' | '30days' | '90days' | 'custom';

/** Filter types for orders table */
type OrderFilters = {
  status: OrderStatus;
  dateRange: DateRangePreset;
  dateFrom: string;
  dateTo: string;
} & Record<string, string>;

/**
 * Order item data shape
 */
interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  price: number;
}

/**
 * Order data shape from API
 */
interface Order {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  subtotal: number;
  shippingCost: number;
  createdAt: string;
  items: OrderItem[];
  user: {
    name: string | null;
    email: string;
  };
}

interface OrdersTableProps {
  /** Array of order data from server (paginated and filtered) */
  orders: Order[];
  /** Total count of filtered orders (for pagination) */
  totalCount: number;
  /** Status counts from server (with search/date filters applied) */
  statusCounts: {
    PENDING: number;
    PROCESSING: number;
    COMPLETED: number;
    CANCELLED: number;
  };
  /** Callback when order is selected for viewing */
  onViewOrder: (order: Order) => void;
}

/**
 * OrdersTable - Client component for displaying orders with search, filter, and pagination.
 *
 * Features:
 * - Server-side pagination with URL state (?page=, ?pageSize=)
 * - Debounced search across orderNumber, customer name, customer email
 * - Status filter (Pending, Processing, Completed, Cancelled)
 * - Date range picker with presets (Last 7/30/90 days, Custom)
 * - Quick filter chips for "Needs Attention" and "In Progress"
 * - URL state persistence (?search=, ?status=, ?dateRange=, ?dateFrom=, ?dateTo=, ?page=, ?pageSize=)
 * - Empty state for no results
 */
export function OrdersTable({
  orders,
  totalCount,
  statusCounts,
  onViewOrder,
}: OrdersTableProps) {
  const [{ search, filters, page, pageSize, sort }, { setSearch, setFilter, setPage, setPageSize, setSort }] = useTableState<OrderFilters>({
    defaultFilters: {
      status: 'all',
      dateRange: 'all',
      dateFrom: '',
      dateTo: '',
    },
    defaultPageSize: 20,
  });

  // Calendar popover state
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();

  const statusFilter = filters.status || 'all';
  const dateRangeFilter = filters.dateRange || 'all';
  const dateFromFilter = filters.dateFrom || '';
  const dateToFilter = filters.dateTo || '';

  // Total orders matching search/date filter (regardless of status filter)
  const totalSearchCount = statusCounts.PENDING + statusCounts.PROCESSING + statusCounts.COMPLETED + statusCounts.CANCELLED;

  // Status filter options with server-provided counts
  const statusOptions: StatusFilterOption<OrderStatus>[] = useMemo(
    () => [
      { value: 'all', label: 'All Orders', count: totalSearchCount },
      { value: 'PENDING', label: 'Pending', count: statusCounts.PENDING },
      { value: 'PROCESSING', label: 'Processing', count: statusCounts.PROCESSING },
      { value: 'COMPLETED', label: 'Completed', count: statusCounts.COMPLETED },
      { value: 'CANCELLED', label: 'Cancelled', count: statusCounts.CANCELLED },
    ],
    [totalSearchCount, statusCounts]
  );

  // Quick filter handlers
  const handleQuickFilter = (status: OrderStatus) => {
    if (statusFilter === status) {
      setFilter('status', 'all');
    } else {
      setFilter('status', status);
    }
  };

  // Date range preset handler
  const handleDateRangePreset = (preset: DateRangePreset) => {
    setFilter('dateRange', preset);
    if (preset !== 'custom') {
      setFilter('dateFrom', '');
      setFilter('dateTo', '');
      setCustomDateFrom(undefined);
      setCustomDateTo(undefined);
    }
  };

  // Custom date range handler
  const handleCustomDateSelect = () => {
    if (customDateFrom && customDateTo) {
      setFilter('dateRange', 'custom');
      setFilter('dateFrom', format(customDateFrom, 'yyyy-MM-dd'));
      setFilter('dateTo', format(customDateTo, 'yyyy-MM-dd'));
      setCalendarOpen(false);
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearch('');
    setFilter('status', 'all');
    setFilter('dateRange', 'all');
    setFilter('dateFrom', '');
    setFilter('dateTo', '');
    setCustomDateFrom(undefined);
    setCustomDateTo(undefined);
  };

  // Status icon helper
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'PROCESSING':
        return <Truck className="w-3.5 h-3.5" />;
      case 'PENDING':
        return <Clock className="w-3.5 h-3.5" />;
      case 'CANCELLED':
        return <XCircle className="w-3.5 h-3.5" />;
      default:
        return <Package className="w-3.5 h-3.5" />;
    }
  };

  // Status color helper
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-emerald-500 hover:bg-emerald-600 text-white';
      case 'PROCESSING':
        return 'bg-blue-500 hover:bg-blue-600 text-white';
      case 'PENDING':
        return 'bg-amber-500 hover:bg-amber-600 text-white';
      case 'CANCELLED':
        return 'bg-red-500 hover:bg-red-600 text-white';
      default:
        return 'bg-slate-500 hover:bg-slate-600 text-white';
    }
  };

  // Format date range display
  const getDateRangeLabel = () => {
    switch (dateRangeFilter) {
      case '7days':
        return 'Last 7 days';
      case '30days':
        return 'Last 30 days';
      case '90days':
        return 'Last 90 days';
      case 'custom':
        if (dateFromFilter && dateToFilter) {
          return `${format(parseISO(dateFromFilter), 'MMM d')} - ${format(parseISO(dateToFilter), 'MMM d, yyyy')}`;
        }
        return 'Custom range';
      default:
        return 'All time';
    }
  };

  const hasSearchQuery = search.trim().length > 0;
  const hasStatusFilter = statusFilter !== 'all';
  const hasDateFilter = dateRangeFilter !== 'all';
  const hasFilters = hasSearchQuery || hasStatusFilter || hasDateFilter;
  const noResults = totalCount === 0 && hasFilters;

  // Build description for empty state
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
    return 'No orders found.';
  }, [hasSearchQuery, hasStatusFilter, hasDateFilter, search, statusFilter]);

  return (
    <Card className="shadow-lg border-slate-200">
      <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50">
        <div className="flex flex-col gap-4">
          {/* Title Row */}
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <CardTitle className="flex items-center gap-3">
              <span className="text-2xl font-bold text-slate-900">
                {hasFilters
                  ? `Results (${totalCount})`
                  : `All Orders (${totalSearchCount})`}
              </span>
            </CardTitle>

            {/* Search and Status Filter */}
            <div className="flex flex-col gap-3 w-full xl:w-auto xl:flex-row xl:items-center">
              {/* Search Input */}
              <div className="w-full xl:w-72">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search orders..."
                  aria-label="Search orders by order number, customer name, or email"
                  debounceMs={300}
                />
              </div>

              {/* Status Filter */}
              <StatusFilter<OrderStatus>
                value={statusFilter}
                onChange={(value) => setFilter('status', value)}
                options={statusOptions}
                aria-label="Filter by order status"
                placeholder="All Orders"
                showIcon={false}
                className="w-full xl:w-[160px]"
              />

              {/* Date Range Picker */}
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full xl:w-[180px] justify-start text-left font-normal',
                      'bg-background/50 backdrop-blur-sm',
                      'border-border/60 hover:border-border',
                      dateRangeFilter !== 'all' && 'border-primary/50 bg-primary/5'
                    )}
                  >
                    <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className={cn(
                      dateRangeFilter === 'all' ? 'text-muted-foreground' : 'text-foreground'
                    )}>
                      {getDateRangeLabel()}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <div className="p-3 space-y-3">
                    {/* Preset Options */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={dateRangeFilter === 'all' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleDateRangePreset('all')}
                        className="justify-start"
                      >
                        All time
                      </Button>
                      <Button
                        variant={dateRangeFilter === '7days' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleDateRangePreset('7days')}
                        className="justify-start"
                      >
                        Last 7 days
                      </Button>
                      <Button
                        variant={dateRangeFilter === '30days' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleDateRangePreset('30days')}
                        className="justify-start"
                      >
                        Last 30 days
                      </Button>
                      <Button
                        variant={dateRangeFilter === '90days' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => handleDateRangePreset('90days')}
                        className="justify-start"
                      >
                        Last 90 days
                      </Button>
                    </div>

                    <div className="border-t pt-3">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Custom Range</p>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <CalendarComponent
                            mode="single"
                            selected={customDateFrom}
                            onSelect={setCustomDateFrom}
                            disabled={(date) =>
                              date > new Date() || (customDateTo ? date > customDateTo : false)
                            }
                            initialFocus
                          />
                        </div>
                        <div className="flex-1">
                          <CalendarComponent
                            mode="single"
                            selected={customDateTo}
                            onSelect={setCustomDateTo}
                            disabled={(date) =>
                              date > new Date() || (customDateFrom ? date < customDateFrom : false)
                            }
                          />
                        </div>
                      </div>
                      <Button
                        className="w-full mt-2"
                        size="sm"
                        onClick={handleCustomDateSelect}
                        disabled={!customDateFrom || !customDateTo}
                      >
                        Apply Custom Range
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Quick Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground mr-1">Quick filters:</span>

            {/* Needs Attention Chip */}
            <button
              onClick={() => handleQuickFilter('PENDING')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                'border hover:shadow-sm',
                statusFilter === 'PENDING'
                  ? 'bg-amber-100 border-amber-300 text-amber-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300 hover:bg-amber-50'
              )}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              Needs Attention
              <Badge
                variant="secondary"
                className={cn(
                  'ml-1 h-5 px-1.5 text-[10px] font-semibold',
                  statusFilter === 'PENDING'
                    ? 'bg-amber-200 text-amber-800'
                    : 'bg-slate-100 text-slate-600'
                )}
              >
                {statusCounts.PENDING}
              </Badge>
            </button>

            {/* In Progress Chip */}
            <button
              onClick={() => handleQuickFilter('PROCESSING')}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                'border hover:shadow-sm',
                statusFilter === 'PROCESSING'
                  ? 'bg-blue-100 border-blue-300 text-blue-800'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50'
              )}
            >
              <Loader2 className="w-3.5 h-3.5" />
              In Progress
              <Badge
                variant="secondary"
                className={cn(
                  'ml-1 h-5 px-1.5 text-[10px] font-semibold',
                  statusFilter === 'PROCESSING'
                    ? 'bg-blue-200 text-blue-800'
                    : 'bg-slate-100 text-slate-600'
                )}
              >
                {statusCounts.PROCESSING}
              </Badge>
            </button>

            {/* Clear Filters (shown when filters active) */}
            {hasFilters && (
              <button
                onClick={handleClearFilters}
                className="inline-flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                Clear all
              </button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {noResults ? (
          <EmptyState
            icon={Search}
            heading="No orders found"
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
        ) : orders.length === 0 && !hasFilters ? (
          <EmptyState
            icon={Package}
            heading="No orders yet"
            description="Your orders will appear here once customers start purchasing."
            size="default"
            className="my-8"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <SortableTableHeader
                    columnKey="orderNumber"
                    label="Order ID"
                    sortState={sort}
                    onSort={setSort}
                  />
                  <TableHead className="font-semibold text-slate-700">Customer</TableHead>
                  <SortableTableHeader
                    columnKey="status"
                    label="Status"
                    sortState={sort}
                    onSort={setSort}
                  />
                  <TableHead className="font-semibold text-slate-700 text-center">Items</TableHead>
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
                  <TableHead className="font-semibold text-slate-700 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow
                    key={order.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <TableCell className="font-medium text-slate-900">
                      #{order.orderNumber.slice(-8).toUpperCase()}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-slate-900">
                          {order.user?.name || 'Guest'}
                        </p>
                        <p className="text-sm text-slate-500">
                          {order.user?.email || 'N/A'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(getStatusColor(order.status), 'gap-1')}>
                        {getStatusIcon(order.status)}
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-slate-600">
                      {order.items.length}
                    </TableCell>
                    <TableCell className="text-right font-medium text-slate-900">
                      €{order.total.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {format(new Date(order.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewOrder(order)}
                        className="gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination Controls */}
        {orders.length > 0 && (
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
