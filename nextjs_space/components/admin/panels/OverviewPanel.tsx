import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, TrendingUp, UserPlus, Users } from 'lucide-react';
import { ActivityTimeline } from '@/components/admin/ActivityTimeline';
import { generateMockEvents } from '@/lib/mock-data';

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
    totalUsers
}: OverviewPanelProps) {
    return (
        <div className="p-8">
            <div className="space-y-8">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Overview</h1>
                    <p className="text-slate-600 mt-2">Platform statistics and quick insights</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Total Tenants */}
                    <Card className="border-none shadow-lg bg-gradient-to-br from-cyan-500 to-blue-500 text-white overflow-hidden relative group hover:shadow-xl transition-shadow duration-300">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300" />
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                            <CardTitle className="text-sm font-medium text-cyan-50">Total Tenants</CardTitle>
                            <Building2 className="h-5 w-5 text-cyan-100" />
                        </CardHeader>
                        <CardContent className="relative z-10">
                            <div className="text-3xl font-bold">{totalTenants}</div>
                            <p className="text-xs text-cyan-100 mt-1">NFT holders</p>
                        </CardContent>
                    </Card>

                    {/* Active Stores */}
                    <Card className="border-none shadow-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white overflow-hidden relative group hover:shadow-xl transition-shadow duration-300">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300" />
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                            <CardTitle className="text-sm font-medium text-emerald-50">Active Stores</CardTitle>
                            <TrendingUp className="h-5 w-5 text-emerald-100" />
                        </CardHeader>
                        <CardContent className="relative z-10">
                            <div className="text-3xl font-bold">{activeTenants}</div>
                            <p className="text-xs text-emerald-100 mt-1">Live storefronts</p>
                        </CardContent>
                    </Card>

                    {/* Pending Approval */}
                    <Card className="border-none shadow-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white overflow-hidden relative group hover:shadow-xl transition-shadow duration-300">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300" />
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                            <CardTitle className="text-sm font-medium text-amber-50">Pending Approval</CardTitle>
                            <UserPlus className="h-5 w-5 text-amber-100" />
                        </CardHeader>
                        <CardContent className="relative z-10">
                            <div className="text-3xl font-bold">{pendingOnboarding}</div>
                            <p className="text-xs text-amber-100 mt-1">Awaiting verification</p>
                        </CardContent>
                    </Card>

                    {/* Total Users */}
                    <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white overflow-hidden relative group hover:shadow-xl transition-shadow duration-300">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300" />
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                            <CardTitle className="text-sm font-medium text-purple-50">Total Users</CardTitle>
                            <Users className="h-5 w-5 text-purple-100" />
                        </CardHeader>
                        <CardContent className="relative z-10">
                            <div className="text-3xl font-bold">{totalUsers}</div>
                            <p className="text-xs text-purple-100 mt-1">Platform-wide</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Additional Info Card */}
                <Card className="shadow-lg border-slate-200">
                    <CardHeader className="border-b bg-gradient-to-r from-slate-50 to-slate-100">
                        <CardTitle className="text-xl">Platform Health</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                <span className="text-sm text-slate-600">Active Tenant Rate</span>
                                <span className="text-sm font-semibold text-slate-900">
                                    {totalTenants > 0 ? Math.round((activeTenants / totalTenants) * 100) : 0}%
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                <span className="text-sm text-slate-600">Pending Approvals</span>
                                <span className={`text-sm font-semibold ${pendingOnboarding > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {pendingOnboarding > 0 ? `${pendingOnboarding} awaiting` : 'All clear'}
                                </span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                                <span className="text-sm text-slate-600">Avg. Users per Tenant</span>
                                <span className="text-sm font-semibold text-slate-900">
                                    {totalTenants > 0 ? (totalUsers / totalTenants).toFixed(1) : 0}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Recent Activity Timeline */}
                <ActivityTimeline
                    events={generateMockEvents(5)}
                    maxVisible={5}
                    showViewAll={true}
                />
            </div>
        </div>
    );
}
