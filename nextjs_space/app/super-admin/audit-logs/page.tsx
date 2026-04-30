import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Activity, Clock, ShieldCheck } from "lucide-react";
import { ActivityTimeline } from "@/components/admin/ActivityTimeline";
import { generateMockEvents } from "@/lib/mock-data";
import { StatCard } from "@/components/admin/shared";

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
      {/* Centered Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="section-badge mb-4 inline-flex">
          <Activity className="h-4 w-4" />
          Audit Logs
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Activity Overview
        </h1>
        <p className="mt-3 text-muted-foreground">
          Platform-wide event tracking and monitoring.
        </p>
      </div>

      {/* Stats */}
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

      {/* Activity Timeline */}
      <ActivityTimeline
        events={allEvents}
        maxVisible={50}
        showViewAll={false}
      />
    </div>
  );
}
