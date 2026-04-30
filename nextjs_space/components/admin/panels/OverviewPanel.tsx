"use client";

import {
  Building2,
  TrendingUp,
  UserPlus,
  Users,
  Activity,
  ArrowRight,
  LayoutDashboard,
  FileCheck,
} from "lucide-react";
import Link from "next/link";
import { StatCard } from "@/components/admin/shared";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

interface OverviewPanelProps {
  totalTenants: number;
  activeTenants: number;
  pendingOnboarding: number;
  totalUsers: number;
  pendingSubmissions?: number;
}

function ActivityItem({
  icon: Icon,
  title,
  subtitle,
  badge,
  badgeTone,
  time,
}: {
  icon: typeof Activity;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeTone?: "green" | "warn" | "info" | "muted";
  time: string;
}) {
  const chipClass =
    badgeTone === "warn"
      ? "bs-chip bs-chip-warn"
      : badgeTone === "info"
        ? "bs-chip bs-chip-info"
        : badgeTone === "muted"
          ? "bs-chip bs-chip-muted"
          : "bs-chip bs-chip-green";

  return (
    <div className="flex items-start gap-4 py-4 border-b border-bs-border-100 last:border-0">
      <div className="rounded-bs-md p-2.5 bg-bs-card-2 border border-bs-border-100 shrink-0">
        <Icon className="h-4 w-4 text-bs-fg-muted" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-bs-fg">{title}</p>
        {subtitle && (
          <p className="text-sm text-bs-fg-muted mt-0.5">{subtitle}</p>
        )}
        {badge && <span className={`${chipClass} mt-2`}>{badge}</span>}
      </div>
      <div className="text-right shrink-0">
        <p className="font-mono tabular-nums text-sm text-bs-fg-muted">
          {time}
        </p>
      </div>
    </div>
  );
}

export function OverviewPanel({
  totalTenants,
  activeTenants,
  pendingOnboarding,
  totalUsers,
  pendingSubmissions,
}: OverviewPanelProps) {
  const activePct =
    totalTenants > 0 ? Math.round((activeTenants / totalTenants) * 100) : 0;

  return (
    <div className="space-y-8">
      <div className="bs-page-header-centered">
        <div className="bs-eyebrow inline-flex items-center gap-1.5">
          <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
          Super Admin
        </div>
        <h1 className="bs-page-title">Platform Overview</h1>
        <p className="bs-page-subtitle">
          Monitor the platform heartbeat, franchise readiness, and tenant
          onboarding progress.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Tenants"
          value={totalTenants}
          icon={Building2}
          hint="NFT holders onboarded"
        />
        <StatCard
          label="Active Stores"
          value={activeTenants}
          icon={TrendingUp}
          hint={
            activeTenants > 0
              ? `${activePct}% live with Dr. Green`
              : "Stores live with Dr. Green"
          }
        />
        <StatCard
          label="Pending Approval"
          value={pendingOnboarding}
          icon={UserPlus}
          hint={
            pendingOnboarding > 0 ? "Review queue" : "Awaiting verification"
          }
        />
        <StatCard
          label="Total Users"
          value={totalUsers}
          icon={Users}
          hint="Platform-wide accounts"
        />
      </div>

      {pendingSubmissions !== undefined && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Template Submissions"
            value={pendingSubmissions}
            icon={FileCheck}
            hint={
              pendingSubmissions > 0
                ? "Awaiting marketplace review"
                : "Marketplace inbox clear"
            }
          />
        </div>
      )}

      <section className="bs-card bs-card-pad">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="rounded-bs-md p-2.5 bg-bs-card-2 border border-bs-border-100">
              <Activity
                className="h-5 w-5 text-bs-green"
                aria-hidden="true"
              />
            </div>
            <div>
              <h3
                className="text-[22px] leading-tight text-bs-fg"
                style={sectionTitleStyle}
              >
                Live Activity Stream
              </h3>
              <p className="text-sm text-bs-fg-muted">
                Real-time platform events and system alerts.
              </p>
            </div>
          </div>
          <Link
            href="/super-admin/audit-logs"
            className="bs-btn bs-btn-ghost bs-btn-sm"
          >
            <span>View All</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div>
          <ActivityItem
            icon={Building2}
            title="New order #1248 - 3 items, €85.00"
            badge="ORDER PLACED"
            badgeTone="green"
            time="58m ago"
          />
          <ActivityItem
            icon={TrendingUp}
            title="Payment settings configured"
            subtitle="by Emma Wilson"
            badge="SETTINGS UPDATED"
            badgeTone="muted"
            time="1h ago"
          />
          <ActivityItem
            icon={Building2}
            title="Mountain High Dispensary now active"
            subtitle="by Platform Bot"
            badge="TENANT ACTIVATED"
            badgeTone="green"
            time="1h ago"
          />
          <ActivityItem
            icon={Activity}
            title="High API usage from tenant #42"
            badge="ALERT"
            badgeTone="warn"
            time="2h ago"
          />
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/super-admin/onboarding" className="bs-btn bs-btn-green">
          Review Applications
        </Link>
        <Link href="/super-admin/tenants" className="bs-btn bs-btn-ghost">
          View All Tenants
        </Link>
        {pendingSubmissions !== undefined && pendingSubmissions > 0 && (
          <Link
            href="/super-admin/templates"
            className="bs-btn bs-btn-ghost"
          >
            <FileCheck className="h-4 w-4" aria-hidden="true" />
            <span>Review Submissions ({pendingSubmissions})</span>
          </Link>
        )}
      </div>
    </div>
  );
}
