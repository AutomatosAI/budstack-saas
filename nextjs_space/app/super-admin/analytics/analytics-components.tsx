"use client";

import { cn } from "@/lib/utils";
import { sectionTitleStyle } from "./analytics-helpers";

interface ChartCardProps {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

export function ChartCard({
  title,
  subtitle,
  icon: Icon,
  children,
}: ChartCardProps) {
  return (
    <div className="bs-card bs-card-pad">
      <div className="flex items-center gap-2 mb-4">
        <div className="rounded-bs-md bg-bs-card-2 p-2">
          <Icon
            className="h-5 w-5 text-bs-fg"
            aria-hidden="true"
          />
        </div>
        <div>
          <h3
            className="text-[20px] leading-tight text-bs-fg"
            style={sectionTitleStyle}
          >
            {title}
          </h3>
          <p className="text-xs text-bs-fg-muted mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="h-[280px] relative">{children}</div>
    </div>
  );
}

interface AttentionItemProps {
  icon: React.ElementType;
  label: string;
  count: number;
  tone: "info" | "danger" | "warn";
}

export function AttentionItem({
  icon: Icon,
  label,
  count,
  tone,
}: AttentionItemProps) {
  const toneMap = {
    info: {
      bg: "bg-bs-info/10",
      border: "border-bs-info/30",
      icon: "text-bs-info",
      badge: "bg-bs-info text-bs-canvas",
    },
    danger: {
      bg: "bg-bs-danger/10",
      border: "border-bs-danger/30",
      icon: "text-bs-danger",
      badge: "bg-bs-danger text-bs-canvas",
    },
    warn: {
      bg: "bg-bs-warn/10",
      border: "border-bs-warn/30",
      icon: "text-bs-warn",
      badge: "bg-bs-warn text-bs-canvas",
    },
  };

  const colors = toneMap[tone];

  return (
    <div className="flex items-center justify-between p-4 rounded-bs-md border border-bs-border-100 hover:border-bs-fg-muted transition-colors">
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-bs-sm border", colors.bg, colors.border)}>
          <Icon
            className={cn("h-4 w-4", colors.icon)}
            aria-hidden="true"
          />
        </div>
        <span className="text-sm font-medium text-bs-fg">{label}</span>
      </div>
      <div
        className={cn(
          "px-3 py-1 rounded-full text-sm font-bold",
          colors.badge,
        )}
        style={{ fontFamily: "JetBrains Mono, monospace" }}
      >
        {count}
      </div>
    </div>
  );
}
