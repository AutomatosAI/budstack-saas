"use client";

import * as React from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortOrder, SortState } from "@/lib/admin/url-state";

/**
 * Alignment options for table header content
 */
export type TableHeaderAlignment = "left" | "center" | "right";

/**
 * Props for the SortableTableHeader component
 */
export interface SortableTableHeaderProps {
  /** Unique column key used for sorting */
  columnKey: string;
  /** Display label for the column header */
  label: string;
  /** Current sort state from useTableState hook */
  sortState: SortState;
  /** Callback when sort is triggered - typically setSort from useTableState */
  onSort: (column: string) => void;
  /** Text alignment for the header content */
  align?: TableHeaderAlignment;
  /** Additional CSS classes */
  className?: string;
  /** Whether this column is sortable (defaults to true) */
  sortable?: boolean;
}

/**
 * Get the next sort order in the cycle: null -> asc -> desc -> null
 */
function getNextSortLabel(
  currentColumn: string | null,
  currentOrder: SortOrder,
  targetColumn: string,
): string {
  if (currentColumn !== targetColumn) {
    return "Sort ascending";
  }
  if (currentOrder === "asc") {
    return "Sort descending";
  }
  if (currentOrder === "desc") {
    return "Clear sort";
  }
  return "Sort ascending";
}

/**
 * SortableTableHeader - A clickable table header with sort indicators.
 *
 * Features:
 * - Three-state sorting cycle (asc -> desc -> null)
 * - Visual sort indicators (ArrowUp, ArrowDown, ArrowUpDown)
 * - Smooth hover and active states
 * - ARIA labels for accessibility
 * - Integrates with useTableState hook
 *
 * @example
 * ```tsx
 * const [{ sort }, { setSort }] = useTableState();
 *
 * <SortableTableHeader
 *   columnKey="businessName"
 *   label="Business Name"
 *   sortState={sort}
 *   onSort={setSort}
 * />
 * ```
 */
export const SortableTableHeader = React.forwardRef<
  HTMLTableCellElement,
  SortableTableHeaderProps
>(
  (
    {
      columnKey,
      label,
      sortState,
      onSort,
      align = "left",
      className,
      sortable = true,
    },
    ref,
  ) => {
    const isActive = sortState.column === columnKey;
    const currentOrder = isActive ? sortState.order : null;

    const handleClick = () => {
      if (sortable) {
        onSort(columnKey);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (sortable && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        onSort(columnKey);
      }
    };

    const ariaLabel = sortable
      ? `${label}, ${getNextSortLabel(sortState.column, sortState.order, columnKey)}`
      : label;

    const alignmentClasses = {
      left: "justify-start text-left",
      center: "justify-center text-center",
      right: "justify-end text-right",
    };

    // Render sort icon based on state
    const SortIcon = () => {
      const iconClasses = cn(
        "h-4 w-4 flex-shrink-0 transition-all duration-200",
        isActive
          ? "text-slate-900 scale-110"
          : "text-slate-400 group-hover:text-slate-600",
      );

      if (!isActive) {
        return (
          <ArrowUpDown
            className={cn(iconClasses, "opacity-0 group-hover:opacity-100")}
            aria-hidden="true"
          />
        );
      }

      if (currentOrder === "asc") {
        return (
          <ArrowUp
            className={cn(
              iconClasses,
              "animate-in fade-in zoom-in-50 duration-150",
            )}
            aria-hidden="true"
          />
        );
      }

      if (currentOrder === "desc") {
        return (
          <ArrowDown
            className={cn(
              iconClasses,
              "animate-in fade-in zoom-in-50 duration-150",
            )}
            aria-hidden="true"
          />
        );
      }

      return (
        <ArrowUpDown
          className={cn(iconClasses, "opacity-0 group-hover:opacity-100")}
          aria-hidden="true"
        />
      );
    };

    // Non-sortable header
    if (!sortable) {
      return (
        <TableHead
          ref={ref}
          className={cn(
            "font-semibold text-slate-700",
            alignmentClasses[align],
            className,
          )}
        >
          {label}
        </TableHead>
      );
    }

    return (
      <TableHead ref={ref} className={cn("font-semibold p-0", className)}>
        <button
          type="button"
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          aria-label={ariaLabel}
          aria-sort={
            isActive
              ? currentOrder === "asc"
                ? "ascending"
                : currentOrder === "desc"
                  ? "descending"
                  : "none"
              : undefined
          }
          className={cn(
            "group flex items-center gap-1.5 w-full h-full px-4 py-3",
            "select-none cursor-pointer",
            "transition-all duration-150 ease-out",
            // Hover and focus states
            "hover:bg-slate-100/80 focus-visible:bg-slate-100/80",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400",
            // Active state
            isActive && "bg-slate-50",
            // Alignment
            alignmentClasses[align],
          )}
        >
          <span
            className={cn(
              "text-sm font-semibold transition-colors duration-150",
              isActive
                ? "text-slate-900"
                : "text-slate-700 group-hover:text-slate-900",
            )}
          >
            {label}
          </span>
          <SortIcon />
        </button>
      </TableHead>
    );
  },
);

SortableTableHeader.displayName = "SortableTableHeader";
