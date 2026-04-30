"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
  "aria-label"?: string;
  disabled?: boolean;
}

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

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        onChange(newValue);
      }, debounceMs);
    },
    [onChange, debounceMs],
  );

  const handleClear = React.useCallback(() => {
    setLocalValue("");
    onChange("");
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
  }, [onChange]);

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
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bs-fg-muted pointer-events-none"
        aria-hidden="true"
      />
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel || placeholder?.replace("...", "")}
        className={cn("bs-input", "pl-9 pr-9 w-full")}
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled}
          aria-label="Clear search"
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2",
            "h-7 w-7 inline-flex items-center justify-center rounded-md",
            "text-bs-fg-muted hover:text-bs-fg",
            "hover:bg-bs-card-2",
            "transition-colors duration-150",
            "disabled:opacity-40 disabled:cursor-not-allowed",
          )}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

SearchInput.displayName = "SearchInput";
