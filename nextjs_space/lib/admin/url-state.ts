'use client';

import { useCallback, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

/**
 * Sort direction type
 */
export type SortOrder = 'asc' | 'desc' | null;

/**
 * Sort state containing column and direction
 */
export interface SortState {
  column: string | null;
  order: SortOrder;
}

/**
 * Table state returned by useTableState hook
 * @template TFilters - Type for custom filter values (defaults to Record<string, string>)
 */
export interface TableState<TFilters extends Record<string, string> = Record<string, string>> {
  /** Current search query */
  search: string;
  /** Current filter values */
  filters: TFilters;
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Current sort state */
  sort: SortState;
}

/**
 * Table state setters returned by useTableState hook
 * @template TFilters - Type for custom filter values
 */
export interface TableStateSetters<TFilters extends Record<string, string> = Record<string, string>> {
  /** Set the search query (updates URL param: ?search=value) */
  setSearch: (value: string) => void;
  /** Set a filter value (updates URL param: ?[key]=value) */
  setFilter: <K extends keyof TFilters>(key: K, value: TFilters[K] | null) => void;
  /** Set the current page (updates URL param: ?page=n) */
  setPage: (page: number) => void;
  /** Set the page size (updates URL param: ?pageSize=n, resets page to 1) */
  setPageSize: (size: number) => void;
  /** Toggle sort on a column (updates URL params: ?sortBy=column&sortOrder=asc|desc) */
  setSort: (column: string) => void;
  /** Reset all filters to defaults */
  resetFilters: () => void;
}

/**
 * Configuration options for useTableState hook
 */
export interface UseTableStateOptions<TFilters extends Record<string, string>> {
  /** Default page size (default: 20) */
  defaultPageSize?: number;
  /** Default filter values */
  defaultFilters?: TFilters;
  /** Available page sizes for validation */
  pageSizes?: number[];
}

/**
 * URL parameter names used by the hook
 */
const URL_PARAMS = {
  SEARCH: 'search',
  PAGE: 'page',
  PAGE_SIZE: 'pageSize',
  SORT_BY: 'sortBy',
  SORT_ORDER: 'sortOrder',
} as const;

/**
 * Default page sizes available for selection
 */
const DEFAULT_PAGE_SIZES = [10, 20, 50, 100];

/**
 * useTableState - Custom hook for managing table state in URL params.
 *
 * Provides a consistent way to manage search, filters, pagination, and sorting
 * state in the URL, enabling shareable links and browser history navigation.
 *
 * Features:
 * - Syncs all state with URL search params
 * - TypeScript generics for type-safe filter values
 * - Automatic page reset when filters change
 * - Three-state sorting (asc -> desc -> none)
 * - Configurable defaults
 *
 * @template TFilters - Type for custom filter values
 * @param options - Configuration options
 * @returns Tuple of [state, setters]
 *
 * @example
 * ```tsx
 * // Basic usage
 * const [state, { setSearch, setFilter, setPage, setSort }] = useTableState();
 *
 * // With typed filters
 * interface TenantFilters {
 *   status: 'all' | 'active' | 'inactive';
 *   plan: string;
 * }
 *
 * const [state, setters] = useTableState<TenantFilters>({
 *   defaultFilters: { status: 'all', plan: '' },
 *   defaultPageSize: 20,
 * });
 *
 * // Access state
 * console.log(state.search);           // 'acme'
 * console.log(state.filters.status);   // 'active'
 * console.log(state.page);             // 2
 * console.log(state.sort.column);      // 'createdAt'
 *
 * // Update state (automatically updates URL)
 * setters.setSearch('new search');
 * setters.setFilter('status', 'inactive');
 * setters.setPage(3);
 * setters.setSort('businessName');
 * ```
 */
export function useTableState<TFilters extends Record<string, string> = Record<string, string>>(
  options: UseTableStateOptions<TFilters> = {}
): [TableState<TFilters>, TableStateSetters<TFilters>] {
  const {
    defaultPageSize = 20,
    defaultFilters = {} as TFilters,
    pageSizes = DEFAULT_PAGE_SIZES,
  } = options;

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  /**
   * Helper to create a new URLSearchParams with updated values
   */
  const createUpdatedParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === '' || value === undefined) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      return params;
    },
    [searchParams]
  );

  /**
   * Helper to update URL with new params
   */
  const updateUrl = useCallback(
    (params: URLSearchParams) => {
      const queryString = params.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(newUrl, { scroll: false });
    },
    [pathname, router]
  );

  // Parse current state from URL
  const state = useMemo<TableState<TFilters>>(() => {
    const search = searchParams.get(URL_PARAMS.SEARCH) || '';

    // Parse page with validation
    const pageParam = searchParams.get(URL_PARAMS.PAGE);
    const parsedPage = pageParam ? parseInt(pageParam, 10) : 1;
    const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

    // Parse pageSize with validation
    const pageSizeParam = searchParams.get(URL_PARAMS.PAGE_SIZE);
    const parsedPageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : defaultPageSize;
    const pageSize = pageSizes.includes(parsedPageSize) ? parsedPageSize : defaultPageSize;

    // Parse sort state
    const sortBy = searchParams.get(URL_PARAMS.SORT_BY);
    const sortOrderParam = searchParams.get(URL_PARAMS.SORT_ORDER);
    const sortOrder: SortOrder =
      sortOrderParam === 'asc' || sortOrderParam === 'desc' ? sortOrderParam : null;

    const sort: SortState = {
      column: sortBy,
      order: sortBy ? sortOrder || 'asc' : null,
    };

    // Parse filters - collect all params that match defaultFilters keys
    const filters = { ...defaultFilters } as TFilters;
    Object.keys(defaultFilters).forEach((key) => {
      const value = searchParams.get(key);
      if (value !== null) {
        (filters as Record<string, string>)[key] = value;
      }
    });

    return { search, filters, page, pageSize, sort };
  }, [searchParams, defaultFilters, defaultPageSize, pageSizes]);

  // Create setters
  const setSearch = useCallback(
    (value: string) => {
      const params = createUpdatedParams({
        [URL_PARAMS.SEARCH]: value || null,
        [URL_PARAMS.PAGE]: null, // Reset page when search changes
      });
      updateUrl(params);
    },
    [createUpdatedParams, updateUrl]
  );

  const setFilter = useCallback(
    <K extends keyof TFilters>(key: K, value: TFilters[K] | null) => {
      const params = createUpdatedParams({
        [key as string]: value as string | null,
        [URL_PARAMS.PAGE]: null, // Reset page when filter changes
      });
      updateUrl(params);
    },
    [createUpdatedParams, updateUrl]
  );

  const setPage = useCallback(
    (page: number) => {
      const params = createUpdatedParams({
        [URL_PARAMS.PAGE]: page > 1 ? String(page) : null,
      });
      updateUrl(params);
    },
    [createUpdatedParams, updateUrl]
  );

  const setPageSize = useCallback(
    (size: number) => {
      const validSize = pageSizes.includes(size) ? size : defaultPageSize;
      const params = createUpdatedParams({
        [URL_PARAMS.PAGE_SIZE]: validSize !== defaultPageSize ? String(validSize) : null,
        [URL_PARAMS.PAGE]: null, // Reset page when page size changes
      });
      updateUrl(params);
    },
    [createUpdatedParams, updateUrl, pageSizes, defaultPageSize]
  );

  const setSort = useCallback(
    (column: string) => {
      let newOrder: SortOrder;
      let newColumn: string | null = column;

      if (state.sort.column === column) {
        // Cycle through: asc -> desc -> null
        if (state.sort.order === 'asc') {
          newOrder = 'desc';
        } else if (state.sort.order === 'desc') {
          newOrder = null;
          newColumn = null;
        } else {
          newOrder = 'asc';
        }
      } else {
        // New column, start with asc
        newOrder = 'asc';
      }

      const params = createUpdatedParams({
        [URL_PARAMS.SORT_BY]: newColumn,
        [URL_PARAMS.SORT_ORDER]: newOrder,
      });
      updateUrl(params);
    },
    [createUpdatedParams, updateUrl, state.sort]
  );

  const resetFilters = useCallback(() => {
    const params = new URLSearchParams();

    // Keep only non-filter, non-search params (sortBy, sortOrder, page, pageSize)
    // Actually, let's clear everything for a clean reset
    updateUrl(params);
  }, [updateUrl]);

  const setters = useMemo<TableStateSetters<TFilters>>(
    () => ({
      setSearch,
      setFilter,
      setPage,
      setPageSize,
      setSort,
      resetFilters,
    }),
    [setSearch, setFilter, setPage, setPageSize, setSort, resetFilters]
  );

  return [state, setters];
}

