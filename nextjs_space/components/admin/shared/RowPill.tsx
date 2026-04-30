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

const TONE_TO_CHIP: Record<RowPillTone, string> = {
  emerald: "bs-chip-green",
  amber: "bs-chip-warn",
  red: "bs-chip-danger",
  slate: "bs-chip-muted",
  gold: "bs-chip-gold",
  blue: "bs-chip-info",
  purple: "bs-chip-info",
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
      data-tone={tone}
      className={cn("bs-chip", TONE_TO_CHIP[tone], className)}
    >
      {Icon ? <Icon className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
