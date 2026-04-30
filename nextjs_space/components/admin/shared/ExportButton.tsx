"use client";

import React, { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExportButtonProps {
  onExport: () => Promise<void> | void;
  recordCount?: number;
  theme?: "super-admin" | "tenant-admin";
  className?: string;
  disabled?: boolean;
  label?: string;
}

export const ExportButton = React.forwardRef<
  HTMLButtonElement,
  ExportButtonProps
>(
  (
    {
      onExport,
      recordCount,
      className,
      disabled = false,
      label,
    },
    ref,
  ) => {
    const [isExporting, setIsExporting] = useState(false);

    const handleClick = async () => {
      if (isExporting || disabled) return;

      setIsExporting(true);
      try {
        await onExport();
      } finally {
        setIsExporting(false);
      }
    };

    const buttonText =
      label ||
      (recordCount !== undefined
        ? `Export ${recordCount} ${recordCount === 1 ? "record" : "records"}`
        : "Export to CSV");

    return (
      <button
        ref={ref}
        type="button"
        onClick={handleClick}
        disabled={disabled || isExporting || recordCount === 0}
        className={cn(
          "bs-btn bs-btn-ghost bs-btn-sm",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          className,
        )}
        aria-label={
          isExporting
            ? "Exporting data..."
            : `Export ${recordCount || 0} records to CSV`
        }
      >
        {isExporting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Exporting...</span>
          </>
        ) : (
          <>
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>{buttonText}</span>
          </>
        )}
      </button>
    );
  },
);

ExportButton.displayName = "ExportButton";
