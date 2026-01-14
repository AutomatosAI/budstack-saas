"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Props for the SearchInput component.
 * @interface SearchInputProps
 */
export interface SearchInputProps {
  /** Current search value */
  value: string;
  /** Callback fired when search value changes (after debounce) */
  onChange: (value: string) => void;
  /** Placeholder text for the input */
  placeholder?: string;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Additional CSS classes */
  className?: string;
  /** Accessible label for screen readers */
  "aria-label"?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
}

/**
 * SearchInput - A debounced search input with clear functionality.
 *
 * Features:
 * - Configurable debounce delay (default 300ms)
 * - Clear button appears when input has value
 * - Accessible with proper ARIA labels
 * - Integrates with shadcn/ui Input component
 *
 * @example
 * ```tsx
 * <SearchInput
 *   value={search}
 *   onChange={setSearch}
 *   placeholder="Search tenants..."
 *   aria-label="Search tenants"
 * />
 * ```
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  debounceMs = 300,
  className,
  "aria-label": ariaLabel,
  disabled = false,
}: SearchInputProps) {
  const [localValue, setLocalValue] = React.useState(value);
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

  // Sync local value when external value changes
  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);

      // Clear existing timeout
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Set new debounced callback
      debounceRef.current = setTimeout(() => {
        onChange(newValue);
      }, debounceMs);
    },
    [onChange, debounceMs],
  );

  const handleClear = React.useCallback(() => {
    setLocalValue("");
    onChange("");
    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  }, [onChange]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className={cn("relative", className)}>
      <Search
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none"
        aria-hidden="true"
      />
      <Input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel || placeholder?.replace("...", "")}
        className={cn(
          "pl-9 pr-9 h-11 rounded-xl",
          "bg-white border-slate-200",
          "focus-visible:ring-accent/20 focus-visible:border-accent",
          "transition-all duration-200",
        )}
      />
      {localValue && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClear}
          disabled={disabled}
          aria-label="Clear search"
          className={cn(
            "absolute right-1 top-1/2 -translate-y-1/2",
            "h-7 w-7",
            "text-muted-foreground hover:text-foreground",
            "opacity-70 hover:opacity-100",
            "transition-opacity duration-150",
          )}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

SearchInput.displayName = "SearchInput";
