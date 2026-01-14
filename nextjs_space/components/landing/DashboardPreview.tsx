"use client";

import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import {
    LayoutDashboard,
    TrendingUp,
    Package,
    Users,
    BarChart3,
    Bell,
} from "lucide-react";

const revenueData = [
    { month: "Jan", value: 4200 },
    { month: "Feb", value: 3800 },
    { month: "Mar", value: 5100 },
    { month: "Apr", value: 5400 },
    { month: "May", value: 6300 },
    { month: "Jun", value: 5900 },
    { month: "Jul", value: 7200 },
    { month: "Aug", value: 7800 },
];

const orderStatusData = [
    { name: "Fulfilled", value: 68, color: "hsl(142, 71%, 45%)" },
    { name: "Processing", value: 22, color: "hsl(24, 95%, 53%)" },
    { name: "Pending", value: 10, color: "hsl(220, 9%, 46%)" },
];

const sidebarItems = [
    { icon: LayoutDashboard, label: "Dashboard", active: true },
    { icon: BarChart3, label: "Analytics" },
    { icon: Package, label: "Orders" },
    { icon: Users, label: "Customers" },
];

export default function DashboardPreview() {
    return (
        <section className="px-4 py-20 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
                {/* Browser window mockup - primary floating card */}
                <div className="card-floating-static overflow-hidden">
                    {/* Browser header */}
                    <div className="flex items-center gap-3 border-b border-[hsla(var(--edge),var(--edge-opacity))] bg-muted/30 px-5 py-4">
                        <div className="flex gap-2">
                            <div className="h-3 w-3 rounded-full bg-muted-foreground/20" />
                            <div className="h-3 w-3 rounded-full bg-muted-foreground/20" />
                            <div className="h-3 w-3 rounded-full bg-muted-foreground/20" />
                        </div>
                        <div className="flex-1 text-center">
                            <span className="text-sm text-muted-foreground">
                                your-brand.budstack.to - Dashboard
                            </span>
                        </div>
                    </div>

                    {/* Dashboard content */}
                    <div className="flex">
                        {/* Sidebar */}
                        <div className="hidden w-56 border-r border-[hsla(var(--edge),var(--edge-opacity))] bg-muted/20 p-6 md:block">
                            <div className="mb-10">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-xl bg-accent shadow-md" />
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">
                                            Your Brand
                                        </p>
                                        <p className="text-xs text-muted-foreground">Dispensary</p>
                                    </div>
                                </div>
                            </div>

                            <nav className="space-y-1.5">
                                {sidebarItems.map((item) => (
                                    <a
                                        key={item.label}
                                        href="#"
                                        className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors ${item.active
                                                ? "bg-accent text-accent-foreground shadow-sm"
                                                : "text-muted-foreground hover:bg-muted"
                                            }`}
                                    >
                                        <item.icon className="h-4 w-4" />
                                        {item.label}
                                    </a>
                                ))}
                            </nav>
                        </div>

                        {/* Main content */}
                        <div className="flex-1 p-8 lg:p-10">
                            {/* Header */}
                            <div className="mb-10 flex items-center justify-between">
                                <div>
                                    <h2 className="font-display text-xl font-bold text-foreground">
                                        Dashboard
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        Track your store performance
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="tile px-4 py-2 text-xs text-muted-foreground">
                                        Last 30 days
                                    </span>
                                    <div className="tile flex h-10 w-10 items-center justify-center">
                                        <Bell className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                </div>
                            </div>

                            {/* Stats row - nested cards */}
                            <div className="mb-10 grid grid-cols-2 gap-5 lg:grid-cols-4">
                                <div className="card-nested p-5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">
                                            Revenue
                                        </span>
                                        <TrendingUp className="h-4 w-4 text-success" />
                                    </div>
                                    <p className="mt-2 font-display text-2xl font-bold text-foreground">
                                        €42.8k
                                    </p>
                                    <p className="mt-1 text-xs text-success">
                                        +18% vs last month
                                    </p>
                                </div>
                                <div className="card-nested p-5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">
                                            Orders
                                        </span>
                                        <Package className="h-4 w-4 text-accent" />
                                    </div>
                                    <p className="mt-2 font-display text-2xl font-bold text-foreground">
                                        324
                                    </p>
                                    <p className="mt-1 text-xs text-success">
                                        +12% vs last month
                                    </p>
                                </div>
                                <div className="card-nested p-5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">
                                            Customers
                                        </span>
                                        <Users className="h-4 w-4 text-[hsl(var(--chart-blue))]" />
                                    </div>
                                    <p className="mt-2 font-display text-2xl font-bold text-foreground">
                                        1,247
                                    </p>
                                    <p className="mt-1 text-xs text-success">+8% vs last month</p>
                                </div>
                                <div className="card-nested p-5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground">
                                            Conversion
                                        </span>
                                        <BarChart3 className="h-4 w-4 text-warning" />
                                    </div>
                                    <p className="mt-2 font-display text-2xl font-bold text-foreground">
                                        3.2%
                                    </p>
                                    <p className="mt-1 text-xs text-success">
                                        +0.4% vs last month
                                    </p>
                                </div>
                            </div>

                            {/* Charts row */}
                            <div className="grid gap-6 lg:grid-cols-3">
                                {/* Revenue chart - nested card */}
                                <div className="card-nested p-6 lg:col-span-2">
                                    <div className="mb-5 flex items-center justify-between">
                                        <div>
                                            <p className="font-semibold text-foreground">
                                                Revenue Trend
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Monthly revenue over time
                                            </p>
                                        </div>
                                        <span className="stat-badge-success">+28% QoQ</span>
                                    </div>
                                    <div className="chart-inner p-4">
                                        <div className="h-44">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={revenueData}>
                                                    <defs>
                                                        <linearGradient
                                                            id="dashboardGradient"
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
                                                        tick={{ fontSize: 10, fill: "hsl(220, 9%, 46%)" }}
                                                    />
                                                    <YAxis hide />
                                                    <Area
                                                        type="monotone"
                                                        dataKey="value"
                                                        stroke="hsl(24, 95%, 53%)"
                                                        strokeWidth={2.5}
                                                        fill="url(#dashboardGradient)"
                                                    />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>

                                {/* Order status pie - nested card */}
                                <div className="card-nested p-6">
                                    <div className="mb-5">
                                        <p className="font-semibold text-foreground">Order Status</p>
                                        <p className="text-xs text-muted-foreground">
                                            Distribution by status
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center">
                                        <div className="h-36 w-36">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <PieChart>
                                                    <Pie
                                                        data={orderStatusData}
                                                        cx="50%"
                                                        cy="50%"
                                                        innerRadius={38}
                                                        outerRadius={58}
                                                        paddingAngle={3}
                                                        dataKey="value"
                                                    >
                                                        {orderStatusData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Pie>
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                    <div className="mt-5 space-y-3">
                                        {orderStatusData.map((item) => (
                                            <div
                                                key={item.name}
                                                className="flex items-center justify-between"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="h-2.5 w-2.5 rounded-full"
                                                        style={{ backgroundColor: item.color }}
                                                    />
                                                    <span className="text-xs text-muted-foreground">
                                                        {item.name}
                                                    </span>
                                                </div>
                                                <span className="text-xs font-medium text-foreground">
                                                    {item.value}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
