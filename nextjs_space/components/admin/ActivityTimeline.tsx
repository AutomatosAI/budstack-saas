'use client'

import React from 'react'
import Link from 'next/link'
import {
  Building2,
  CheckCircle2,
  UserPlus,
  ShoppingBag,
  Settings,
  AlertTriangle,
  ArrowRight,
  Activity
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Event type definitions
export type EventType =
  | 'TENANT_CREATED'
  | 'TENANT_ACTIVATED'
  | 'USER_REGISTERED'
  | 'ORDER_PLACED'
  | 'TENANT_SETTINGS_UPDATED'
  | 'SYSTEM_ALERT'

export interface TimelineEvent {
  id: string
  type: EventType
  description: string
  timestamp: Date
  actor?: string // Name of the user who performed the action
  metadata?: Record<string, any> // Additional context
}

export interface ActivityTimelineProps {
  events: TimelineEvent[]
  className?: string
  maxVisible?: number
  showViewAll?: boolean
}

// Event type configuration with icons and colors
const eventConfig: Record<EventType, {
  icon: React.ComponentType<{ className?: string }>,
  color: string,
  bgGlow: string,
  label: string
}> = {
  TENANT_CREATED: {
    icon: Building2,
    color: 'text-cyan-400',
    bgGlow: 'bg-cyan-500/10',
    label: 'Tenant Created'
  },
  TENANT_ACTIVATED: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bgGlow: 'bg-emerald-500/10',
    label: 'Tenant Activated'
  },
  USER_REGISTERED: {
    icon: UserPlus,
    color: 'text-blue-400',
    bgGlow: 'bg-blue-500/10',
    label: 'User Registered'
  },
  ORDER_PLACED: {
    icon: ShoppingBag,
    color: 'text-purple-400',
    bgGlow: 'bg-purple-500/10',
    label: 'Order Placed'
  },
  TENANT_SETTINGS_UPDATED: {
    icon: Settings,
    color: 'text-slate-400',
    bgGlow: 'bg-slate-500/10',
    label: 'Settings Updated'
  },
  SYSTEM_ALERT: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bgGlow: 'bg-amber-500/10',
    label: 'System Alert'
  }
}

// Format timestamp with tactical precision
function formatTimestamp(date: Date): { time: string; date: string; relative: string } {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  let relative = ''
  if (diffMins < 1) relative = 'Just now'
  else if (diffMins < 60) relative = `${diffMins}m ago`
  else if (diffHours < 24) relative = `${diffHours}h ago`
  else if (diffDays < 7) relative = `${diffDays}d ago`
  else relative = date.toLocaleDateString()

  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })

  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })

  return { time, date: dateStr, relative }
}

