"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Package,
  ShoppingBag,
  Users,
  BarChart3,
  Palette,
  Settings,
  LucideIcon,
} from "lucide-react";

/**
 * Quick action button configuration
 */
interface QuickAction {
  /** Action label */
  label: string;
  /** Action URL */
  href: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Theme color for the action */
  theme: "emerald" | "purple" | "cyan" | "amber" | "rose" | "slate";
}

/**
 * Props for QuickActionsWidget component
 */
export interface QuickActionsWidgetProps {
  /** Optional custom className */
  className?: string;
  /** Optional custom actions (defaults to tenant admin actions) */
  actions?: QuickAction[];
}

/**
 * Default tenant admin quick actions
 */
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

/**
 * Theme color mappings for action buttons
 * Updated with darker gradients for WCAG AA contrast compliance (4.5:1 on white backgrounds)
 */
const themeColors = {
  emerald: {
    border: "border-emerald-200",
    shadow: "shadow-emerald-100",
    hoverShadow: "hover:shadow-emerald-200",
    iconBg: "bg-gradient-to-br from-emerald-400 to-emerald-600",
    iconRing: "ring-emerald-100",
    labelGradient: "from-emerald-700 to-emerald-800",
    hoverBorder: "hover:border-emerald-300",
    activeBg: "active:bg-emerald-50",
  },
  purple: {
    border: "border-purple-200",
    shadow: "shadow-purple-100",
    hoverShadow: "hover:shadow-purple-200",
    iconBg: "bg-gradient-to-br from-purple-400 to-purple-600",
    iconRing: "ring-purple-100",
    labelGradient: "from-purple-700 to-purple-800",
    hoverBorder: "hover:border-purple-300",
    activeBg: "active:bg-purple-50",
  },
  cyan: {
    border: "border-cyan-200",
    shadow: "shadow-cyan-100",
    hoverShadow: "hover:shadow-cyan-200",
    iconBg: "bg-gradient-to-br from-cyan-400 to-cyan-600",
    iconRing: "ring-cyan-100",
    labelGradient: "from-cyan-700 to-cyan-800",
    hoverBorder: "hover:border-cyan-300",
    activeBg: "active:bg-cyan-50",
  },
  amber: {
    border: "border-amber-200",
    shadow: "shadow-amber-100",
    hoverShadow: "hover:shadow-amber-200",
    iconBg: "bg-gradient-to-br from-amber-400 to-amber-600",
    iconRing: "ring-amber-100",
    labelGradient: "from-amber-700 to-amber-800",
    hoverBorder: "hover:border-amber-300",
    activeBg: "active:bg-amber-50",
  },
  rose: {
    border: "border-rose-200",
    shadow: "shadow-rose-100",
    hoverShadow: "hover:shadow-rose-200",
    iconBg: "bg-gradient-to-br from-rose-400 to-rose-600",
    iconRing: "ring-rose-100",
    labelGradient: "from-rose-700 to-rose-800",
    hoverBorder: "hover:border-rose-300",
    activeBg: "active:bg-rose-50",
  },
  slate: {
    border: "border-slate-200",
    shadow: "shadow-slate-100",
    hoverShadow: "hover:shadow-slate-200",
    iconBg: "bg-gradient-to-br from-slate-400 to-slate-600",
    iconRing: "ring-slate-100",
    labelGradient: "from-slate-700 to-slate-800",
    hoverBorder: "hover:border-slate-300",
    activeBg: "active:bg-slate-50",
  },
};

/**
 * QuickActionsWidget - Command center style shortcut widget for tenant admin dashboard
 *
 * Features a refined, tactile aesthetic inspired by professional control surfaces.
 * Each action button has depth, materiality, and satisfying hover interactions.
 *
 * @example
 * ```tsx
 * <QuickActionsWidget />
 * ```
 */
export const QuickActionsWidget = React.forwardRef<
  HTMLDivElement,
  QuickActionsWidgetProps
>(({ className, actions = defaultActions }, ref) => {
  return (
    <Card
      ref={ref}
      className={cn(
        "saas-card border-0 bg-white/80 shadow-xl",
        className,
      )}
    >
      <CardHeader className="border-b border-slate-100 bg-white/70 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
          <CardTitle className="text-lg font-semibold tracking-tight text-slate-900">
            Quick Actions
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {actions.map((action, index) => {
            const Icon = action.icon;
            const colors = themeColors[action.theme];

            return (
              <Link
                key={action.href}
                href={action.href}
                className={cn(
                  "group relative flex flex-col items-center gap-3 p-5",
                  "bg-white/90 border rounded-2xl",
                  "transition-all duration-300 ease-out",
                  "hover:scale-[1.02] hover:-translate-y-1",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2",
                  colors.border,
                  colors.shadow,
                  colors.hoverShadow,
                  colors.hoverBorder,
                  colors.activeBg,
                  "shadow-lg hover:shadow-xl",
                )}
                style={{
                  animationDelay: `${index * 50}ms`,
                }}
              >
                {/* Icon container with metallic depth effect */}
                <div
                  className={cn(
                    "relative flex items-center justify-center",
                    "w-14 h-14 rounded-xl",
                    "ring-4 transition-all duration-300",
                    colors.iconBg,
                    colors.iconRing,
                    "group-hover:scale-110 group-hover:rotate-3",
                    "group-active:scale-95 group-active:rotate-0",
                    "shadow-md group-hover:shadow-lg",
                  )}
                >
                  {/* Inner shadow effect for depth */}
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent" />
                  <Icon
                    className="h-6 w-6 text-white relative z-10"
                    strokeWidth={2.5}
                  />
                </div>

                {/* Label with gradient text */}
                <span
                  className={cn(
                    "text-sm font-bold text-center tracking-tight leading-tight",
                    "bg-gradient-to-br bg-clip-text text-transparent",
                    colors.labelGradient,
                    "group-hover:scale-105 transition-transform duration-300",
                  )}
                >
                  {action.label}
                </span>

                {/* Subtle shine effect on hover */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-transparent via-white/0 to-white/0 group-hover:via-white/10 transition-all duration-500" />
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
});

QuickActionsWidget.displayName = "QuickActionsWidget";
