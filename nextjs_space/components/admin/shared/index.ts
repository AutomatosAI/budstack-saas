/**
 * Shared Admin Components
 *
 * A collection of reusable components for admin panels.
 * These components are generic and can be used across
 * Super Admin and Tenant Admin interfaces.
 */

export { SearchInput, type SearchInputProps } from './SearchInput';
export {
  StatusFilter,
  type StatusFilterProps,
  type StatusFilterOption,
} from './StatusFilter';
export { Pagination, type PaginationProps } from './Pagination';
export {
  BulkActionBar,
  type BulkActionBarProps,
  type BulkAction,
} from './BulkActionBar';
export { EmptyState, type EmptyStateProps, type EmptyStateAction } from './EmptyState';
export {
  SortableTableHeader,
  type SortableTableHeaderProps,
  type TableHeaderAlignment,
} from './SortableTableHeader';
export {
  Breadcrumbs,
  type BreadcrumbsProps,
  type BreadcrumbItem,
} from './Breadcrumbs';