/**
 * Helper function to build query string from table state.
 * Useful for server components or API calls.
 *
 * @param state - Table state object
 * @param filterKeys - Keys to include from filters
 * @returns Query string (without leading ?)
 *
 * @example
 * ```ts
 * const queryString = buildQueryString(state, ['status', 'plan']);
 * const url = `/api/tenants?${queryString}`;
 * ```
 */
export function buildQueryString<TFilters extends Record<string, string>>(
  state: TableState<TFilters>,
  filterKeys: (keyof TFilters)[] = []
): string {
  const params = new URLSearchParams();

  if (state.search) {
    params.set(URL_PARAMS.SEARCH, state.search);
  }

  if (state.page > 1) {
    params.set(URL_PARAMS.PAGE, String(state.page));
  }

  if (state.pageSize !== 20) {
    params.set(URL_PARAMS.PAGE_SIZE, String(state.pageSize));
  }

  if (state.sort.column && state.sort.order) {
    params.set(URL_PARAMS.SORT_BY, state.sort.column);
    params.set(URL_PARAMS.SORT_ORDER, state.sort.order);
  }

  filterKeys.forEach((key) => {
    const value = state.filters[key];
    if (value && value !== 'all') {
      params.set(key as string, value);
    }
  });

  return params.toString();
}

