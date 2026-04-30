import * as React from "react";
import { cn } from "@/lib/utils";

export interface AdminStatGridProps {
  columns?: 2 | 3 | 4;
  children: React.ReactNode;
  className?: string;
}

export function AdminStatGrid({
  columns = 4,
  children,
  className,
}: AdminStatGridProps) {
  return (
    <div
      className={cn(
        "admin-stat-grid",
        `admin-stat-grid--${columns}`,
        className,
      )}
    >
      {children}
    </div>
  );
}
