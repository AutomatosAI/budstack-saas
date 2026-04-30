"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  showPageSizeSelector?: boolean;
  showFirstLast?: boolean;
}

export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className,
  showPageSizeSelector = true,
  showFirstLast = true,
}: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  const handlePageSizeChange = React.useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const newPageSize = parseInt(event.target.value, 10);
      onPageSizeChange?.(newPageSize);
      if (page > Math.ceil(totalItems / newPageSize)) {
        onPageChange(1);
      }
    },
    [page, totalItems, onPageChange, onPageSizeChange],
  );

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-4 py-4 px-2",
        className,
      )}
      role="navigation"
      aria-label="Pagination"
    >
      <p className="text-sm text-bs-fg-muted order-2 sm:order-1">
        Showing{" "}
        <span className="font-mono text-bs-fg tabular-nums">{startItem}</span>
        {" – "}
        <span className="font-mono text-bs-fg tabular-nums">{endItem}</span>
        {" of "}
        <span className="font-mono text-bs-fg tabular-nums">{totalItems}</span>
        {" results"}
      </p>

      <div className="flex items-center gap-4 order-1 sm:order-2">
        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-bs-fg-muted hidden sm:inline">
              Rows per page
            </span>
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              aria-label="Select page size"
              className="bs-select h-8 w-[70px] text-sm font-mono tabular-nums"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-1">
          {showFirstLast && (
            <button
              type="button"
              onClick={() => onPageChange(1)}
              disabled={!canGoPrevious}
              aria-label="Go to first page"
              className="bs-btn bs-btn-ghost bs-btn-sm w-8 h-8 px-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
            </button>
          )}

          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={!canGoPrevious}
            aria-label="Go to previous page"
            className="bs-btn bs-btn-ghost bs-btn-sm w-8 h-8 px-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="flex items-center gap-1 px-2 font-mono tabular-nums">
            <span className="text-sm text-bs-fg">{page}</span>
            <span className="text-sm text-bs-fg-muted">/</span>
            <span className="text-sm text-bs-fg-muted">{totalPages || 1}</span>
          </div>

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={!canGoNext}
            aria-label="Go to next page"
            className="bs-btn bs-btn-ghost bs-btn-sm w-8 h-8 px-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>

          {showFirstLast && (
            <button
              type="button"
              onClick={() => onPageChange(totalPages)}
              disabled={!canGoNext}
              aria-label="Go to last page"
              className="bs-btn bs-btn-ghost bs-btn-sm w-8 h-8 px-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronsRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

Pagination.displayName = "Pagination";
