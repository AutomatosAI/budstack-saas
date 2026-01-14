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
import { generateMockEvents } from "@/lib/mock-data";

// Event type definitions
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
  actor?: string; // Name of the user who performed the action
  metadata?: Record<string, any>; // Additional context
}

export interface ActivityTimelineProps {
  events: TimelineEvent[];
  className?: string;
  maxVisible?: number;
  showViewAll?: boolean;
}

// Event type configuration with icons and colors
const eventConfig: Record<
  EventType,
  {
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgGlow: string;
    label: string;
  }
> = {
  TENANT_CREATED: {
    icon: Building2,
    color: "text-cyan-600",
    bgGlow: "bg-cyan-500/10",
    label: "Tenant Created",
  },
  TENANT_ACTIVATED: {
    icon: CheckCircle2,
    color: "text-emerald-600",
    bgGlow: "bg-emerald-500/10",
    label: "Tenant Activated",
  },
  USER_REGISTERED: {
    icon: UserPlus,
    color: "text-blue-600",
    bgGlow: "bg-blue-500/10",
    label: "User Registered",
  },
  ORDER_PLACED: {
    icon: ShoppingBag,
    color: "text-purple-600",
    bgGlow: "bg-purple-500/10",
    label: "Order Placed",
  },
  TENANT_SETTINGS_UPDATED: {
    icon: Settings,
    color: "text-slate-600",
    bgGlow: "bg-slate-500/10",
    label: "Settings Updated",
  },
  SYSTEM_ALERT: {
    icon: AlertTriangle,
    color: "text-amber-600",
    bgGlow: "bg-amber-500/10",
    label: "System Alert",
  },
};

// Format timestamp with tactical precision
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
    <div className={cn("relative overflow-hidden", className)}>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-cyan-400/20 blur-md" />
            <div className="relative rounded-xl bg-white p-2.5 ring-1 ring-slate-200 shadow-sm">
              <Activity className="h-5 w-5 text-cyan-600" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Live activity stream
            </h3>
            <p className="text-xs text-slate-500">
              Real-time platform events and system alerts.
            </p>
          </div>
        </div>

        {showViewAll && (
          <Link
            href="/super-admin/audit-logs"
            className="group flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition-all hover:text-slate-900 hover:ring-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            aria-label="View full audit log"
          >
            <span>VIEW ALL</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        )}
      </div>

      {/* Subtle divider */}
      <div className="pointer-events-none absolute left-0 right-0 top-24 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      {/* Timeline container */}
      <div className="space-y-3">
        {displayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 py-12">
            <Activity className="mb-3 h-12 w-12 text-slate-300" />
            <p className="text-sm font-semibold text-slate-500">
              No recent activity
            </p>
            <p className="text-xs text-slate-400">
              Events will appear here in real-time.
            </p>
          </div>
        ) : (
          displayEvents.map((event, index) => {
            const config = eventConfig[event.type];
            const Icon = config.icon;
            const timestamp = formatTimestamp(event.timestamp);

            return (
              <div
                key={event.id}
                className="group animate-fade-in-up"
                style={{
                  animationDelay: `${index * 50}ms`,
                  animationFillMode: "backwards",
                }}
              >
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-4 transition-all hover:border-slate-300 hover:shadow-lg hover:shadow-slate-200/70">
                  {/* Background glow effect */}
                  <div
                    className={cn(
                      "absolute right-0 top-0 h-full w-32 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100",
                      config.bgGlow,
                    )}
                  />

                  {/* Content */}
                  <div className="relative flex items-start gap-4">
                    {/* Icon with hexagonal background */}
                    <div className="relative shrink-0">
                      {/* Hex border effect */}
                      <div className="absolute inset-0 rotate-90">
                        <div
                          className={cn(
                            "h-full w-full opacity-20 transition-opacity group-hover:opacity-40",
                            "border-2 border-l-0 border-r-0",
                            config.color.replace("text-", "border-"),
                          )}
                        />
                      </div>

                      {/* Icon container */}
                      <div
                        className={cn(
                          "relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm transition-transform",
                          config.bgGlow,
                          "group-hover:scale-105",
                        )}
                      >
                        <Icon className={cn("h-5 w-5", config.color)} />

                        {index < 3 && (
                          <div
                            className={cn(
                              "absolute inset-0 animate-ping rounded-xl opacity-20",
                              config.bgGlow,
                            )}
                          />
                        )}
                      </div>
                    </div>

                    {/* Event details */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 transition-colors group-hover:text-slate-900">
                            {event.description}
                          </p>
                          {event.actor && (
                            <p className="mt-0.5 text-xs text-slate-500">
                              by{" "}
                              <span className="font-medium text-slate-600">
                                {event.actor}
                              </span>
                            </p>
                          )}
                        </div>

                        {/* Timestamp badge */}
                        <div className="shrink-0 text-right">
                          <div className="text-xs font-semibold text-cyan-600">
                            {timestamp.relative}
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-400">
                            {timestamp.time}
                          </div>
                        </div>
                      </div>

                      {/* Event type badge */}
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 ring-1 ring-slate-200">
                        <div
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            config.color.replace("text-", "bg-"),
                          )}
                        />
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          {config.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Decorative corner accent */}
                  <div className="absolute bottom-0 right-0 h-8 w-8 opacity-10">
                    <div
                      className={cn(
                        "h-full w-full border-b-2 border-r-2",
                        config.color.replace("text-", "border-"),
                      )}
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer stats */}
      {displayEvents.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/70 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="text-xs text-slate-500">
              Monitoring{" "}
              <span className="font-semibold text-slate-600">
                {events.length}
              </span>{" "}
              events
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Last updated:{" "}
            {new Date().toLocaleTimeString("en-US", { hour12: false })}
          </span>
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes scan-line {
          0% {
            transform: translateY(-100%);
          }
          100% {
            transform: translateY(2000%);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.5s ease-out;
        }

        .animate-scan-line {
          animation: scan-line 8s linear infinite;
        }
      `}</style>
    </div>
  );
}

export { generateMockEvents }
