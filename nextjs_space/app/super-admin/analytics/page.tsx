"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Store,
  PieChart as PieChartIcon,
  AlertCircle,
  Percent,
  UserPlus,
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";

// Dynamic import of Plotly for code splitting
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Plot = dynamic(() => import("react-plotly.js") as any, {
  ssr: false,
}) as any;

interface AnalyticsData {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  recentTenants: number;
  recentUsers: number;
  recentOrders: number;
  totalRevenue: number;
  recentRevenue: number;
  topTenants: any[];
  revenueByDay: any[];
  ordersByDay: any[];
  revenueByTenant: any[];
  customerGrowth: any[];
}

interface PlatformMetrics {
  tenantSignups: { date: string; count: number }[];
  platformRevenue: { month: string; revenue: number }[];
  tenantDistribution: { active: number; inactive: number };
  needsAttention: {
    pendingOnboarding: number;
    failedPayments: number;
    supportTickets: number;
  };
  quickMetrics: {
    mrr: number;
    churnRate: number;
    avgUsersPerTenant: number;
  };
}

export default function ComprehensiveAnalyticsPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [platformMetrics, setPlatformMetrics] =
    useState<PlatformMetrics | null>(null);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/auth/login");
    }
    if (isLoaded && isSignedIn && user?.publicMetadata?.role !== "SUPER_ADMIN") {
      router.push("/auth/login"); // Or access denied page
    }
  }, [isLoaded, isSignedIn, user, router]);

  useEffect(() => {
    if (user?.id) {
      fetchAllData();
    }
  }, [user, timeRange]);

  const fetchAllData = async () => {
    try {
      // Fetch business analytics from API
      const analyticsResponse = await fetch(
        `/api/super-admin/analytics?timeRange=${timeRange}`,
      );
      if (analyticsResponse.ok) {
        const data = await analyticsResponse.json();
        setAnalytics(data);
      }

      // Generate platform metrics (mock data - replace with real API in production)
      await new Promise((resolve) => setTimeout(resolve, 800));
      const platformData: PlatformMetrics = {
        tenantSignups: generateMockSignupData(),
        platformRevenue: generateMockRevenueData(),
        tenantDistribution: { active: 42, inactive: 8 },
        needsAttention: {
          pendingOnboarding: 3,
          failedPayments: 1,
          supportTickets: 5,
        },
        quickMetrics: {
          mrr: 127500,
          churnRate: 2.8,
          avgUsersPerTenant: 3.2,
        },
      };
      setPlatformMetrics(platformData);
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = [
    "#10b981",
    "#3b82f6",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
  ];

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center theme-force-light">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">
            Loading comprehensive analytics...
          </p>
        </div>
      </div>
    );
  }

  if (!isSignedIn || !user || !analytics || !platformMetrics) {
    return null;
  }

  return (
    <div className="space-y-8">
      {/* Centered Header with Time Range Selector */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="section-badge mb-4 inline-flex">
          Analytics
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Platform Analytics
        </h1>
        <p className="mt-3 text-muted-foreground">
          Comprehensive insights across all dimensions.
        </p>
        <div className="flex gap-2 justify-center mt-6">
          <Button
            variant={timeRange === "7d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("7d")}
            className={
              timeRange === "7d"
                ? "bg-accent hover:bg-accent/90 text-white rounded-xl"
                : "rounded-xl"
            }
          >
            7 Days
          </Button>
          <Button
            variant={timeRange === "30d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("30d")}
            className={
              timeRange === "30d"
                ? "bg-accent hover:bg-accent/90 text-white rounded-xl"
                : "rounded-xl"
            }
          >
            30 Days
          </Button>
          <Button
            variant={timeRange === "90d" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeRange("90d")}
            className={
              timeRange === "90d"
                ? "bg-accent hover:bg-accent/90 text-white rounded-xl"
                : "rounded-xl"
            }
          >
            90 Days
          </Button>
        </div>
      </div>

      {/* ========== SECTION 1: Key Business Metrics ========== */}
      <section>
        <h2 className="text-2xl font-bold mb-6 text-slate-900">
          Key Business Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Revenue */}
          <Card className="border-none shadow-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white overflow-hidden relative group hover:shadow-xl transition-shadow duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-emerald-50">
                Total Revenue
              </CardTitle>
              <DollarSign className="h-5 w-5 text-emerald-100" />
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold">
                €{analytics.totalRevenue.toFixed(2)}
              </div>
              <div className="flex items-center gap-1 text-xs mt-2">
                <TrendingUp className="w-3 h-3" />
                <span>+€{analytics.recentRevenue.toFixed(2)} this period</span>
              </div>
            </CardContent>
          </Card>

          {/* Total Orders */}
          <Card className="border-none shadow-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white overflow-hidden relative group hover:shadow-xl transition-shadow duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-amber-50">
                Total Orders
              </CardTitle>
              <ShoppingCart className="h-5 w-5 text-amber-100" />
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold">{analytics.totalOrders}</div>
              <p className="text-xs mt-2">
                +{analytics.recentOrders} this period
              </p>
            </CardContent>
          </Card>

          {/* Total Customers */}
          <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white overflow-hidden relative group hover:shadow-xl transition-shadow duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-purple-50">
                Total Customers
              </CardTitle>
              <Users className="h-5 w-5 text-purple-100" />
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold">{analytics.totalUsers}</div>
              <p className="text-xs mt-2">
                +{analytics.recentUsers} this period
              </p>
            </CardContent>
          </Card>

          {/* Active Stores */}
          <Card className="border-none shadow-lg bg-gradient-to-br from-cyan-500 to-blue-500 text-white overflow-hidden relative group hover:shadow-xl transition-shadow duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-cyan-50">
                Active Stores
              </CardTitle>
              <Store className="h-5 w-5 text-cyan-100" />
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-3xl font-bold">
                {analytics.activeTenants}
              </div>
              <p className="text-xs mt-2">of {analytics.totalTenants} total</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ========== SECTION 2: Platform Health Metrics (Mission Control) ========== */}
      <section>
        <h2 className="text-2xl font-bold mb-6 text-slate-900">
          Platform Health Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard
            icon={DollarSign}
            label="Monthly Recurring Revenue"
            value={`$${(platformMetrics.quickMetrics.mrr / 1000).toFixed(1)}k`}
            subValue="MRR"
            delay="0ms"
            accentColor="cyan"
          />
          <MetricCard
            icon={Percent}
            label="Churn Rate"
            value={`${platformMetrics.quickMetrics.churnRate}%`}
            subValue="Last 30 days"
            delay="100ms"
            accentColor="amber"
          />
          <MetricCard
            icon={Users}
            label="Avg Users per Tenant"
            value={platformMetrics.quickMetrics.avgUsersPerTenant.toFixed(1)}
            subValue="Platform-wide"
            delay="200ms"
            accentColor="emerald"
          />
        </div>
      </section>

      {/* ========== SECTION 3: Business Intelligence (Recharts) ========== */}
      <section>
        <h2 className="text-2xl font-bold mb-6 text-slate-900">
          Business Intelligence
        </h2>

        {/* Revenue & Orders Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Revenue Trend</CardTitle>
              <CardDescription>
                Daily revenue over the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: any) => `€${value.toFixed(2)}`}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ fill: "#10b981" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Order Volume</CardTitle>
              <CardDescription>
                Daily orders over the selected period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.ordersByDay}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip labelFormatter={(label) => `Date: ${label}`} />
                  <Bar dataKey="orders" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Revenue by Tenant & Customer Growth */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Revenue by Store</CardTitle>
              <CardDescription>
                Distribution of revenue across stores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.revenueByTenant}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) =>
                      `${entry.name}: €${entry.value.toFixed(0)}`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analytics.revenueByTenant.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => `€${value.toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Customer Growth</CardTitle>
              <CardDescription>
                New customer registrations over time
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.customerGrowth}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip labelFormatter={(label) => `Date: ${label}`} />
                  <Line
                    type="monotone"
                    dataKey="customers"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ fill: "#8b5cf6" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ========== SECTION 4: Platform Trends (Plotly - Mission Control) ========== */}
      <section>
        <h2 className="text-2xl font-bold mb-6 text-slate-900">
          Platform Trends
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Tenant Signups Chart */}
          <ChartCard
            title="Tenant Signups"
            subtitle="Last 90 days"
            icon={TrendingUp}
            delay="300ms"
          >
            <Plot
              data={[
                {
                  x: platformMetrics.tenantSignups.map((d) => d.date),
                  y: platformMetrics.tenantSignups.map((d) => d.count),
                  type: "scatter",
                  mode: "lines+markers",
                  line: {
                    color: "#06b6d4",
                    width: 3,
                    shape: "spline",
                  },
                  marker: {
                    color: "#06b6d4",
                    size: 6,
                    line: {
                      color: "#0e7490",
                      width: 2,
                    },
                  },
                  fill: "tozeroy",
                  fillcolor: "rgba(6, 182, 212, 0.1)",
                },
              ]}
              layout={{
                autosize: true,
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: "rgba(0,0,0,0)",
                margin: { l: 40, r: 20, t: 20, b: 40 },
                xaxis: {
                  gridcolor: "#e2e8f0",
                  showgrid: true,
                  zeroline: false,
                  tickfont: {
                    family: "JetBrains Mono, monospace",
                    size: 10,
                    color: "#64748b",
                  },
                },
                yaxis: {
                  gridcolor: "#e2e8f0",
                  showgrid: true,
                  zeroline: false,
                  tickfont: {
                    family: "JetBrains Mono, monospace",
                    size: 10,
                    color: "#64748b",
                  },
                },
                hovermode: "closest",
              }}
              config={{
                displayModeBar: false,
                responsive: true,
              }}
              style={{ width: "100%", height: "100%" }}
              useResizeHandler
            />
          </ChartCard>

          {/* Platform Revenue Chart */}
          <ChartCard
            title="Platform Revenue"
            subtitle="Last 12 months"
            icon={DollarSign}
            delay="400ms"
          >
            <Plot
              data={[
                {
                  x: platformMetrics.platformRevenue.map((d) => d.month),
                  y: platformMetrics.platformRevenue.map((d) => d.revenue),
                  type: "bar",
                  marker: {
                    color: platformMetrics.platformRevenue.map((_, i) =>
                      i === platformMetrics.platformRevenue.length - 1
                        ? "#06b6d4"
                        : "#cbd5e1",
                    ),
                    line: {
                      color: platformMetrics.platformRevenue.map((_, i) =>
                        i === platformMetrics.platformRevenue.length - 1
                          ? "#0e7490"
                          : "#94a3b8",
                      ),
                      width: 2,
                    },
                  },
                },
              ]}
              layout={{
                autosize: true,
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: "rgba(0,0,0,0)",
                margin: { l: 50, r: 20, t: 20, b: 60 },
                xaxis: {
                  gridcolor: "#e2e8f0",
                  showgrid: false,
                  zeroline: false,
                  tickfont: {
                    family: "JetBrains Mono, monospace",
                    size: 10,
                    color: "#64748b",
                  },
                  tickangle: -45,
                },
                yaxis: {
                  gridcolor: "#e2e8f0",
                  showgrid: true,
                  zeroline: false,
                  tickfont: {
                    family: "JetBrains Mono, monospace",
                    size: 10,
                    color: "#64748b",
                  },
                  tickprefix: "$",
                },
                hovermode: "closest",
              }}
              config={{
                displayModeBar: false,
                responsive: true,
              }}
              style={{ width: "100%", height: "100%" }}
              useResizeHandler
            />
          </ChartCard>
        </div>

        {/* Bottom Row: Pie Chart + Needs Attention */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active vs Inactive Tenants */}
          <ChartCard
            title="Tenant Distribution"
            subtitle="Active vs Inactive"
            icon={PieChartIcon}
            delay="500ms"
          >
            <Plot
              data={[
                {
                  values: [
                    platformMetrics.tenantDistribution.active,
                    platformMetrics.tenantDistribution.inactive,
                  ],
                  labels: ["Active", "Inactive"],
                  type: "pie",
                  marker: {
                    colors: ["#06b6d4", "#cbd5e1"],
                    line: {
                      color: "#fff",
                      width: 3,
                    },
                  },
                  textfont: {
                    family: "JetBrains Mono, monospace",
                    size: 14,
                    color: "#fff",
                  },
                  hole: 0.4,
                },
              ]}
              layout={{
                autosize: true,
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: "rgba(0,0,0,0)",
                margin: { l: 20, r: 20, t: 20, b: 20 },
                showlegend: true,
                legend: {
                  font: {
                    family: "JetBrains Mono, monospace",
                    size: 12,
                    color: "#64748b",
                  },
                  orientation: "h",
                  y: -0.2,
                },
              }}
              config={{
                displayModeBar: false,
                responsive: true,
              }}
              style={{ width: "100%", height: "100%" }}
              useResizeHandler
            />
          </ChartCard>

          {/* Needs Attention Card */}
          <Card
            className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4"
            style={{ animationDelay: "600ms", animationFillMode: "backwards" }}
          >
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-slate-900">
                    Needs Attention
                  </CardTitle>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Action items requiring review
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <AttentionItem
                  icon={UserPlus}
                  label="Pending Onboarding"
                  count={platformMetrics.needsAttention.pendingOnboarding}
                  color="cyan"
                />
                <AttentionItem
                  icon={AlertCircle}
                  label="Failed Payments"
                  count={platformMetrics.needsAttention.failedPayments}
                  color="red"
                />
                <AttentionItem
                  icon={AlertCircle}
                  label="Support Tickets"
                  count={platformMetrics.needsAttention.supportTickets}
                  color="amber"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ========== SECTION 5: Top Performing Stores ========== */}
      <section>
        <Card className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Top Performing Stores</CardTitle>
            <CardDescription>
              Stores ranked by order volume and revenue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.topTenants.map((tenant: any, index: number) => (
                <div
                  key={tenant.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center font-bold text-white text-lg">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-lg">
                        {tenant.businessName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {tenant.subdomain}.budstack.to
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-green-600">
                      €{tenant._sum?.total?.toFixed(2) || "0.00"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {tenant._count?.orders || 0} orders
                    </p>
                  </div>
                </div>
              ))}
              {analytics.topTenants.length === 0 && (
                <p className="text-center text-gray-500 py-8">
                  No data available yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

/* ============================================================================
 * Supporting Components
 * ========================================================================= */

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue: string;
  delay: string;
  accentColor: "cyan" | "amber" | "emerald";
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  delay,
  accentColor,
}: MetricCardProps) {
  const colorMap = {
    cyan: {
      border: "border-cyan-200",
      iconBg: "bg-cyan-500/10",
      iconBorder: "border-cyan-500/20",
      iconColor: "text-cyan-600",
      valueColor: "text-cyan-600",
    },
    amber: {
      border: "border-amber-200",
      iconBg: "bg-amber-500/10",
      iconBorder: "border-amber-500/20",
      iconColor: "text-amber-600",
      valueColor: "text-amber-600",
    },
    emerald: {
      border: "border-emerald-200",
      iconBg: "bg-emerald-500/10",
      iconBorder: "border-emerald-500/20",
      iconColor: "text-emerald-600",
      valueColor: "text-emerald-600",
    },
  };

  const colors = colorMap[accentColor];

  return (
    <Card
      className={cn(
        "bg-white rounded-2xl border border-slate-200/50 shadow-2xl overflow-hidden hover:shadow-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4",
      )}
      style={{ animationDelay: delay, animationFillMode: "backwards" }}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <div
              className={cn(
                "p-2.5 rounded-lg border inline-block",
                colors.iconBg,
                colors.iconBorder,
              )}
            >
              <Icon className={cn("h-5 w-5", colors.iconColor)} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wider">
                {label}
              </p>
              <p
                className={cn("text-4xl font-bold mt-2", colors.valueColor)}
                style={{ fontFamily: "JetBrains Mono, monospace" }}
              >
                {value}
              </p>
              <p
                className="text-xs text-slate-500 mt-1"
                style={{ fontFamily: "JetBrains Mono, monospace" }}
              >
                {subValue}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ChartCardProps {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  delay: string;
  children: React.ReactNode;
}

function ChartCard({
  title,
  subtitle,
  icon: Icon,
  delay,
  children,
}: ChartCardProps) {
  return (
    <Card
      className="bg-white rounded-2xl border border-slate-200/50 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4"
      style={{ animationDelay: delay, animationFillMode: "backwards" }}
    >
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <Icon className="h-5 w-5 text-cyan-600" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold text-slate-900">
              {title}
            </CardTitle>
            <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="h-[280px] relative">{children}</div>
      </CardContent>
    </Card>
  );
}

interface AttentionItemProps {
  icon: React.ElementType;
  label: string;
  count: number;
  color: "cyan" | "red" | "amber";
}

function AttentionItem({
  icon: Icon,
  label,
  count,
  color,
}: AttentionItemProps) {
  const colorMap = {
    cyan: {
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/20",
      icon: "text-cyan-600",
      badge: "bg-cyan-500 text-white",
    },
    red: {
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      icon: "text-red-600",
      badge: "bg-red-500 text-white",
    },
    amber: {
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      icon: "text-amber-600",
      badge: "bg-amber-500 text-white",
    },
  };

  const colors = colorMap[color];

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border-2 border-slate-200 hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg border", colors.bg, colors.border)}>
          <Icon className={cn("h-4 w-4", colors.icon)} />
        </div>
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <div
        className={cn("px-3 py-1 rounded-full text-sm font-bold", colors.badge)}
        style={{ fontFamily: "JetBrains Mono, monospace" }}
      >
        {count}
      </div>
    </div>
  );
}

/* ============================================================================
 * Mock Data Generators
 * ========================================================================= */

function generateMockSignupData() {
  const data = [];
  const today = new Date();

  for (let i = 89; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const count = Math.floor(Math.random() * 5) + 1;

    data.push({
      date: date.toISOString().split("T")[0],
      count,
    });
  }

  return data;
}

function generateMockRevenueData() {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const data = [];

  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthName = months[date.getMonth()];
    const year = date.getFullYear().toString().slice(2);
    const revenue = Math.floor(Math.random() * 50000) + 80000;

    data.push({
      month: `${monthName} '${year}`,
      revenue,
    });
  }

  return data;
}
