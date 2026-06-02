"use client";

import React from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  UserPlus,
  ShoppingBag,
  Settings,
  AlertTriangle,
  ArrowRight,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type EventType =
  | "TENANT_CREATED"
  | "TENANT_ACTIVATED"
  | "USER_REGISTERED"
  | "ORDER_PLACED"
  | "TENANT_SETTINGS_UPDATED"
  | "SYSTEM_ALERT";

export interface TimelineEvent {
  id: string;
  type: EventType;
  description: string;
  timestamp: Date;
  actor?: string;
  metadata?: Record<string, any>;
}

export interface ActivityTimelineProps {
  events: TimelineEvent[];
  className?: string;
  maxVisible?: number;
  showViewAll?: boolean;
}

const eventConfig: Record<
  EventType,
  {
    icon: React.ComponentType<{ className?: string }>;
    chip: string;
    label: string;
  }
> = {
  TENANT_CREATED: {
    icon: Building2,
    chip: "bs-chip bs-chip-info",
    label: "Tenant Created",
  },
  TENANT_ACTIVATED: {
    icon: CheckCircle2,
    chip: "bs-chip bs-chip-green",
    label: "Tenant Activated",
  },
  USER_REGISTERED: {
    icon: UserPlus,
    chip: "bs-chip bs-chip-info",
    label: "User Registered",
  },
  ORDER_PLACED: {
    icon: ShoppingBag,
    chip: "bs-chip bs-chip-info",
    label: "Order Placed",
  },
  TENANT_SETTINGS_UPDATED: {
    icon: Settings,
    chip: "bs-chip bs-chip-muted",
    label: "Settings Updated",
  },
  SYSTEM_ALERT: {
    icon: AlertTriangle,
    chip: "bs-chip bs-chip-warn",
    label: "System Alert",
  },
};

function formatTimestamp(date: Date): {
  time: string;
  date: string;
  relative: string;
} {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  let relative = "";
  if (diffMins < 1) relative = "Just now";
  else if (diffMins < 60) relative = `${diffMins}m ago`;
  else if (diffHours < 24) relative = `${diffHours}h ago`;
  else if (diffDays < 7) relative = `${diffDays}d ago`;
  else relative = date.toLocaleDateString();

  const time = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const dateStr = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return { time, date: dateStr, relative };
}

export function ActivityTimeline({
  events,
  className,
  maxVisible = 20,
  showViewAll = true,
}: ActivityTimelineProps) {
  const displayEvents = events.slice(0, maxVisible);

  return (
    <div className={cn("bs-card bs-card-pad", className)}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl p-2.5 bg-bs-card-2 border border-bs-border-100">
            <Activity className="h-5 w-5 text-bs-green-soft" aria-hidden="true" />
          </div>
          <div>
            <h3
              className="font-display text-[22px] text-bs-fg"
              style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
            >
              Live activity stream
            </h3>
            <p className="text-xs text-bs-fg-muted">
              Real-time platform events and system alerts.
            </p>
          </div>
        </div>

        {showViewAll && (
          <Link
            href="/super-admin/audit-logs"
            className="bs-btn bs-btn-ghost bs-btn-sm"
            aria-label="View full audit log"
          >
            <span>VIEW ALL</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>

      <div className="space-y-2">
        {displayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-bs-border-100 bg-bs-card-2/50 py-12">
            <Activity className="mb-3 h-12 w-12 text-bs-fg-muted" aria-hidden="true" />
            <p className="text-sm font-semibold text-bs-fg-muted">
              No recent activity
            </p>
            <p className="text-xs text-bs-fg-muted/70">
              Events will appear here in real-time.
            </p>
          </div>
        ) : (
          displayEvents.map((event) => {
            const config = eventConfig[event.type];
            const Icon = config.icon;
            const timestamp = formatTimestamp(event.timestamp);

            return (
              <div
                key={event.id}
                className="relative rounded-xl border border-bs-border-100 bg-bs-card-2 p-4 transition-colors hover:border-bs-border"
              >
                <div className="flex items-start gap-4">
                  <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-bs-border-100 bg-bs-card">
                    <Icon className="h-5 w-5 text-bs-fg-muted" aria-hidden="true" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-bs-fg">
                          {event.description}
                        </p>
                        {event.actor && (
                          <p className="mt-0.5 text-xs text-bs-fg-muted">
                            by{" "}
                            <span className="font-medium text-bs-fg">
                              {event.actor}
                            </span>
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="font-mono tabular-nums text-xs text-bs-fg">
                          {timestamp.relative}
                        </div>
                        <div className="font-mono tabular-nums mt-0.5 text-[10px] text-bs-fg-muted">
                          {timestamp.time}
                        </div>
                      </div>
                    </div>

                    <span className={cn(config.chip, "mt-2")}>
                      {config.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {displayEvents.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-bs-border-100 bg-bs-card-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-bs-green-soft" aria-hidden="true" />
            <span className="text-xs text-bs-fg-muted">
              Monitoring{" "}
              <span className="font-mono tabular-nums font-semibold text-bs-fg">
                {events.length}
              </span>{" "}
              events
            </span>
          </div>
          <span className="font-mono tabular-nums text-xs text-bs-fg-muted">
            Last updated:{" "}
            {new Date().toLocaleTimeString("en-US", { hour12: false })}
          </span>
        </div>
      )}
    </div>
  );
}
