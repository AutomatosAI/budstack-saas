"use client";

import * as React from "react";
import { X, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BulkAction {
  id: string;
  label: string;
  icon?: LucideIcon;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  onClick: () => void;
  disabled?: boolean;
}

export interface BulkActionBarProps {
  selectedCount: number;
  itemLabel?: string;
  actions: BulkAction[];
  onClearSelection: () => void;
  className?: string;
  visible?: boolean;
}

export function BulkActionBar({
  selectedCount,
  itemLabel = "items",
  actions,
  onClearSelection,
  className,
  visible,
}: BulkActionBarProps) {
  const isVisible = visible ?? selectedCount > 0;

  const pluralLabel =
    selectedCount === 1 ? itemLabel.replace(/s$/, "") : itemLabel;

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-0 inset-x-0 z-40",
        "flex items-center justify-between gap-4 px-6 py-3",
        "bg-bs-card border-t border-bs-border-100",
        "shadow-[0_-8px_24px_rgba(0,0,0,0.4)]",
        "animate-in fade-in-0 slide-in-from-bottom-4 duration-300",
        className,
      )}
      role="toolbar"
      aria-label={`Bulk actions for ${selectedCount} selected ${pluralLabel}`}
    >
      <div className="flex items-center gap-3">
        <span className="font-mono tabular-nums text-sm text-bs-fg">
          <span className="text-bs-gold">{selectedCount}</span>
          <span className="text-bs-fg-muted ml-1">{pluralLabel} selected</span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        {actions.map((action) => {
          const IconComponent = action.icon;
          const isDestructive = action.variant === "destructive";
          return (
            <button
              key={action.id}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className={cn(
                "bs-btn bs-btn-sm",
                isDestructive ? "bs-btn-danger" : "bs-btn-ghost",
                "disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              {IconComponent && (
                <IconComponent className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{action.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onClearSelection}
          aria-label="Clear selection"
          className="bs-btn bs-btn-ghost bs-btn-sm w-8 h-8 px-0 ml-1"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

BulkActionBar.displayName = "BulkActionBar";
