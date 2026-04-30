"use client";

import * as React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type RowPillTone =
  | "emerald"
  | "amber"
  | "red"
  | "slate"
  | "gold"
  | "blue";

export interface RowPillProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: RowPillTone;
  icon?: LucideIcon;
  children: React.ReactNode;
}

const TONE_CLASSES: Record<RowPillTone, string> = {
  emerald: "bg-emerald-100 text-emerald-800 border-emerald-200",
  amber: "bg-amber-100 text-amber-800 border-amber-200",
  red: "bg-red-100 text-red-800 border-red-200",
  slate: "bg-slate-100 text-slate-700 border-slate-200",
  gold: "bg-amber-50 text-amber-800 border-amber-300/60",
  blue: "bg-blue-100 text-blue-800 border-blue-200",
};

export function RowPill({
  tone = "slate",
  icon: Icon,
  className,
  children,
  ...rest
}: RowPillProps) {
  return (
    <span
      {...rest}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {children}
    </span>
  );
}
