'use client';

import * as React from 'react';
import { Bell, CheckCircle, AlertCircle, Package, Clock, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

/**
 * Notification types with associated metadata
 */
export type NotificationType = 'PENDING_APPROVAL' | 'FAILED_ORDER' | 'LOW_STOCK' | 'SYSTEM_ALERT' | 'USER_ACTION';

/**
 * Notification item structure
 */
export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  actionUrl?: string;
}

/**
 * Theme for notification center (matches admin panel themes)
 */
export type NotificationTheme = 'super-admin' | 'tenant-admin';

/**
 * Props for NotificationCenter component
 */
export interface NotificationCenterProps {
  /** Visual theme determining color scheme */
  theme: NotificationTheme;
  /** Array of notifications to display */
  notifications: Notification[];
  /** Callback when notification is marked as read */
  onMarkAsRead?: (notificationId: string) => void;
  /** Callback when all notifications are marked as read */
  onMarkAllAsRead?: () => void;
  /** Maximum number of notifications to show in dropdown (default: 5) */
  maxVisible?: number;
  /** URL for "View All" link (default: /notifications) */
  viewAllUrl?: string;
  /** Optional CSS class name */
  className?: string;
}

/**
 * Configuration for notification types with tactical styling
 */
const notificationConfig: Record<NotificationType, {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
}> = {
  PENDING_APPROVAL: {
    icon: Clock,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
    label: 'PENDING',
  },
  FAILED_ORDER: {
    icon: AlertCircle,
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-300',
    label: 'FAILED',
  },
  LOW_STOCK: {
    icon: Package,
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
    label: 'LOW STOCK',
  },
  SYSTEM_ALERT: {
    icon: AlertCircle,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-300',
    label: 'SYSTEM',
  },
  USER_ACTION: {
    icon: CheckCircle,
    color: 'text-cyan-700',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-300',
    label: 'ACTION',
  },
};

/**
 * Theme-specific styling for notification center
 */
const themeStyles = {
  'super-admin': {
    badgeBg: 'bg-red-600',
    badgeText: 'text-white',
    badgePulse: 'animate-pulse ring-4 ring-red-600/30',
    bellHover: 'hover:bg-slate-700/50 hover:text-slate-100',
    bellActive: 'bg-slate-700/50 text-slate-100',
    headerGradient: 'from-slate-800 to-slate-900',
    accentColor: 'text-slate-400',
    borderColor: 'border-slate-700/50',
    hoverBg: 'hover:bg-slate-50',
  },
  'tenant-admin': {
    badgeBg: 'bg-red-600',
    badgeText: 'text-white',
    badgePulse: 'animate-pulse ring-4 ring-red-600/30',
    bellHover: 'hover:bg-cyan-500/20 hover:text-white',
    bellActive: 'bg-cyan-500/30 text-white',
    headerGradient: 'from-cyan-600 to-blue-700',
    accentColor: 'text-cyan-400',
    borderColor: 'border-cyan-700/30',
    hoverBg: 'hover:bg-cyan-50',
  },
} as const;

/**
 * Format timestamp for notification display
 */
function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Mission Control Alert System - Notification Center Component
 *
 * A tactical notification dropdown with theme-specific styling for admin panels.
 * Features pulsing alert indicators, color-coded notification types, and satisfying interactions.
 *
 * @example
 * ```tsx
 * <NotificationCenter
 *   theme="super-admin"
 *   notifications={notifications}
 *   onMarkAsRead={handleMarkAsRead}
 *   onMarkAllAsRead={handleMarkAllAsRead}
 * />
 * ```
 */
