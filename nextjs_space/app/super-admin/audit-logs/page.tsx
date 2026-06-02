import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Activity, Clock, ShieldCheck } from "lucide-react";
import {
  ActivityTimeline,
  type EventType,
  type TimelineEvent,
} from "@/components/admin/ActivityTimeline";
import { prisma } from "@/lib/db";
import type { audit_logs } from "@prisma/client";
import { StatCard } from "@/components/admin/shared";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

// Audit-log action strings (e.g. "tenant.created") map onto the timeline's
// constrained EventType union; anything unrecognised renders as SYSTEM_ALERT.
function mapActionToEventType(action: string): EventType {
  if (action.startsWith("tenant.created")) return "TENANT_CREATED";
  if (action.startsWith("tenant.activated")) return "TENANT_ACTIVATED";
  if (action.startsWith("user.")) return "USER_REGISTERED";
  if (action.startsWith("order.")) return "ORDER_PLACED";
  if (
    action.startsWith("tenant.") ||
    action.startsWith("settings.") ||
    action.startsWith("branding.")
  ) {
    return "TENANT_SETTINGS_UPDATED";
  }
  return "SYSTEM_ALERT";
}

export default async function AuditLogsPage() {
  const user = await currentUser();

  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  const logs: audit_logs[] = await prisma.audit_logs.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const allEvents: TimelineEvent[] = logs.map((log) => ({
    id: log.id,
    type: mapActionToEventType(log.action),
    description: log.entityType
      ? `${log.action} · ${log.entityType}`
      : log.action,
    timestamp: log.createdAt,
    actor: log.userEmail ?? undefined,
  }));

  const last24h = allEvents.filter((e) => {
    const hoursDiff =
      (Date.now() - e.timestamp.getTime()) / (1000 * 60 * 60);
    return hoursDiff < 24;
  }).length;

  return (
    <div className="space-y-8">
      <div className="bs-page-header-compact">
        <h1 className="bs-page-title" style={sectionTitleStyle}>
          Activity Overview
        </h1>
        <p className="bs-page-subtitle">
          Platform-wide event tracking and monitoring.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          label="Total Events"
          value={allEvents.length}
          icon={Activity}
          hint="All recorded events"
        />
        <StatCard
          label="Last 24 Hours"
          value={last24h}
          icon={Clock}
          hint="Recent activity"
        />
        <StatCard
          label="Monitoring"
          value="Enabled"
          icon={ShieldCheck}
          hint="Real-time tracking active"
        />
      </div>

      <ActivityTimeline
        events={allEvents}
        maxVisible={50}
        showViewAll={false}
      />
    </div>
  );
}
