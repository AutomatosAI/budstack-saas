import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Activity, Clock, ShieldCheck } from "lucide-react";
import { ActivityTimeline } from "@/components/admin/ActivityTimeline";
import { generateMockEvents } from "@/lib/mock-data";
import { StatCard, AdminPageHeader, AdminStatGrid } from "@/components/admin/shared";

export default async function AuditLogsPage() {
  const user = await currentUser();

  if (!user || user.publicMetadata.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  // Generate mock events for demo (replace with real data in production)
  const allEvents = generateMockEvents(50);

  const last24h = allEvents.filter((e) => {
    const hoursDiff =
      (Date.now() - e.timestamp.getTime()) / (1000 * 60 * 60);
    return hoursDiff < 24;
  }).length;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Audit Logs"
        eyebrowIcon={Activity}
        title="Activity Overview"
        subtitle="Platform-wide event tracking and monitoring."
      />

      <AdminStatGrid columns={3}>
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
      </AdminStatGrid>

      {/* Activity Timeline */}
      <ActivityTimeline
        events={allEvents}
        maxVisible={50}
        showViewAll={false}
      />
    </div>
  );
}