/**
 * Helper function to parse table state from URLSearchParams.
 * Useful for server components.
 *
 * @param searchParams - URLSearchParams object
 * @param defaultFilters - Default filter values
 * @param defaultPageSize - Default page size
 * @returns Parsed table state
 *
 * @example
 * ```ts
 * // In a server component
 * export default function Page({ searchParams }: { searchParams: Record<string, string> }) {
 *   const urlParams = new URLSearchParams(searchParams);
 *   const state = parseTableState(urlParams, { status: 'all' });
 *   // Use state to fetch data...
 * }
 * ```
 */
export function parseTableState<TFilters extends Record<string, string>>(
  searchParams: URLSearchParams,
  defaultFilters: TFilters = {} as TFilters,
  defaultPageSize: number = 20
): TableState<TFilters> {
  const search = searchParams.get(URL_PARAMS.SEARCH) || '';

  const pageParam = searchParams.get(URL_PARAMS.PAGE);
  const parsedPage = pageParam ? parseInt(pageParam, 10) : 1;
  const page = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

  const pageSizeParam = searchParams.get(URL_PARAMS.PAGE_SIZE);
  const parsedPageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : defaultPageSize;
  const pageSize = DEFAULT_PAGE_SIZES.includes(parsedPageSize) ? parsedPageSize : defaultPageSize;

  const sortBy = searchParams.get(URL_PARAMS.SORT_BY);
  const sortOrderParam = searchParams.get(URL_PARAMS.SORT_ORDER);
  const sortOrder: SortOrder =
    sortOrderParam === 'asc' || sortOrderParam === 'desc' ? sortOrderParam : null;

  const sort: SortState = {
    column: sortBy,
    order: sortBy ? sortOrder || 'asc' : null,
  };

  const filters = { ...defaultFilters } as TFilters;
  Object.keys(defaultFilters).forEach((key) => {
    const value = searchParams.get(key);
    if (value !== null) {
      (filters as Record<string, string>)[key] = value;
    }
  });

  return { search, filters, page, pageSize, sort };
}
