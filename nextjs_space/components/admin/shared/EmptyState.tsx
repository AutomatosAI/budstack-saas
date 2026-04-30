"use client";

import * as React from "react";
import Link from "next/link";
import { LucideIcon, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  href?: string;
  icon?: LucideIcon;
  variant?: "default" | "outline" | "secondary";
}

export interface EmptyStateProps {
  icon?: LucideIcon;
  heading: string;
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "muted" | "card";
  theme?: "neutral" | "emerald" | "cyan" | "purple" | "slate" | "amber";
  showDecoration?: boolean;
}

export function EmptyState({
  icon: Icon = Inbox,
  heading,
  description,
  action,
  secondaryAction,
  className,
  size = "default",
}: EmptyStateProps) {
  const sizeClasses = {
    sm: {
      container: "py-8",
      iconWrapper: "h-14 w-14",
      icon: "h-6 w-6",
      heading: "text-[18px]",
    },
    default: {
      container: "py-12",
      iconWrapper: "h-16 w-16",
      icon: "h-7 w-7",
      heading: "text-[22px]",
    },
    lg: {
      container: "py-16",
      iconWrapper: "h-20 w-20",
      icon: "h-8 w-8",
      heading: "text-[26px]",
    },
  };

  const sizes = sizeClasses[size];

  const renderAction = (cfg: EmptyStateAction, isPrimary: boolean) => {
    const IconComponent = cfg.icon;
    const buttonClass = cn(
      "bs-btn",
      isPrimary ? "bs-btn-green" : "bs-btn-ghost",
    );

    const buttonContent = (
      <>
        {IconComponent && (
          <IconComponent className="h-4 w-4" aria-hidden="true" />
        )}
        <span>{cfg.label}</span>
      </>
    );

    if (cfg.href) {
      return (
        <Link href={cfg.href} className={buttonClass}>
          {buttonContent}
        </Link>
      );
    }

    return (
      <button type="button" onClick={cfg.onClick} className={buttonClass}>
        {buttonContent}
      </button>
    );
  };

  return (
    <div
      className={cn(
        "bs-card bs-card-pad",
        "flex flex-col items-center justify-center text-center px-6",
        sizes.container,
        className,
      )}
      role="status"
      aria-label={heading}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full mb-4",
          "bg-bs-card-2 border border-bs-border-100",
          sizes.iconWrapper,
        )}
      >
        <Icon
          className={cn(sizes.icon, "text-bs-fg-muted")}
          aria-hidden="true"
        />
      </div>

      <h3
        className={cn(
          "font-display text-bs-fg mb-1",
          sizes.heading,
        )}
        style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
      >
        {heading}
      </h3>

      {description && (
        <p className="text-bs-fg-muted text-sm max-w-sm">{description}</p>
      )}

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
