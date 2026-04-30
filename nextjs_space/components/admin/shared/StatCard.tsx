import * as React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  hint?: React.ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  className,
}: StatCardProps) {
  return (
    <div className={cn("card-floating-static p-6", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className="font-display text-3xl font-bold leading-tight text-foreground">
            {value}
          </p>
          {hint ? (
            <p className="text-xs font-medium text-slate-500">{hint}</p>
          ) : null}
        </div>
        <div className="rounded-xl bg-emerald-50 p-2.5 shrink-0">
          <Icon className="h-5 w-5 text-emerald-600" />
        </div>
      </div>
    </div>
  );
}
