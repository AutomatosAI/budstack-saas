import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, TrendingUp, UserPlus, Users } from "lucide-react";
import { ActivityTimeline } from "@/components/admin/ActivityTimeline";
import { generateMockEvents } from "@/lib/mock-data";

interface OverviewPanelProps {
  totalTenants: number;
  activeTenants: number;
  pendingOnboarding: number;
  totalUsers: number;
}

export function OverviewPanel({
  totalTenants,
  activeTenants,
  pendingOnboarding,
  totalUsers,
}: OverviewPanelProps) {
  return (
    <div className="min-h-screen saas-shell">
      <div className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-10">
          <span className="saas-pill text-slate-600">Super Admin</span>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900">
            Platform overview
          </h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Monitor the platform heartbeat, franchise readiness, and tenant
            onboarding progress from a single view.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="saas-card relative overflow-hidden border-0 p-5">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500" />
            <CardHeader className="space-y-2 p-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-600">
                  Total Tenants
                </CardTitle>
                <div className="rounded-full bg-cyan-100 p-2">
                  <Building2 className="h-4 w-4 text-cyan-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 pt-6">
              <div className="text-3xl font-semibold text-slate-900">
                {totalTenants}
              </div>
              <p className="mt-2 text-xs font-medium text-slate-500">
                NFT holders onboarded
              </p>
            </CardContent>
          </Card>

          <Card className="saas-card relative overflow-hidden border-0 p-5">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />
            <CardHeader className="space-y-2 p-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-600">
                  Active Stores
                </CardTitle>
                <div className="rounded-full bg-emerald-100 p-2">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 pt-6">
              <div className="text-3xl font-semibold text-slate-900">
                {activeTenants}
              </div>
              <p className="mt-2 text-xs font-medium text-slate-500">
                Stores live with Dr. Green
              </p>
            </CardContent>
          </Card>

          <Card className="saas-card relative overflow-hidden border-0 p-5">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400" />
            <CardHeader className="space-y-2 p-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-600">
                  Pending Approval
                </CardTitle>
                <div className="rounded-full bg-amber-100 p-2">
                  <UserPlus className="h-4 w-4 text-amber-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 pt-6">
              <div className="text-3xl font-semibold text-slate-900">
                {pendingOnboarding}
              </div>
              <p className="mt-2 text-xs font-medium text-slate-500">
                Awaiting verification
              </p>
            </CardContent>
          </Card>

          <Card className="saas-card relative overflow-hidden border-0 p-5">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400" />
            <CardHeader className="space-y-2 p-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-600">
                  Total Users
                </CardTitle>
                <div className="rounded-full bg-indigo-100 p-2">
                  <Users className="h-4 w-4 text-indigo-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 pt-6">
              <div className="text-3xl font-semibold text-slate-900">
                {totalUsers}
              </div>
              <p className="mt-2 text-xs font-medium text-slate-500">
                Platform-wide accounts
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10">
          <ActivityTimeline
            events={generateMockEvents(5)}
            maxVisible={5}
            showViewAll
            className="saas-card p-6"
          />
        </div>
      </div>
    </div>
  );
}
