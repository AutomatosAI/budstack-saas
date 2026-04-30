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
  | "blue"
  | "purple";

export interface RowPillProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: RowPillTone;
  icon?: LucideIcon;
  children: React.ReactNode;
}

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
      data-tone={tone}
      className={cn("row-pill", className)}
    >
      {Icon ? <Icon className="row-pill-icon" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