export function NotificationCenter({
  theme,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  maxVisible = 5,
  viewAllUrl = '/notifications',
  className,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const styles = themeStyles[theme];

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const hasUnread = unreadCount > 0;

  // Get visible notifications (limit to maxVisible, prioritize unread)
  const visibleNotifications = React.useMemo(() => {
    const sorted = [...notifications].sort((a, b) => {
      // Unread first, then by timestamp
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
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'relative transition-all duration-200',
            styles.bellHover,
            isOpen && styles.bellActive,
            className
          )}
          aria-label={`Notifications${hasUnread ? ` (${unreadCount} unread)` : ''}`}
        >
          <Bell className={cn(
            'h-5 w-5 transition-transform duration-200',
            hasUnread && 'animate-[wiggle_0.5s_ease-in-out_3]',
          )} />

          {/* Unread badge with radar ping effect */}
          {hasUnread && (
            <>
              <Badge
                className={cn(
                  'absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0',
                  'text-[10px] font-bold',
                  styles.badgeBg,
                  styles.badgeText,
                  'shadow-lg',
                )}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>

              {/* Radar ping animation */}
              <span
                className={cn(
                  'absolute -top-1 -right-1 h-5 w-5 rounded-full',
                  styles.badgePulse,
                  'pointer-events-none',
                )}
                aria-hidden="true"
              />
            </>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        className={cn(
          'w-[420px] p-0 shadow-2xl',
          'border-2',
          styles.borderColor,
          'bg-white',
        )}
        sideOffset={8}
      >
        {/* Header with gradient */}
        <div
          className={cn(
            'px-4 py-3 border-b-2',
            styles.borderColor,
            'bg-gradient-to-r',
            styles.headerGradient,
            'text-white',
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" aria-hidden="true" />
              <h3 className="font-bold text-sm tracking-wide uppercase">
                Alert Center
              </h3>
              {hasUnread && (
                <Badge
                  className={cn(
                    'h-5 px-2 text-[10px] font-mono font-bold',
                    styles.badgeBg,
                    styles.badgeText,
                  )}
                >
                  {unreadCount} NEW
                </Badge>
              )}
            </div>

            {hasUnread && onMarkAllAsRead && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMarkAllAsRead()}
                className="h-7 text-xs text-white hover:bg-white/20 font-medium"
              >
                Clear All
              </Button>
            )}
          </div>
        </div>

        {/* Notifications list */}
        <div className="max-h-[400px] overflow-y-auto">
          {visibleNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center mb-3',
                'bg-slate-100 border-2 border-slate-200',
              )}>
                <Bell className="h-8 w-8 text-slate-400" aria-hidden="true" />
              </div>
              <p className="text-sm font-medium text-slate-900">All Clear</p>
              <p className="text-xs text-slate-500 mt-1">No active notifications</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {visibleNotifications.map((notification, index) => {
                const config = notificationConfig[notification.type];
                const Icon = config.icon;

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      'p-4 transition-all duration-200 relative group',
                      !notification.isRead && 'bg-slate-50/50',
                      styles.hoverBg,
                      'cursor-pointer',
                    )}
                    style={{
                      animationDelay: `${index * 50}ms`,
                      animationFillMode: 'backwards',
                    }}
                  >
                    {notification.actionUrl ? (
                      <Link href={notification.actionUrl} className="block">
                        <NotificationItem
                          notification={notification}
                          config={config}
                          Icon={Icon}
                          onMarkAsRead={handleMarkAsRead}
                          styles={styles}
                        />
                      </Link>
                    ) : (
                      <NotificationItem
                        notification={notification}
                        config={config}
                        Icon={Icon}
                        onMarkAsRead={handleMarkAsRead}
                        styles={styles}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {visibleNotifications.length > 0 && (
          <div
            className={cn(
              'px-4 py-3 border-t-2',
              styles.borderColor,
              'bg-slate-50',
            )}
          >
            <Link
              href={viewAllUrl}
              className={cn(
                'flex items-center justify-center gap-2',
                'text-sm font-semibold',
                styles.accentColor,
                'hover:underline',
                'transition-all duration-200',
                'group',
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

/**
 * Individual notification item component
 */
function NotificationItem({
  notification,
  config,
  Icon,
  onMarkAsRead,
  styles,
}: {
  notification: Notification;
  config: typeof notificationConfig[NotificationType];
  Icon: React.ElementType;
  onMarkAsRead: (id: string, e: React.MouseEvent) => void;
  styles: typeof themeStyles['super-admin'] | typeof themeStyles['tenant-admin'];
}) {
  return (
    <div className="flex gap-3">
      {/* Icon badge */}
      <div
        className={cn(
          'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
          'border-2 shadow-sm',
          config.bgColor,
          config.borderColor,
          'transition-transform duration-200 group-hover:scale-110',
        )}
      >
        <Icon className={cn('h-5 w-5', config.color)} aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] font-bold tracking-wider px-1.5 py-0',
                config.color,
                config.borderColor,
                'bg-white',
              )}
            >
              {config.label}
            </Badge>
            {!notification.isRead && (
              <span
                className="w-2 h-2 rounded-full bg-red-600 animate-pulse"
                aria-label="Unread"
              />
            )}
          </div>

          {/* Mark as read button */}
          {!notification.isRead && onMarkAsRead && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => onMarkAsRead(notification.id, e)}
              className={cn(
                'h-6 w-6 p-0 opacity-0 group-hover:opacity-100',
                'transition-opacity duration-200',
                'hover:bg-slate-200',
              )}
              aria-label="Mark as read"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </Button>
          )}
        </div>

        <h4 className="text-sm font-semibold text-slate-900 mb-1 line-clamp-1">
          {notification.title}
        </h4>

        <p className="text-xs text-slate-600 mb-2 line-clamp-2">
          {notification.message}
        </p>

        <div className="flex items-center gap-2">
          <time
            dateTime={notification.timestamp.toISOString()}
            className="text-[10px] font-mono font-medium text-slate-500 uppercase tracking-wide"
          >
            {formatTimestamp(notification.timestamp)}
          </time>
        </div>
      </div>
    </div>
  );
}

/**
 * Generate mock notifications for testing/demo
 */
export function generateMockNotifications(count: number = 10): Notification[] {
  const types: NotificationType[] = ['PENDING_APPROVAL', 'FAILED_ORDER', 'LOW_STOCK', 'SYSTEM_ALERT', 'USER_ACTION'];
  const titles: Record<NotificationType, string[]> = {
    PENDING_APPROVAL: ['New tenant application', 'Consultation request pending', 'Approval required'],
    FAILED_ORDER: ['Payment processing failed', 'Order fulfillment error', 'Delivery failed'],
    LOW_STOCK: ['Product stock critical', 'Inventory alert', 'Restock needed'],
    SYSTEM_ALERT: ['System maintenance scheduled', 'Security update available', 'Performance alert'],
    USER_ACTION: ['Profile updated successfully', 'Settings saved', 'Export completed'],
  };

  return Array.from({ length: count }, (_, i) => {
    const type = types[Math.floor(Math.random() * types.length)];
    const titleOptions = titles[type];
    const title = titleOptions[Math.floor(Math.random() * titleOptions.length)];

    return {
      id: `notif-${i}`,
      type,
      title,
      message: `This is a notification message for ${title.toLowerCase()}. It provides additional context about what happened.`,
      timestamp: new Date(Date.now() - Math.random() * 86400000 * 3), // Random time within last 3 days
      isRead: Math.random() > 0.6, // 40% unread
      actionUrl: Math.random() > 0.5 ? `/admin/notification/${i}` : undefined,
    };
  });
}

// Add wiggle animation to tailwind config if not already present
// @keyframes wiggle {
//   0%, 100% { transform: rotate(0deg); }
//   25% { transform: rotate(-10deg); }
//   75% { transform: rotate(10deg); }
// }
