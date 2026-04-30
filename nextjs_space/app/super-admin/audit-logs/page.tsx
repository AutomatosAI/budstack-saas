import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Activity, Clock, ShieldCheck } from "lucide-react";
import { ActivityTimeline } from "@/components/admin/ActivityTimeline";
import { generateMockEvents } from "@/lib/mock-data";
import { StatCard } from "@/components/admin/shared";

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

export default async function AuditLogsPage() {
  const user = await currentUser();

  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  const allEvents = generateMockEvents(50);

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
