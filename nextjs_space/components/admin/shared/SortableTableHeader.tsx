"use client";

import * as React from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortOrder, SortState } from "@/lib/admin/url-state";

export type TableHeaderAlignment = "left" | "center" | "right";

export interface SortableTableHeaderProps {
  columnKey: string;
  label: string;
  sortState: SortState;
  onSort: (column: string) => void;
  align?: TableHeaderAlignment;
  className?: string;
  sortable?: boolean;
}

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

    const SortIcon = () => {
      const iconClasses = cn(
        "h-3.5 w-3.5 flex-shrink-0 transition-opacity",
        isActive ? "text-bs-fg opacity-100" : "text-bs-fg-muted opacity-0 group-hover:opacity-100",
      );

      if (currentOrder === "asc") {
        return <ArrowUp className={iconClasses} aria-hidden="true" />;
      }
      if (currentOrder === "desc") {
        return <ArrowDown className={iconClasses} aria-hidden="true" />;
      }
      return <ArrowUpDown className={iconClasses} aria-hidden="true" />;
    };

    if (!sortable) {
      return (
        <TableHead
          ref={ref}
          className={cn(
            "font-mono text-mono-eyebrow uppercase text-bs-fg-muted",
            alignmentClasses[align],
            className,
          )}
        >
          {label}
        </TableHead>
      );
    }

    return (
      <TableHead ref={ref} className={cn("p-0", className)}>
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
          data-active={isActive ? "true" : undefined}
          className={cn(
            "group flex items-center gap-1.5 w-full h-full px-4 py-3 select-none cursor-pointer",
            "font-mono text-mono-eyebrow uppercase tracking-wide transition-colors",
            isActive ? "text-bs-fg" : "text-bs-fg-muted hover:text-bs-fg",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-bs-green/40",
            alignmentClasses[align],
          )}
        >
          <span>{label}</span>
          <SortIcon />
        </button>
      </TableHead>
    );
  },
);

SortableTableHeader.displayName = "SortableTableHeader";
