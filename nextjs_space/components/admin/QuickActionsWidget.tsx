"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Package,
  ShoppingBag,
  Users,
  BarChart3,
  Palette,
  Settings,
  LucideIcon,
} from "lucide-react";

interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  theme: "emerald" | "purple" | "cyan" | "amber" | "rose" | "slate";
}

export interface QuickActionsWidgetProps {
  className?: string;
  actions?: QuickAction[];
}

const defaultActions: QuickAction[] = [
  {
    label: "Add Product",
    href: "/tenant-admin/products",
    icon: Package,
    theme: "emerald",
  },
  {
    label: "View Orders",
    href: "/tenant-admin/orders",
    icon: ShoppingBag,
    theme: "purple",
  },
  {
    label: "Manage Customers",
    href: "/tenant-admin/customers",
    icon: Users,
    theme: "cyan",
  },
  {
    label: "View Analytics",
    href: "/tenant-admin/analytics",
    icon: BarChart3,
    theme: "amber",
  },
  {
    label: "Branding",
    href: "/tenant-admin/branding",
    icon: Palette,
    theme: "rose",
  },
  {
    label: "Settings",
    href: "/tenant-admin/settings",
    icon: Settings,
    theme: "slate",
  },
];

export const QuickActionsWidget = React.forwardRef<
  HTMLDivElement,
  QuickActionsWidgetProps
>(({ className, actions = defaultActions }, ref) => {
  return (
    <div ref={ref} className={cn("bs-card bs-card-pad", className)}>
      <div className="flex items-center gap-3 mb-6">
        <div className="rounded-xl p-2.5 bg-bs-card-2 border border-bs-border-100">
          <Package className="h-5 w-5 text-bs-green-soft" aria-hidden="true" />
        </div>
        <h3
          className="font-display text-[22px] text-bs-fg"
          style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
        >
          Quick Actions
        </h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {actions.map((action, index) => {
          const Icon = action.icon;
          const isPrimary = index === 0;

          return (
            <Link
              key={action.href}
              href={action.href}
              className={cn(
                "group relative flex flex-col items-center gap-3 p-5",
                "rounded-xl border border-bs-border-100 bg-bs-card-2",
                "transition-colors duration-200",
                "hover:border-bs-border hover:bg-bs-card-3",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bs-green/40",
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-12 h-12 rounded-xl",
                  isPrimary
                    ? "bg-bs-green/10 border border-bs-green/40"
                    : "bg-bs-card border border-bs-border-100",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5",
                    isPrimary ? "text-bs-green-soft" : "text-bs-fg-muted group-hover:text-bs-fg",
                  )}
                  aria-hidden="true"
                />
              </div>

              <span className="text-sm font-medium text-bs-fg text-center">
                {action.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
});

QuickActionsWidget.displayName = "QuickActionsWidget";
