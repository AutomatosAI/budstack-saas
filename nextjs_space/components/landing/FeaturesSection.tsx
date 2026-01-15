"use client";

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    ResponsiveContainer,
    Tooltip,
} from "recharts";
import {
    TrendingUp,
    Users,
    Code,
    Monitor,
    Bell,
    FileCheck,
    CheckCircle2,
    Clock,
    Package,
} from "lucide-react";

const revenueData = [
    { month: "Jan", revenue: 4200 },
    { month: "Feb", revenue: 3800 },
    { month: "Mar", revenue: 5100 },
    { month: "Apr", revenue: 4700 },
    { month: "May", revenue: 6300 },
    { month: "Jun", revenue: 5900 },
    { month: "Jul", revenue: 7200 },
    { month: "Aug", revenue: 8100 },
    { month: "Sep", revenue: 7600 },
    { month: "Oct", revenue: 9200 },
    { month: "Nov", revenue: 10500 },
    { month: "Dec", revenue: 12400 },
];

export default function FeaturesSection() {
    return (
        <section id="features" className="px-4 py-24 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                {/* Section header */}
                <div className="mb-20 text-center">
                    <div className="mb-4 flex justify-center">
                        <div className="section-badge">
                            <Monitor className="h-4 w-4" />
                            Feature Preview
                        </div>
                    </div>
                    <h2 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                        Everything you need to run
                        <br />
                        <span className="text-gradient">your dispensary</span>
                    </h2>
                    <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                        Replace manual processes with a reliable platform. Real-time
                        analytics, order management, and customer insights — all in one
                        place.
                    </p>
                </div>

                {/* Feature cards grid */}
                <div className="grid gap-10 lg:grid-cols-2">
                    {/* Revenue Analytics Card */}
                    <div className="card-floating p-8 lg:p-10">
                        <div className="mb-6 flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                <div className="icon-badge">
                                    <TrendingUp className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-display text-lg font-semibold text-foreground">
                                        Revenue Analytics
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Track sales, trends, and growth at a glance.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Stats row */}
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full bg-success" />
                                <span className="text-sm text-muted-foreground">
                                    Monthly Revenue
                                </span>
                            </div>
                            <span className="stat-badge-success">+28% QoQ</span>
                        </div>

                        {/* Chart */}
                        <div className="chart-inner p-4">
                            <div className="h-40 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={revenueData}>
                                        <defs>
                                            <linearGradient
                                                id="revenueGradient"
                                                x1="0"
                                                y1="0"
                                                x2="0"
                                                y2="1"
                                            >
                                                <stop
                                                    offset="0%"
                                                    stopColor="hsl(24, 95%, 53%)"
                                                    stopOpacity={0.35}
                                                />
                                                <stop
                                                    offset="100%"
                                                    stopColor="hsl(24, 95%, 53%)"
                                                    stopOpacity={0.05}
                                                />
                                            </linearGradient>
                                        </defs>
                                        <XAxis
                                            dataKey="month"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fontSize: 11, fill: "hsl(220, 9%, 46%)" }}
                                        />
                                        <YAxis hide />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: "hsl(0, 0%, 100%)",
                                                border: "1px solid hsla(222, 47%, 11%, 0.06)",
                                                borderRadius: "12px",
                                                boxShadow: "0 8px 24px hsla(222, 47%, 11%, 0.12)",
                                            }}
                                            formatter={(value: number) => [
                                                `€${value.toLocaleString()}`,
                                                "Revenue",
                                            ]}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="revenue"
                                            stroke="hsl(24, 95%, 53%)"
                                            strokeWidth={2.5}
                                            fill="url(#revenueGradient)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Bottom stat */}
                        <div className="mt-4 tile flex items-center justify-between px-5 py-4">
                            <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full bg-accent" />
                                <span className="text-sm text-muted-foreground">
                                    Avg. Order Value
                                </span>
                            </div>
                            <span className="font-semibold text-accent">€127</span>
                        </div>
                    </div>

                    {/* Order Management Card */}
                    <div className="card-floating p-8 lg:p-10">
                        <div className="mb-6 flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                <div className="icon-badge">
                                    <Package className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-display text-lg font-semibold text-foreground">
                                        Order Management
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Real-time order tracking and fulfillment status.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Stats grid */}
                        <div className="mb-4 grid grid-cols-3 gap-4">
                            <div className="tile p-4">
                                <p className="text-xs text-muted-foreground">Pending</p>
                                <p className="font-display text-2xl font-bold text-foreground">
                                    24
                                </p>
                            </div>
                            <div className="tile p-4">
                                <p className="text-xs text-muted-foreground">Processing</p>
                                <p className="font-display text-2xl font-bold text-foreground">
                                    12
                                </p>
                            </div>
                            <div className="tile p-4">
                                <p className="text-xs text-muted-foreground">Fulfilled</p>
                                <p className="font-display text-2xl font-bold text-success">
                                    89%
                                </p>
                            </div>
                        </div>

                        {/* Alert */}
                        <div className="card-nested mb-4 flex items-center justify-between bg-accent/5 px-5 py-4">
                            <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full bg-accent" />
                                <span className="text-sm text-foreground">
                                    3 orders require attention
                                </span>
                            </div>
                            <span className="text-sm font-medium text-accent">View</span>
                        </div>

                        {/* Order downloads */}
                        <div className="tile flex items-center justify-between px-5 py-4">
                            <div className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--chart-blue))]" />
                                <span className="text-sm text-muted-foreground">
                                    Today&apos;s Orders
                                </span>
                            </div>
                            <span className="stat-badge-success">+19%</span>
                        </div>
                    </div>

                    {/* Consultation Tracking Card - Purple theme */}
                    <div className="card-floating p-8 lg:p-10">
                        <div className="mb-8 flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                {/* Purple icon badge */}
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-600">
                                    <Users className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-display text-lg font-semibold text-foreground">
                                        Consultation Pipeline
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Track patient onboarding and KYC status.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Tasks list - with visible borders */}
                        <div className="space-y-3">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between px-5 py-4">
                                <div className="flex items-center gap-3">
                                    <Monitor className="h-4 w-4 text-slate-500" />
                                    <span className="text-sm text-foreground">
                                        New consultation: John D.
                                    </span>
                                </div>
                                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-600">
                                    Approved
                                </span>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between px-5 py-4">
                                <div className="flex items-center gap-3">
                                    <Bell className="h-4 w-4 text-slate-500" />
                                    <span className="text-sm text-foreground">
                                        KYC pending: Maria S.
                                    </span>
                                </div>
                                <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-600">
                                    Review
                                </span>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between px-5 py-4">
                                <div className="flex items-center gap-3">
                                    <FileCheck className="h-4 w-4 text-slate-500" />
                                    <span className="text-sm text-foreground">
                                        Documents verified: Alex K.
                                    </span>
                                </div>
                                <span className="text-xs font-semibold text-slate-500">
                                    Today
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Dr. Green Integration Card - Emerald theme */}
                    <div className="card-floating p-8 lg:p-10">
                        <div className="mb-8 flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                {/* Emerald icon badge */}
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600">
                                    <Code className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-display text-lg font-semibold text-foreground">
                                        Dr. Green API Status
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Live product sync and order fulfillment.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* API Health header */}
                        <div className="mb-6 flex items-center justify-between">
                            <span className="flex items-center gap-3 text-sm text-slate-600">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                                    <TrendingUp className="h-4 w-4 text-slate-500" />
                                </div>
                                API Health
                            </span>
                            <span className="text-xs font-medium text-slate-500">Real-time</span>
                        </div>

                        {/* Stats - with visible borders */}
                        <div className="mb-6 grid grid-cols-3 gap-4">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs text-slate-500">Uptime</p>
                                <p className="text-lg font-bold text-emerald-600">99.9%</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs text-slate-500">Response</p>
                                <p className="text-lg font-bold text-foreground">42ms</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs text-slate-500">Products</p>
                                <p className="text-lg font-bold text-foreground">2.4k</p>
                            </div>
                        </div>

                        {/* Status items - with visible borders */}
                        <div className="space-y-3">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between px-5 py-3">
                                <div className="flex items-center gap-2">
                                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                    <span className="text-sm text-foreground">
                                        Product catalog synced
                                    </span>
                                </div>
                                <span className="text-xs font-semibold text-emerald-600">Active</span>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between px-5 py-3">
                                <div className="flex items-center gap-2">
                                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                                    <span className="text-sm text-foreground">
                                        Blockchain traceability
                                    </span>
                                </div>
                                <span className="text-xs font-semibold text-emerald-600">
                                    Enabled
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom row */}
                <div className="mt-10 flex items-center justify-between text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Enterprise-grade security
                    </span>
                    <span className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Real-time updates
                    </span>
                </div>
            </div>
        </section>
    );
}
