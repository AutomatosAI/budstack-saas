import * as React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  hint?: React.ReactNode;
  delta?: { value: string; direction: "up" | "down" };
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  delta,
  className,
}: StatCardProps) {
  return (
    <div className={cn("bs-stat", className)}>
      <div className="bs-stat-row">
        <span className="bs-stat-label">{label}</span>
        <span className="bs-stat-icon">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="bs-stat-value">{value}</div>
      {delta ? (
        <div
          className={cn(
            "bs-stat-delta",
            delta.direction === "up" && "text-bs-green-soft",
            delta.direction === "down" && "text-bs-danger",
          )}
        >
          <span aria-hidden="true">{delta.direction === "up" ? "↑" : "↓"}</span>
          {delta.value}
        </div>
      ) : hint ? (
        <div className="bs-stat-delta">{hint}</div>
      ) : null}
    </div>
  );
}
