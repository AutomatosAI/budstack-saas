"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  showHomeIcon?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function Breadcrumbs({
  items,
  showHomeIcon = false,
  className,
  "aria-label": ariaLabel = "Breadcrumb navigation",
}: BreadcrumbsProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label={ariaLabel}
      className={cn("flex items-center text-sm", className)}
    >
      <ol className="flex items-center flex-wrap gap-1">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isFirst = index === 0;

          return (
            <li key={index} className="flex items-center">
              {!isFirst && (
                <ChevronRight
                  className="h-4 w-4 text-bs-border mx-1.5 flex-shrink-0"
                  aria-hidden="true"
                />
              )}

              {isLast || !item.href ? (
                <span
                  className="font-medium text-bs-fg truncate max-w-[200px]"
                  aria-current="page"
                  title={item.label}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className={cn(
                    "text-bs-fg-muted hover:text-bs-fg",
                    "truncate max-w-[200px]",
                    "transition-colors duration-150",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bs-green/40 focus-visible:rounded-sm",
                    "flex items-center gap-1.5",
                  )}
                  title={item.label}
                >
                  {isFirst && showHomeIcon && (
                    <Home
                      className="h-3.5 w-3.5 flex-shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate">{item.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

Breadcrumbs.displayName = "Breadcrumbs";
