"use client";

import { Building2, TrendingUp, UserPlus, Users, Activity, ArrowRight, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface OverviewPanelProps {
  totalTenants: number;
  activeTenants: number;
  pendingOnboarding: number;
  totalUsers: number;
}

/**
 * Flowa Pro stat card with icon badge
 */
function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconBg,
  accentValue,
  accentColor = "text-accent",
}: {
  title: string;
  value: number | string;
  description: string;
  icon: typeof Building2;
  iconBg: string;
  accentValue?: string;
  accentColor?: string;
}) {
  return (
    <div className="card-floating p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="font-display text-3xl font-bold tracking-tight text-foreground">
              {value}
            </p>
            {accentValue && (
              <span className={`text-sm font-semibold ${accentColor}`}>
                {accentValue}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <div className={`rounded-2xl p-3 ${iconBg}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
      </div>
    </div>
  );
}

/**
 * Activity timeline item - Flowa Pro style
 */
function ActivityItem({
  icon: Icon,
  iconBg,
  title,
  subtitle,
  badge,
  badgeColor,
  time,
}: {
  icon: typeof Activity;
  iconBg: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  time: string;
}) {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-slate-100 last:border-0">
      <div className={`rounded-xl p-2.5 ${iconBg}`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground">{title}</p>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        )}
        {badge && (
          <span
            className={`inline-flex items-center gap-1.5 mt-2 text-xs font-semibold ${badgeColor || "text-emerald-600"}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${badgeColor?.includes("orange")
                  ? "bg-orange-500"
                  : badgeColor?.includes("emerald") || badgeColor?.includes("green")
                    ? "bg-emerald-500"
                    : "bg-primary"
                }`}
            />
            {badge}
          </span>
        )}
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-muted-foreground">{time}</p>
      </div>
    </div>
  );
}

export function OverviewPanel({
  totalTenants,
  activeTenants,
  pendingOnboarding,
  totalUsers,
}: OverviewPanelProps) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="section-badge mb-4 inline-flex">
          <LayoutDashboard className="h-4 w-4" />
          Super Admin
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Platform Overview
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Monitor the platform heartbeat, franchise readiness, and tenant onboarding progress.
        </p>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Tenants"
          value={totalTenants}
          description="NFT holders onboarded"
          icon={Building2}
          iconBg="bg-primary"
        />
        <StatCard
          title="Active Stores"
          value={activeTenants}
          description="Stores live with Dr. Green"
          icon={TrendingUp}
          iconBg="bg-emerald-500"
          accentValue={
            activeTenants > 0
              ? `${Math.round((activeTenants / totalTenants) * 100)}%`
              : undefined
          }
          accentColor="text-emerald-500"
        />
        <StatCard
          title="Pending Approval"
          value={pendingOnboarding}
          description="Awaiting verification"
          icon={UserPlus}
          iconBg="bg-accent"
          accentValue={pendingOnboarding > 0 ? "Review" : undefined}
          accentColor="text-accent"
        />
        <StatCard
          title="Total Users"
          value={totalUsers}
          description="Platform-wide accounts"
          icon={Users}
          iconBg="bg-purple-600"
        />
      </div>

      {/* Activity Stream Card */}
      <div className="card-floating p-8">
        {/* Card Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="icon-badge">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">
                Live Activity Stream
              </h3>
              <p className="text-sm text-muted-foreground">
                Real-time platform events and system alerts.
              </p>
            </div>
          </div>
          <Link href="/super-admin/audit-logs">
            <Button variant="ghost" className="text-accent hover:text-accent/80 font-medium">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        {/* Activity Items */}
        <div>
          <ActivityItem
            icon={Building2}
            iconBg="bg-primary"
            title="New order #1248 - 3 items, €85.00"
            badge="ORDER PLACED"
            badgeColor="text-emerald-600"
            time="58m ago"
          />
          <ActivityItem
            icon={TrendingUp}
            iconBg="bg-slate-500"
            title="Payment settings configured"
            subtitle="by Emma Wilson"
            badge="SETTINGS UPDATED"
            badgeColor="text-slate-500"
            time="1h ago"
          />
          <ActivityItem
            icon={Building2}
            iconBg="bg-emerald-500"
            title="Mountain High Dispensary now active"
            subtitle="by Platform Bot"
            badge="TENANT ACTIVATED"
            badgeColor="text-emerald-600"
            time="1h ago"
          />
          <ActivityItem
            icon={Activity}
            iconBg="bg-accent"
            title="High API usage from tenant #42"
            badge="ALERT"
            badgeColor="text-orange-500"
            time="2h ago"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-4">
        <Link href="/super-admin/onboarding">
          <Button variant="hero" size="lg" className="rounded-xl">
            Review Applications
          </Button>
        </Link>
        <Link href="/super-admin/tenants">
          <Button variant="outline" size="lg" className="rounded-xl">
            View All Tenants
          </Button>
        </Link>
      </div>
    </div>
  );
}
