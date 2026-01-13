"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A single breadcrumb item representing a navigation segment.
 * @interface BreadcrumbItem
 */
export interface BreadcrumbItem {
  /** Display label for the breadcrumb */
  label: string;
  /** URL to navigate to (omit for current page - last item) */
  href?: string;
}

/**
 * Props for the Breadcrumbs component.
 * @interface BreadcrumbsProps
 */
export interface BreadcrumbsProps {
  /** Array of breadcrumb items from root to current page */
  items: BreadcrumbItem[];
  /** Whether to show a home icon before the first item */
  showHomeIcon?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Accessible label for the nav element */
  "aria-label"?: string;
}

/**
 * Breadcrumbs - A navigation component showing the current location hierarchy.
 *
 * Features:
 * - Clickable links for parent pages
 * - Current page (last item) displayed as plain text
 * - ChevronRight separators between items
 * - Optional home icon for the first item
 * - Accessible with proper ARIA attributes
 * - Responsive design with truncation for long labels
 *
 * @example
 * ```tsx
 * // Super Admin - Tenant detail page
 * <Breadcrumbs
 *   items={[
 *     { label: 'Dashboard', href: '/super-admin' },
 *     { label: 'Tenants', href: '/super-admin/tenants' },
 *     { label: 'Healing Buds Store' },
 *   ]}
 * />
 *
 * // Tenant Admin - Customer detail page
 * <Breadcrumbs
 *   items={[
 *     { label: 'Dashboard', href: '/tenant-admin' },
 *     { label: 'Customers', href: '/tenant-admin/customers' },
 *     { label: 'John Smith' },
 *   ]}
 * />
 * ```
 */
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
              {/* Separator (skip for first item) */}
              {!isFirst && (
                <ChevronRight
                  className="h-4 w-4 text-gray-400 mx-1.5 flex-shrink-0"
                  aria-hidden="true"
                />
              )}

              {/* Breadcrumb content */}
              {isLast || !item.href ? (
                // Current page (last item) - plain text
                <span
                  className={cn(
                    "font-medium text-gray-900 truncate max-w-[200px]",
                    "transition-colors duration-150",
                  )}
                  aria-current="page"
                  title={item.label}
                >
                  {item.label}
                </span>
              ) : (
                // Parent pages - clickable links
                <Link
                  href={item.href}
                  className={cn(
                    "text-gray-600 hover:text-gray-900",
                    "truncate max-w-[200px]",
                    "transition-colors duration-150",
                    "hover:underline underline-offset-2",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:rounded-sm",
                    "flex items-center gap-1.5",
                  )}
                  title={item.label}
                >
                  {/* Optional home icon for first item */}
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
