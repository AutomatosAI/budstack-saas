"use client";

import * as React from "react";
import { X, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Action definition for the BulkActionBar.
 * @interface BulkAction
 */
export interface BulkAction {
  /** Unique identifier for the action */
  id: string;
  /** Display label for the action */
  label: string;
  /** Lucide icon component for the action */
  icon?: LucideIcon;
  /** Button variant */
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  /** Callback when action is clicked */
  onClick: () => void;
  /** Whether the action is disabled */
  disabled?: boolean;
}

/**
 * Props for the BulkActionBar component.
 * @interface BulkActionBarProps
 */
export interface BulkActionBarProps {
  /** Number of items currently selected */
  selectedCount: number;
  /** Label for the type of items selected (e.g., "tenants", "products") */
  itemLabel?: string;
  /** Array of available bulk actions */
  actions: BulkAction[];
  /** Callback to clear selection */
  onClearSelection: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Whether the bar is visible (defaults to showing when selectedCount > 0) */
  visible?: boolean;
}

/**
 * BulkActionBar - A floating action bar for bulk operations.
 *
 * Features:
 * - Shows selected item count
 * - Configurable action buttons with icons
 * - Cancel/clear selection button
 * - Animated entrance/exit
 * - Fixed positioning at bottom of viewport
 *
 * @example
 * ```tsx
 * const bulkActions = [
 *   { id: 'activate', label: 'Activate', icon: Check, onClick: handleActivate },
 *   { id: 'deactivate', label: 'Deactivate', icon: XCircle, onClick: handleDeactivate },
 *   { id: 'export', label: 'Export CSV', icon: Download, onClick: handleExport },
 *   { id: 'delete', label: 'Delete', icon: Trash2, variant: 'destructive', onClick: handleDelete },
 * ];
 *
 * <BulkActionBar
 *   selectedCount={selectedIds.length}
 *   itemLabel="tenants"
 *   actions={bulkActions}
 *   onClearSelection={() => setSelectedIds([])}
 * />
 * ```
 */
export function BulkActionBar({
  selectedCount,
  itemLabel = "items",
  actions,
  onClearSelection,
  className,
  visible,
}: BulkActionBarProps) {
  const isVisible = visible ?? selectedCount > 0;

  // Pluralize item label
  const pluralLabel =
    selectedCount === 1 ? itemLabel.replace(/s$/, "") : itemLabel;

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        // Container positioning
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-40",
        // Visual styling
        "flex items-center gap-3",
        "px-4 py-3 rounded-xl",
        "bg-foreground/95 backdrop-blur-lg",
        "shadow-2xl shadow-black/20",
        "border border-border/10",
        // Animation
        "animate-in fade-in-0 slide-in-from-bottom-4 duration-300",
        className,
      )}
      role="toolbar"
      aria-label={`Bulk actions for ${selectedCount} selected ${pluralLabel}`}
    >
      {/* Selection count */}
      <div className="flex items-center gap-2 pr-3 border-r border-background/20">
        <span className="text-sm font-medium text-background">
          {selectedCount} {pluralLabel} selected
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {actions.map((action) => {
          const IconComponent = action.icon;
          return (
            <Button
              key={action.id}
              variant={action.variant || "secondary"}
              size="sm"
              onClick={action.onClick}
              disabled={action.disabled}
              className={cn(
                "h-8 px-3",
                "font-medium",
                "transition-all duration-200",
                action.variant === "destructive"
                  ? "bg-destructive hover:bg-destructive/90"
                  : action.variant === "outline"
                    ? "bg-background/10 hover:bg-background/20 text-background border-background/30"
                    : "bg-background/90 hover:bg-background text-foreground",
              )}
            >
              {IconComponent && (
                <IconComponent
                  className="h-3.5 w-3.5 mr-1.5"
                  aria-hidden="true"
                />
              )}
              {action.label}
            </Button>
          );
        })}
      </div>

      {/* Cancel button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClearSelection}
        aria-label="Clear selection"
        className={cn(
          "h-8 w-8 ml-1",
          "text-background/70 hover:text-background",
          "hover:bg-background/10",
          "transition-colors duration-200",
        )}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

BulkActionBar.displayName = "BulkActionBar";
