"use client";

import * as React from "react";
import Link from "next/link";
import { LucideIcon, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Action configuration for EmptyState buttons
 * @interface EmptyStateAction
 */
export interface EmptyStateAction {
  /** Button label */
  label: string;
  /** Button click handler (for onClick actions) */
  onClick?: () => void;
  /** Link href (for navigation actions) */
  href?: string;
  /** Lucide icon for the button */
  icon?: LucideIcon;
  /** Button variant */
  variant?: "default" | "outline" | "secondary";
}

/**
 * Props for the EmptyState component.
 * @interface EmptyStateProps
 */
export interface EmptyStateProps {
  /** Lucide icon component to display */
  icon?: LucideIcon;
  /** Main heading text */
  heading: string;
  /** Description text */
  description?: string;
  /** Primary call-to-action button configuration */
  action?: EmptyStateAction;
  /** Secondary action (typically a link or outline button) */
  secondaryAction?: EmptyStateAction;
  /** Additional CSS classes for the container */
  className?: string;
  /** Size variant */
  size?: "sm" | "default" | "lg";
  /** Visual variant for different contexts */
  variant?: "default" | "muted" | "card";
  /** Theme variant for contextual styling */
  theme?: "neutral" | "emerald" | "cyan" | "purple" | "slate" | "amber";
  /** Whether to show decorative background elements */
  showDecoration?: boolean;
}

/**
 * EmptyState - A configurable empty state component.
 *
 * Features:
 * - Customizable icon, heading, and description
 * - Optional primary and secondary action buttons
 * - Support for link-based actions (href) or click handlers
 * - Multiple size variants (sm, default, lg)
 * - Multiple visual variants (default, muted, card)
 * - Contextual theme colors
 * - Decorative background elements
 * - Accessible with proper semantic structure
 *
 * @example
 * ```tsx
 * // Basic empty state
 * <EmptyState
 *   heading="No products yet"
 *   description="Add your first product to get started"
 * />
 *
 * // With action button
 * <EmptyState
 *   icon={Package}
 *   heading="No products found"
 *   description="Try adjusting your search or filters"
 *   action={{
 *     label: "Clear filters",
 *     onClick: handleClearFilters,
 *   }}
 * />
 *
 * // With link action
 * <EmptyState
 *   icon={Building2}
 *   heading="No tenants yet"
 *   description="Review pending applications to onboard new tenants"
 *   action={{
 *     label: "Review Applications",
 *     href: "/super-admin/onboarding",
 *     icon: FileCheck,
 *   }}
 *   theme="slate"
 * />
 *
 * // Search/filter empty state
 * <EmptyState
 *   icon={Search}
 *   heading="No results found"
 *   description={`No results matching "${searchQuery}"`}
 *   variant="muted"
 *   size="sm"
 * />
 * ```
 */
export function EmptyState({
  icon: Icon = Inbox,
  heading,
  description,
  action,
  secondaryAction,
  className,
  size = "default",
  variant = "default",
  theme = "neutral",
  showDecoration = false,
}: EmptyStateProps) {
  const sizeClasses = {
    sm: {
      container: "py-8",
      icon: "h-10 w-10",
      iconWrapper: "h-16 w-16",
      heading: "text-base",
      description: "text-sm",
      decorCircle1: "w-24 h-24 -top-8 -right-8",
      decorCircle2: "w-16 h-16 -bottom-4 -left-4",
    },
    default: {
      container: "py-12",
      icon: "h-12 w-12",
      iconWrapper: "h-20 w-20",
      heading: "text-lg",
      description: "text-sm",
      decorCircle1: "w-32 h-32 -top-12 -right-12",
      decorCircle2: "w-20 h-20 -bottom-6 -left-6",
    },
    lg: {
      container: "py-16",
      icon: "h-16 w-16",
      iconWrapper: "h-24 w-24",
      heading: "text-xl",
      description: "text-base",
      decorCircle1: "w-40 h-40 -top-16 -right-16",
      decorCircle2: "w-24 h-24 -bottom-8 -left-8",
    },
  };

  const variantClasses = {
    default: {
      container: "bg-transparent",
      iconWrapper: "bg-muted/50",
      icon: "text-muted-foreground",
    },
    muted: {
      container: "bg-muted/30 rounded-lg border border-dashed border-border/60",
      iconWrapper: "bg-muted/70",
      icon: "text-muted-foreground/70",
    },
    card: {
      container: "bg-card rounded-lg border shadow-sm",
      iconWrapper: "bg-primary/5",
      icon: "text-primary/60",
    },
  };

  const themeClasses = {
    neutral: {
      iconWrapper: "",
      icon: "",
      button: "",
      decorBg: "bg-slate-200/30",
    },
    emerald: {
      iconWrapper: "bg-emerald-100/80",
      icon: "text-emerald-600",
      button: "bg-emerald-600 hover:bg-emerald-700 text-white",
      decorBg: "bg-emerald-200/30",
    },
    cyan: {
      iconWrapper: "bg-cyan-100/80",
      icon: "text-cyan-600",
      button: "bg-cyan-600 hover:bg-cyan-700 text-white",
      decorBg: "bg-cyan-200/30",
    },
    purple: {
      iconWrapper: "bg-purple-100/80",
      icon: "text-purple-600",
      button: "bg-purple-600 hover:bg-purple-700 text-white",
      decorBg: "bg-purple-200/30",
    },
    slate: {
      iconWrapper: "bg-slate-200/80",
      icon: "text-slate-600",
      button: "bg-slate-700 hover:bg-slate-800 text-white",
      decorBg: "bg-slate-200/30",
    },
    amber: {
      iconWrapper: "bg-amber-100/80",
      icon: "text-amber-600",
      button: "bg-amber-600 hover:bg-amber-700 text-white",
      decorBg: "bg-amber-200/30",
    },
  };

  const sizes = sizeClasses[size];
  const variants = variantClasses[variant];
  const themes = themeClasses[theme];

  // Helper to render action button (either as link or button)
  const renderAction = (actionConfig: EmptyStateAction, isPrimary: boolean) => {
    const IconComponent = actionConfig.icon;
    const buttonVariant =
      actionConfig.variant || (isPrimary ? "default" : "outline");

    // Determine button classes
    const buttonClasses = cn(
      isPrimary &&
        theme !== "neutral" &&
        buttonVariant === "default" &&
        themes.button,
    );

    const buttonContent = (
      <>
        {IconComponent && (
          <IconComponent className="h-4 w-4 mr-2" aria-hidden="true" />
        )}
        {actionConfig.label}
      </>
    );

    // Render as Link if href is provided, otherwise as Button
    if (actionConfig.href) {
      return (
        <Button variant={buttonVariant} className={buttonClasses} asChild>
          <Link href={actionConfig.href}>{buttonContent}</Link>
        </Button>
      );
    }

    return (
      <Button
        variant={buttonVariant}
        onClick={actionConfig.onClick}
        className={buttonClasses}
      >
        {buttonContent}
      </Button>
    );
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center text-center px-6 overflow-hidden",
        sizes.container,
        variants.container,
        className,
      )}
      role="status"
      aria-label={heading}
    >
      {/* Decorative background circles */}
      {showDecoration && (
        <>
          <div
            className={cn(
              "absolute rounded-full opacity-50 blur-xl",
              sizes.decorCircle1,
              themes.decorBg,
            )}
            aria-hidden="true"
          />
          <div
            className={cn(
              "absolute rounded-full opacity-40 blur-lg",
              sizes.decorCircle2,
              themes.decorBg,
            )}
            aria-hidden="true"
          />
        </>
      )}

      {/* Icon */}
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full mb-4",
          "transition-all duration-300 hover:scale-105",
          "shadow-sm",
          sizes.iconWrapper,
          theme === "neutral" ? variants.iconWrapper : themes.iconWrapper,
        )}
      >
        <Icon
          className={cn(
            sizes.icon,
            theme === "neutral" ? variants.icon : themes.icon,
            "transition-transform duration-300",
          )}
          aria-hidden="true"
        />
      </div>

      {/* Heading */}
      <h3 className={cn("font-semibold text-foreground mb-1", sizes.heading)}>
        {heading}
      </h3>

      {/* Description */}
      {description && (
        <p className={cn("text-muted-foreground max-w-sm", sizes.description)}>
          {description}
        </p>
      )}

      {/* Action buttons */}
      {(action || secondaryAction) && (
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
          {action && renderAction(action, true)}
          {secondaryAction && renderAction(secondaryAction, false)}
        </div>
      )}
    </div>
  );
}

EmptyState.displayName = "EmptyState";
