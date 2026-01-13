"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Props for the Pagination component.
 * @interface PaginationProps
 */
export interface PaginationProps {
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of items */
  totalItems: number;
  /** Callback fired when page changes */
  onPageChange: (page: number) => void;
  /** Callback fired when page size changes */
  onPageSizeChange?: (pageSize: number) => void;
  /** Available page size options */
  pageSizeOptions?: number[];
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the page size selector */
  showPageSizeSelector?: boolean;
  /** Whether to show first/last page buttons */
  showFirstLast?: boolean;
}

/**
 * Pagination - Page navigation with size selector.
 *
 * Features:
 * - Configurable page size options
 * - First/Last page navigation buttons
 * - Shows "Showing X-Y of Z results" summary
 * - Accessible with proper ARIA labels
 * - Integrates with shadcn/ui components
 *
 * @example
 * ```tsx
 * <Pagination
 *   page={currentPage}
 *   pageSize={20}
 *   totalItems={156}
 *   onPageChange={setCurrentPage}
 *   onPageSizeChange={setPageSize}
 *   pageSizeOptions={[10, 20, 50, 100]}
 * />
 * ```
 */
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
    (value: string) => {
      const newPageSize = parseInt(value, 10);
      onPageSizeChange?.(newPageSize);
      // Reset to page 1 when changing page size to avoid being on an invalid page
      if (page > Math.ceil(totalItems / newPageSize)) {
        onPageChange(1);
      }
    },
    [page, totalItems, onPageChange, onPageSizeChange],
  );

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-4",
        "py-4 px-2",
        className,
      )}
      role="navigation"
      aria-label="Pagination"
    >
      {/* Results summary */}
      <p className="text-sm text-muted-foreground order-2 sm:order-1">
        Showing <span className="font-medium text-foreground">{startItem}</span>
        {" - "}
        <span className="font-medium text-foreground">{endItem}</span>
        {" of "}
        <span className="font-medium text-foreground">{totalItems}</span>
        {" results"}
      </p>

      <div className="flex items-center gap-4 order-1 sm:order-2">
        {/* Page size selector */}
        {showPageSizeSelector && onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Rows per page
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={handlePageSizeChange}
            >
              <SelectTrigger
                className={cn(
                  "w-[70px] h-8",
                  "bg-background/50 backdrop-blur-sm",
                  "border-border/60 hover:border-border",
                  "focus:ring-primary/20 focus:border-primary",
                  "transition-all duration-200",
                )}
                aria-label="Select page size"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                className={cn(
                  "bg-popover/95 backdrop-blur-md",
                  "border-border/60",
                  "shadow-lg shadow-black/5",
                  "min-w-[70px]",
                )}
              >
                {pageSizeOptions.map((size) => (
                  <SelectItem
                    key={size}
                    value={String(size)}
                    className="cursor-pointer"
                  >
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          {showFirstLast && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(1)}
              disabled={!canGoPrevious}
              aria-label="Go to first page"
              className={cn(
                "h-8 w-8",
                "border-border/60 hover:border-border",
                "bg-background/50 hover:bg-accent",
                "transition-all duration-200",
              )}
            >
              <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}

          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(page - 1)}
            disabled={!canGoPrevious}
            aria-label="Go to previous page"
            className={cn(
              "h-8 w-8",
              "border-border/60 hover:border-border",
              "bg-background/50 hover:bg-accent",
              "transition-all duration-200",
            )}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>

          {/* Page indicator */}
          <div className="flex items-center gap-1 px-2">
            <span className="text-sm font-medium tabular-nums">{page}</span>
            <span className="text-sm text-muted-foreground">/</span>
            <span className="text-sm text-muted-foreground tabular-nums">
              {totalPages || 1}
            </span>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => onPageChange(page + 1)}
            disabled={!canGoNext}
            aria-label="Go to next page"
            className={cn(
              "h-8 w-8",
              "border-border/60 hover:border-border",
              "bg-background/50 hover:bg-accent",
              "transition-all duration-200",
            )}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>

          {showFirstLast && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(totalPages)}
              disabled={!canGoNext}
              aria-label="Go to last page"
              className={cn(
                "h-8 w-8",
                "border-border/60 hover:border-border",
                "bg-background/50 hover:bg-accent",
                "transition-all duration-200",
              )}
            >
              <ChevronsRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

Pagination.displayName = "Pagination";
