import * as React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AdminPageHeaderProps {
  eyebrow: string;
  eyebrowIcon?: LucideIcon;
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  align?: "center" | "start";
  className?: string;
}

export function AdminPageHeader({
  eyebrow,
  eyebrowIcon: Icon,
  title,
  subtitle,
  actions,
  align = "center",
  className,
}: AdminPageHeaderProps) {
  const isCentered = align === "center";

  return (
    <header
      className={cn(
        "admin-page-header",
        isCentered ? "admin-page-header--center" : "admin-page-header--start",
        className,
      )}
    >
      <div className="admin-page-header__copy">
        <div className="section-badge admin-page-header__eyebrow">
          {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
          {eyebrow}
        </div>
        <h1 className="admin-page-header__title font-display">{title}</h1>
        {subtitle ? (
          <p className="admin-page-header__subtitle">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="admin-page-header__actions">{actions}</div>
      ) : null}
    </header>
  );
}