export function ActivityTimeline({
  events,
  className,
  maxVisible = 20,
  showViewAll = true
}: ActivityTimelineProps) {
  const displayEvents = events.slice(0, maxVisible)

  return (
    <div className={cn('relative', className)}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 animate-pulse rounded-lg bg-cyan-500/20 blur-md" />
            <div className="relative rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 p-2.5 ring-1 ring-cyan-500/30">
              <Activity className="h-5 w-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <h3 className="font-mono text-lg font-bold uppercase tracking-wider text-slate-100">
              Live Activity Stream
            </h3>
            <p className="font-mono text-xs text-slate-500">
              REAL-TIME PLATFORM EVENTS
            </p>
          </div>
        </div>

        {showViewAll && (
          <Link
            href="/super-admin/audit-logs"
            className="group flex items-center gap-2 rounded-md bg-slate-800/50 px-4 py-2 font-mono text-sm font-medium text-cyan-400 ring-1 ring-slate-700 transition-all hover:bg-slate-800 hover:ring-cyan-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            aria-label="View full audit log"
          >
            <span>VIEW ALL</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        )}
      </div>

      {/* Scanning line effect */}
      <div className="pointer-events-none absolute left-0 right-0 top-24 h-px bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50">
        <div className="h-full w-full animate-scan-line" />
      </div>

      {/* Timeline container */}
      <div className="space-y-3">
        {displayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/30 py-12">
            <Activity className="mb-3 h-12 w-12 text-slate-600" />
            <p className="font-mono text-sm text-slate-500">No recent activity</p>
            <p className="font-mono text-xs text-slate-600">
              Events will appear here in real-time
            </p>
          </div>
        ) : (
          displayEvents.map((event, index) => {
            const config = eventConfig[event.type]
            const Icon = config.icon
            const timestamp = formatTimestamp(event.timestamp)

            return (
              <div
                key={event.id}
                className="group animate-fade-in-up"
                style={{
                  animationDelay: `${index * 50}ms`,
                  animationFillMode: 'backwards'
                }}
              >
                <div className="relative overflow-hidden rounded-lg border border-slate-700/50 bg-gradient-to-br from-slate-900 to-slate-950 p-4 transition-all hover:border-slate-600 hover:shadow-lg hover:shadow-slate-900/50">
                  {/* Background glow effect */}
                  <div
                    className={cn(
                      'absolute right-0 top-0 h-full w-32 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100',
                      config.bgGlow
                    )}
                  />

                  {/* Content */}
                  <div className="relative flex items-start gap-4">
                    {/* Icon with hexagonal background */}
                    <div className="relative shrink-0">
                      {/* Hex border effect */}
                      <div className="absolute inset-0 rotate-90">
                        <div className={cn(
                          'h-full w-full opacity-20 transition-opacity group-hover:opacity-40',
                          'border-2 border-l-0 border-r-0',
                          config.color.replace('text-', 'border-')
                        )} />
                      </div>

                      {/* Icon container */}
                      <div className={cn(
                        'relative flex h-10 w-10 items-center justify-center rounded-lg ring-1 transition-all',
                        config.bgGlow,
                        config.color.replace('text-', 'ring-'),
                        'group-hover:scale-110'
                      )}>
                        <Icon className={cn('h-5 w-5', config.color)} />

                        {/* Pulse effect for recent events */}
                        {index < 3 && (
                          <div className={cn(
                            'absolute inset-0 animate-ping rounded-lg opacity-20',
                            config.bgGlow
                          )} />
                        )}
                      </div>
                    </div>

                    {/* Event details */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-200 transition-colors group-hover:text-white">
                            {event.description}
                          </p>
                          {event.actor && (
                            <p className="mt-0.5 font-mono text-xs text-slate-500">
                              by <span className="text-slate-400">{event.actor}</span>
                            </p>
                          )}
                        </div>

                        {/* Timestamp badge */}
                        <div className="shrink-0 text-right">
                          <div className="font-mono text-xs font-medium text-cyan-400">
                            {timestamp.relative}
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-slate-600">
                            {timestamp.time}
                          </div>
                        </div>
                      </div>

                      {/* Event type badge */}
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-slate-800/50 px-2 py-0.5 ring-1 ring-slate-700/50">
                        <div className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          config.color.replace('text-', 'bg-')
                        )} />
                        <span className="font-mono text-[10px] font-medium uppercase tracking-wider text-slate-400">
                          {config.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Decorative corner accent */}
                  <div className="absolute bottom-0 right-0 h-8 w-8 opacity-10">
                    <div className={cn(
                      'h-full w-full border-b-2 border-r-2',
                      config.color.replace('text-', 'border-')
                    )} />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer stats */}
      {displayEvents.length > 0 && (
        <div className="mt-6 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span className="font-mono text-xs text-slate-500">
              Monitoring <span className="font-bold text-slate-400">{events.length}</span> events
            </span>
          </div>
          <span className="font-mono text-xs text-slate-600">
            Last updated: {new Date().toLocaleTimeString('en-US', { hour12: false })}
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
  )
}

// Export event generator for testing/demo purposes
export function generateMockEvents(count: number = 20): TimelineEvent[] {
  const eventTypes: EventType[] = [
    'TENANT_CREATED',
    'TENANT_ACTIVATED',
    'USER_REGISTERED',
    'ORDER_PLACED',
    'TENANT_SETTINGS_UPDATED',
    'SYSTEM_ALERT'
  ]

  const descriptions: Record<EventType, string[]> = {
    TENANT_CREATED: [
      'New tenant "Green Leaf Dispensary" created',
      'Cannabis Co. signed up for platform',
      'Healing Herbs Store registered'
    ],
    TENANT_ACTIVATED: [
      'Happy Buds activated and went live',
      'Ocean View Cannabis approved and activated',
      'Mountain High Dispensary now active'
    ],
    USER_REGISTERED: [
      'New admin user Sarah J. registered',
      'Staff member Mike T. joined the platform',
      'Customer Emma W. created account'
    ],
    ORDER_PLACED: [
      'Order #1247 placed for $127.50',
      'New order #1248 - 3 items, $85.00',
      'Order #1249 submitted - $210.00'
    ],
    TENANT_SETTINGS_UPDATED: [
      'Branding updated for Coastal Cannabis',
      'Payment settings configured',
      'Store hours modified'
    ],
    SYSTEM_ALERT: [
      'Payment processing delay detected',
      'High API usage from tenant #42',
      'Scheduled maintenance in 2 hours'
    ]
  }

  const actors = [
    'System',
    'Sarah Johnson',
    'Mike Thompson',
    'Admin',
    'Emma Wilson',
    'Platform Bot',
    'John Doe'
  ]

  const events: TimelineEvent[] = []

  for (let i = 0; i < count; i++) {
    const type = eventTypes[Math.floor(Math.random() * eventTypes.length)]
    const descArray = descriptions[type]
    const description = descArray[Math.floor(Math.random() * descArray.length)]

    // Generate realistic timestamps (recent events)
    const minutesAgo = Math.floor(Math.random() * 240) // Up to 4 hours ago
    const timestamp = new Date(Date.now() - minutesAgo * 60000)

    events.push({
      id: `event-${i}-${Date.now()}`,
      type,
      description,
      timestamp,
      actor: Math.random() > 0.3 ? actors[Math.floor(Math.random() * actors.length)] : undefined
    })
  }

  // Sort by timestamp descending (most recent first)
  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
}
