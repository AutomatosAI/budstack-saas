'use client';

import * as React from 'react';
import { Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

/**
 * Option for the StatusFilter dropdown.
 * @interface StatusFilterOption
 */
export interface StatusFilterOption<T extends string = string> {
  /** Unique value for this option */
  value: T;
  /** Display label for the option */
  label: string;
  /** Optional count to display as badge */
  count?: number;
}

/**
 * Props for the StatusFilter component.
 * @interface StatusFilterProps
 */
export interface StatusFilterProps<T extends string = string> {
  /** Currently selected value */
  value: T;
  /** Callback fired when selection changes */
  onChange: (value: T) => void;
  /** Array of filter options */
  options: StatusFilterOption<T>[];
  /** Placeholder text when no value selected */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Accessible label for screen readers */
  'aria-label'?: string;
  /** Whether to show the filter icon */
  showIcon?: boolean;
  /** Whether the filter is disabled */
  disabled?: boolean;
}

/**
 * StatusFilter - A dropdown filter for status/category values.
 *
 * Features:
 * - Generic typing for filter values
 * - Optional count badges on each option
 * - Configurable filter icon
 * - Accessible with proper ARIA labels
 * - Integrates with shadcn/ui Select component
 *
 * @example
 * ```tsx
 * const statusOptions = [
 *   { value: 'all', label: 'All Tenants' },
 *   { value: 'active', label: 'Active Only', count: 15 },
 *   { value: 'inactive', label: 'Inactive Only', count: 3 },
 * ];
 *
 * <StatusFilter
 *   value={status}
 *   onChange={setStatus}
 *   options={statusOptions}
 *   aria-label="Filter by status"
 * />
 * ```
 */
export function StatusFilter<T extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Filter...',
  className,
  'aria-label': ariaLabel,
  showIcon = true,
  disabled = false,
}: StatusFilterProps<T>) {
  return (
    <Select
      value={value}
      onValueChange={(val) => onChange(val as T)}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn(
          'w-[180px]',
          'bg-background/50 backdrop-blur-sm',
          'border-border/60 hover:border-border',
          'focus:ring-primary/20 focus:border-primary',
          'transition-all duration-200',
          className
        )}
        aria-label={ariaLabel || 'Filter by status'}
      >
        <div className="flex items-center gap-2">
          {showIcon && (
            <Filter
              className="h-4 w-4 text-muted-foreground shrink-0"
              aria-hidden="true"
            />
          )}
          <SelectValue placeholder={placeholder} />
        </div>
      </SelectTrigger>
      <SelectContent
        className={cn(
          'bg-popover/95 backdrop-blur-md',
          'border-border/60',
          'shadow-lg shadow-black/5'
        )}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className={cn(
              'cursor-pointer',
              'focus:bg-accent/80',
              'transition-colors duration-150'
            )}
          >
            <div className="flex items-center justify-between w-full gap-3">
              <span>{option.label}</span>
              {typeof option.count === 'number' && (
                <Badge
                  variant="secondary"
                  className={cn(
                    'ml-auto',
                    'h-5 px-1.5 text-[10px] font-medium',
                    'bg-muted/80 text-muted-foreground'
                  )}
                >
                  {option.count}
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

StatusFilter.displayName = 'StatusFilter';
