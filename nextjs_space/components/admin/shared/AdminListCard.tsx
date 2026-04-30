import * as React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AdminListCardProps {
  title: string;
  titleIcon?: LucideIcon;
  count?: number | string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function AdminListCard({
  title,
  titleIcon: Icon,
  count,
  filters,
  actions,
  children,
  className,
  bodyClassName,
}: AdminListCardProps) {
  return (
    <section className={cn("admin-list-card card-floating-static", className)}>
      <header className="admin-list-card__header">
        <div className="admin-list-card__title">
          {Icon ? (
            <span className="admin-list-card__title-icon">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
          ) : null}
          <h2 className="admin-list-card__title-text font-display">{title}</h2>
          {count !== undefined ? (
            <span className="admin-list-card__count" aria-label={`${count} items`}>
              {count}
            </span>
          ) : null}
        </div>
        {filters ? (
          <div className="admin-list-card__filters">{filters}</div>
        ) : null}
        {actions ? (
          <div className="admin-list-card__actions">{actions}</div>
        ) : null}
      </header>
      <div className={cn("admin-list-card__body", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
