"use client";

import * as React from "react";
import {
  Bell,
  CheckCircle,
  AlertCircle,
  Package,
  Clock,
  ChevronRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export type NotificationType =
  | "PENDING_APPROVAL"
  | "FAILED_ORDER"
  | "LOW_STOCK"
  | "SYSTEM_ALERT"
  | "USER_ACTION";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  actionUrl?: string;
}

export type NotificationTheme = "super-admin" | "tenant-admin";

export interface NotificationCenterProps {
  theme: NotificationTheme;
  notifications: Notification[];
  onMarkAsRead?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
  maxVisible?: number;
  viewAllUrl?: string;
  className?: string;
}

type NotificationConfig = {
  icon: React.ElementType;
  chip: string;
  label: string;
};

const notificationConfig: Record<NotificationType, NotificationConfig> = {
  PENDING_APPROVAL: { icon: Clock, chip: "bs-chip bs-chip-warn", label: "PENDING" },
  FAILED_ORDER: { icon: AlertCircle, chip: "bs-chip bs-chip-danger", label: "FAILED" },
  LOW_STOCK: { icon: Package, chip: "bs-chip bs-chip-gold", label: "LOW STOCK" },
  SYSTEM_ALERT: { icon: AlertCircle, chip: "bs-chip bs-chip-info", label: "SYSTEM" },
  USER_ACTION: { icon: CheckCircle, chip: "bs-chip bs-chip-green", label: "ACTION" },
};

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NotificationCenter({
  theme,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  maxVisible = 5,
  viewAllUrl = "/notifications",
  className,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const focusRing = theme === "super-admin" ? "focus-super-admin" : "focus-tenant-admin";

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const hasUnread = unreadCount > 0;

  const visibleNotifications = React.useMemo(() => {
    const sorted = [...notifications].sort((a, b) => {
      if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
    return sorted.slice(0, maxVisible);
  }, [notifications, maxVisible]);

  const handleMarkAsRead = (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onMarkAsRead?.(notificationId);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "relative inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors",
            "bg-bs-card border border-bs-border text-bs-fg-body hover:text-bs-fg hover:border-bs-fg-muted",
            isOpen && "bg-bs-hover text-bs-fg border-bs-fg-muted",
            focusRing,
            className,
          )}
          aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              hasUnread && "animate-[wiggle_0.5s_ease-in-out_3]",
            )}
          />

          {hasUnread && (
            <>
              <span
                className={cn(
                  "absolute -top-1 -right-1 h-5 min-w-5 px-1 inline-flex items-center justify-center",
                  "rounded-bs-pill font-mono text-mono-chip uppercase",
                  "bg-bs-danger text-bs-bg border border-bs-danger",
                )}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
              <span
                className="absolute -top-1 -right-1 h-5 w-5 rounded-bs-pill animate-pulse ring-4 ring-bs-danger/30 pointer-events-none"
                aria-hidden="true"
              />
            </>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className="w-[420px] p-0 bg-bs-card border-bs-border text-bs-fg-body shadow-bs-card-hover"
        sideOffset={8}
      >
        <div className="px-4 py-3 border-b border-bs-border-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-bs-fg-muted" aria-hidden="true" />
              <h3 className="font-mono text-mono-eyebrow uppercase text-bs-gold">
                Alert Center
              </h3>
              {hasUnread && (
                <span className="bs-chip bs-chip-danger">{unreadCount} NEW</span>
              )}
            </div>

            {hasUnread && onMarkAllAsRead && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMarkAllAsRead()}
                className="h-7 text-xs text-bs-fg-body hover:text-bs-fg hover:bg-bs-hover font-medium"
              >
                Clear All
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-[400px] overflow-y-auto">
          {visibleNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3 bg-bs-input border border-bs-border">
                <Bell className="h-8 w-8 text-bs-fg-muted" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-bs-fg">All Clear</p>
              <p className="text-xs text-bs-fg-muted mt-1">
                No active notifications
              </p>
            </div>
          ) : (
            <div className="divide-y divide-bs-border-100">
              {visibleNotifications.map((notification, index) => {
                const config = notificationConfig[notification.type];
                const Icon = config.icon;

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-4 transition-colors duration-200 relative group cursor-pointer",
                      !notification.isRead && "bg-bs-green/[0.025]",
                      "hover:bg-bs-hover",
                    )}
                    style={{
                      animationDelay: `${index * 50}ms`,
                      animationFillMode: "backwards",
                    }}
                  >
                    {notification.actionUrl ? (
                      <Link href={notification.actionUrl} className="block">
                        <NotificationItem
                          notification={notification}
                          config={config}
                          Icon={Icon}
                          onMarkAsRead={handleMarkAsRead}
                        />
                      </Link>
                    ) : (
                      <NotificationItem
                        notification={notification}
                        config={config}
                        Icon={Icon}
                        onMarkAsRead={handleMarkAsRead}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {visibleNotifications.length > 0 && (
          <div className="px-4 py-3 border-t border-bs-border-100 bg-white/[0.015]">
            <Link
              href={viewAllUrl}
              className={cn(
                "flex items-center justify-center gap-2 text-sm font-medium",
                "text-bs-fg-body hover:text-bs-fg transition-colors group",
              )}
              onClick={() => setIsOpen(false)}
            >
              <span>View All Notifications</span>
              <ChevronRight
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </Link>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function NotificationItem({
  notification,
  config,
  Icon,
  onMarkAsRead,
}: {
  notification: Notification;
  config: NotificationConfig;
  Icon: React.ElementType;
  onMarkAsRead: (id: string, e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex-shrink-0 w-10 h-10 rounded-bs-md flex items-center justify-center bg-bs-input border border-bs-border-100 transition-transform duration-200 group-hover:scale-105">
        <Icon className="h-5 w-5 text-bs-fg-body" aria-hidden="true" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <span className={config.chip}>{config.label}</span>
            {!notification.isRead && (
              <span
                className="w-2 h-2 rounded-bs-pill bg-bs-danger animate-pulse"
                aria-label="Unread"
              />
            )}
          </div>

          {!notification.isRead && onMarkAsRead && (
            <button
              type="button"
              onClick={(e) => onMarkAsRead(notification.id, e)}
              className="h-6 w-6 inline-flex items-center justify-center rounded-bs-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-bs-fg-muted hover:text-bs-fg hover:bg-bs-step-200"
              aria-label="Mark as read"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>

        <h4 className="text-sm font-medium text-bs-fg mb-1 line-clamp-1">
          {notification.title}
        </h4>

        <p className="text-xs text-bs-fg-body mb-2 line-clamp-2">
          {notification.message}
        </p>

        <time
          dateTime={notification.timestamp.toISOString()}
          className="font-mono text-mono-chip text-bs-fg-muted uppercase"
        >
          {formatTimestamp(notification.timestamp)}
        </time>
      </div>
    </div>
  );
}
