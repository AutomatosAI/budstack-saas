'use client';

import React, { useState } from 'react';
import { Download, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * ExportButton Component
 *
 * A distinctive button for CSV export with "Data Extraction Console" aesthetic.
 * Features loading states, sparkle effects, and theme-specific styling.
 *
 * @example
 * ```tsx
 * <ExportButton
 *   onExport={() => handleExport()}
 *   recordCount={42}
 *   theme="tenant-admin"
 * />
 * ```
 */

export interface ExportButtonProps {
  /** Function to call when export is triggered */
  onExport: () => Promise<void> | void;
  /** Number of records that will be exported (for button text) */
  recordCount?: number;
  /** Theme variant for styling */
  theme?: 'super-admin' | 'tenant-admin';
  /** Additional CSS classes */
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Custom label (overrides default) */
  label?: string;
}

/**
 * ExportButton displays a themed export button with loading states and sparkle effects
 */
export const ExportButton = React.forwardRef<HTMLButtonElement, ExportButtonProps>(
  ({ onExport, recordCount, theme = 'tenant-admin', className, disabled = false, label }, ref) => {
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

    // Theme-specific styling
    const themeStyles = {
      'super-admin': {
        button: 'bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white border-slate-600',
        sparkle: 'text-slate-300',
        loadingRing: 'border-slate-400',
      },
      'tenant-admin': {
        button: 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white border-emerald-500/50',
        sparkle: 'text-emerald-200',
        loadingRing: 'border-cyan-300',
      },
    };

    const styles = themeStyles[theme];

    // Button text
    const buttonText = label || (recordCount !== undefined
      ? `Export ${recordCount} ${recordCount === 1 ? 'record' : 'records'}`
      : 'Export to CSV');

    return (
      <Button
        ref={ref}
        onClick={handleClick}
        disabled={disabled || isExporting || recordCount === 0}
        className={cn(
          'group relative overflow-hidden',
          'transition-all duration-300',
          'hover:shadow-lg hover:scale-[1.02]',
          'focus-visible:ring-2 focus-visible:ring-offset-2',
          theme === 'super-admin' ? 'focus-visible:ring-slate-400' : 'focus-visible:ring-cyan-400',
          styles.button,
          className
        )}
        aria-label={isExporting ? 'Exporting data...' : `Export ${recordCount || 0} records to CSV`}
      >
        {/* Shimmer effect on hover */}
        <span
          className={cn(
            'absolute inset-0 opacity-0 group-hover:opacity-100',
            'bg-gradient-to-r from-transparent via-white/10 to-transparent',
            'translate-x-[-100%] group-hover:translate-x-[100%]',
            'transition-all duration-700'
          )}
          aria-hidden="true"
        />

        {/* Content */}
        <span className="relative flex items-center gap-2">
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span className="font-medium">Exporting...</span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4 transition-transform group-hover:translate-y-[2px]" aria-hidden="true" />
              <span className="font-medium">{buttonText}</span>
              <Sparkles
                className={cn(
                  'h-3 w-3 opacity-0 group-hover:opacity-100 transition-all duration-300',
                  'animate-pulse',
                  styles.sparkle
                )}
                aria-hidden="true"
              />
            </>
          )}
        </span>

        {/* Extraction progress bar (shows during export) */}
        {isExporting && (
          <span
            className={cn(
              'absolute bottom-0 left-0 h-[2px] w-full',
              'bg-gradient-to-r from-transparent via-white to-transparent',
              'animate-[shimmer_1s_ease-in-out_infinite]'
            )}
            aria-hidden="true"
          />
        )}
      </Button>
    );
  }
);

ExportButton.displayName = 'ExportButton';
