import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ActivityTimeline } from "@/components/admin/ActivityTimeline";
import { generateMockEvents } from "@/lib/mock-data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AuditLogsPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "SUPER_ADMIN") {
    redirect("/auth/login");
  }

  // Generate mock events for demo (replace with real data in production)
  const allEvents = generateMockEvents(50);

  return (
    <div className="p-8">
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Audit Logs
          </h1>
          <p className="text-slate-600 mt-2">
            Complete activity history and system events
          </p>
        </div>

        {/* Stats Card */}
        <Card className="border-slate-200 shadow-lg">
          <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100">
            <CardTitle className="text-xl">Activity Overview</CardTitle>
            <CardDescription>
              Platform-wide event tracking and monitoring
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col">
                <span className="text-sm text-slate-600 mb-1">
                  Total Events
                </span>
                <span className="text-2xl font-bold text-slate-900">
                  {allEvents.length}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-slate-600 mb-1">
                  Last 24 Hours
                </span>
                <span className="text-2xl font-bold text-emerald-600">
                  {
                    allEvents.filter((e) => {
                      const hoursDiff =
                        (Date.now() - e.timestamp.getTime()) / (1000 * 60 * 60);
                      return hoursDiff < 24;
                    }).length
                  }
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-slate-600 mb-1">
                  Active Monitoring
                </span>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-600">Monitoring Enabled</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activity Timeline */}
        <ActivityTimeline
          events={allEvents}
          maxVisible={50}
          showViewAll={false}
        />
      </div>
    </div>
  );
}
