"use client";

import * as React from "react";
import { Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatusFilterOption<T extends string = string> {
  value: T;
  label: string;
  count?: number;
}

export interface StatusFilterProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: StatusFilterOption<T>[];
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  showIcon?: boolean;
  disabled?: boolean;
}

export function StatusFilter<T extends string = string>({
  value,
  onChange,
  options,
  placeholder,
  className,
  "aria-label": ariaLabel,
  showIcon = true,
  disabled = false,
}: StatusFilterProps<T>) {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(event.target.value as T);
  };

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      {showIcon && (
        <Filter
          className="absolute left-3 h-4 w-4 text-bs-fg-muted pointer-events-none"
          aria-hidden="true"
        />
      )}
      <select
        value={value}
        onChange={handleChange}
        disabled={disabled}
        aria-label={ariaLabel || "Filter by status"}
        className={cn(
          "bs-select min-w-[180px]",
          showIcon && "pl-9",
        )}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {typeof option.count === "number"
              ? `${option.label} (${option.count})`
              : option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

StatusFilter.displayName = "StatusFilter";
