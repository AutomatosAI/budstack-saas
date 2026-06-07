import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Activity, Clock, ShieldCheck } from "lucide-react";
import { ActivityTimeline } from "@/components/admin/ActivityTimeline";
import { getAuditActivityOverview } from "@/lib/audit-log";
import { StatCard } from "@/components/admin/shared";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

export default async function AuditLogsPage() {
  const user = await currentUser();

  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  const { events, totalEvents, last24hCount } = await getAuditActivityOverview(50);

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
          value={totalEvents}
          icon={Activity}
          hint="All recorded events"
        />
        <StatCard
          label="Last 24 Hours"
          value={last24hCount}
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
        events={events}
        maxVisible={50}
        showViewAll={false}
      />
    </div>
  );
}
