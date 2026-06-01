"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { StatCard } from "@/components/admin/shared";
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
  BarChart3,
  Loader2,
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
import { ChartCard, AttentionItem } from "./analytics-components";
import { sectionTitleStyle } from "./analytics-helpers";
import {
  generateMockSignupData,
  generateMockRevenueData,
} from "./analytics-mock-data";

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
    if (
      isLoaded &&
      isSignedIn &&
      user?.publicMetadata?.role !== "SUPER_ADMIN"
    ) {
      router.push("/auth/login");
    }
  }, [isLoaded, isSignedIn, user, router]);

  useEffect(() => {
    if (user?.id) {
      fetchAllData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, timeRange]);

  const fetchAllData = async () => {
    try {
      const analyticsResponse = await fetch(
        `/api/super-admin/analytics?timeRange=${timeRange}`,
      );
      if (analyticsResponse.ok) {
        const data = await analyticsResponse.json();
        setAnalytics(data);
      }

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

  // Chart series hex literals — intentional product output (PRD §4.6), do NOT replace with tokens
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
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2
            className="mx-auto mb-4 h-10 w-10 animate-spin text-bs-fg-muted"
            aria-hidden="true"
          />
          <p className="text-bs-fg-muted">
            Loading comprehensive analytics...
          </p>
        </div>
      </div>
    );
  }

  if (!isSignedIn || !user || !analytics || !platformMetrics) {
    return null;
  }

  const timeRangeOptions: { value: "7d" | "30d" | "90d"; label: string }[] = [
    { value: "7d", label: "7 Days" },
    { value: "30d", label: "30 Days" },
    { value: "90d", label: "90 Days" },
  ];

  return (
    <div className="space-y-8">
      <div className="bs-page-header-compact flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="bs-page-title">Platform Analytics</h1>
          <p className="bs-page-subtitle">
            Comprehensive insights across all dimensions.
          </p>
        </div>
        <div className="flex gap-2 justify-start sm:justify-end">
          {timeRangeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTimeRange(opt.value)}
              className={cn(
                "bs-btn bs-btn-sm",
                timeRange === opt.value ? "bs-btn-green" : "bs-btn-ghost",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Key Business Metrics */}
      <section className="space-y-4">
        <h2
          className="text-[22px] leading-tight text-bs-fg"
          style={sectionTitleStyle}
        >
          Key Business Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            label="Total Revenue"
            value={`€${analytics.totalRevenue.toFixed(2)}`}
            icon={DollarSign}
            hint={
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="h-3 w-3" aria-hidden="true" />€
                {analytics.recentRevenue.toFixed(2)} this period
              </span>
            }
          />
          <StatCard
            label="Total Orders"
            value={analytics.totalOrders}
            icon={ShoppingCart}
            hint={`+${analytics.recentOrders} this period`}
          />
          <StatCard
            label="Total Customers"
            value={analytics.totalUsers}
            icon={Users}
            hint={`+${analytics.recentUsers} this period`}
          />
          <StatCard
            label="Active Stores"
            value={analytics.activeTenants}
            icon={Store}
            hint={`of ${analytics.totalTenants} total`}
          />
        </div>
      </section>

      {/* Platform Health Metrics */}
      <section className="space-y-4">
        <h2
          className="text-[22px] leading-tight text-bs-fg"
          style={sectionTitleStyle}
        >
          Platform Health Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            label="Monthly Recurring Revenue"
            value={`$${(platformMetrics.quickMetrics.mrr / 1000).toFixed(1)}k`}
            icon={DollarSign}
            hint="MRR"
          />
          <StatCard
            label="Churn Rate"
            value={`${platformMetrics.quickMetrics.churnRate}%`}
            icon={Percent}
            hint="Last 30 days"
          />
          <StatCard
            label="Avg Users per Tenant"
            value={platformMetrics.quickMetrics.avgUsersPerTenant.toFixed(1)}
            icon={Users}
            hint="Platform-wide"
          />
        </div>
      </section>

      {/* Business Intelligence (Recharts) */}
      <section className="space-y-4">
        <h2
          className="text-[22px] leading-tight text-bs-fg"
          style={sectionTitleStyle}
        >
          Business Intelligence
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bs-card bs-card-pad">
            <div className="mb-4">
              <h3
                className="text-[20px] leading-tight text-bs-fg"
                style={sectionTitleStyle}
              >
                Revenue Trend
              </h3>
              <p className="text-sm text-bs-fg-muted">
                Daily revenue over the selected period
              </p>
            </div>
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
          </div>

          <div className="bs-card bs-card-pad">
            <div className="mb-4">
              <h3
                className="text-[20px] leading-tight text-bs-fg"
                style={sectionTitleStyle}
              >
                Order Volume
              </h3>
              <p className="text-sm text-bs-fg-muted">
                Daily orders over the selected period
              </p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.ordersByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip labelFormatter={(label) => `Date: ${label}`} />
                <Bar dataKey="orders" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bs-card bs-card-pad">
            <div className="mb-4">
              <h3
                className="text-[20px] leading-tight text-bs-fg"
                style={sectionTitleStyle}
              >
                Revenue by Store
              </h3>
              <p className="text-sm text-bs-fg-muted">
                Distribution of revenue across stores
              </p>
            </div>
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
          </div>

          <div className="bs-card bs-card-pad">
            <div className="mb-4">
              <h3
                className="text-[20px] leading-tight text-bs-fg"
                style={sectionTitleStyle}
              >
                Customer Growth
              </h3>
              <p className="text-sm text-bs-fg-muted">
                New customer registrations over time
              </p>
            </div>
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
          </div>
        </div>
      </section>

      {/* Platform Trends (Plotly) */}
      <section className="space-y-4">
        <h2
          className="text-[22px] leading-tight text-bs-fg"
          style={sectionTitleStyle}
        >
          Platform Trends
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Tenant Signups"
            subtitle="Last 90 days"
            icon={TrendingUp}
          >
            <Plot
              data={[
                {
                  x: platformMetrics.tenantSignups.map((d) => d.date),
                  y: platformMetrics.tenantSignups.map((d) => d.count),
                  type: "scatter",
                  mode: "lines+markers",
                  line: { color: "#06b6d4", width: 3, shape: "spline" },
                  marker: {
                    color: "#06b6d4",
                    size: 6,
                    line: { color: "#0e7490", width: 2 },
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
                  gridcolor: "#1f2629",
                  showgrid: true,
                  zeroline: false,
                  tickfont: {
                    family: "JetBrains Mono, monospace",
                    size: 10,
                    color: "#8a9296",
                  },
                },
                yaxis: {
                  gridcolor: "#1f2629",
                  showgrid: true,
                  zeroline: false,
                  tickfont: {
                    family: "JetBrains Mono, monospace",
                    size: 10,
                    color: "#8a9296",
                  },
                },
                hovermode: "closest",
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%", height: "100%" }}
              useResizeHandler
            />
          </ChartCard>

          <ChartCard
            title="Platform Revenue"
            subtitle="Last 12 months"
            icon={DollarSign}
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
                  gridcolor: "#1f2629",
                  showgrid: false,
                  zeroline: false,
                  tickfont: {
                    family: "JetBrains Mono, monospace",
                    size: 10,
                    color: "#8a9296",
                  },
                  tickangle: -45,
                },
                yaxis: {
                  gridcolor: "#1f2629",
                  showgrid: true,
                  zeroline: false,
                  tickfont: {
                    family: "JetBrains Mono, monospace",
                    size: 10,
                    color: "#8a9296",
                  },
                  tickprefix: "$",
                },
                hovermode: "closest",
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%", height: "100%" }}
              useResizeHandler
            />
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard
            title="Tenant Distribution"
            subtitle="Active vs Inactive"
            icon={PieChartIcon}
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
                    line: { color: "#0a0c0d", width: 3 },
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
                    color: "#8a9296",
                  },
                  orientation: "h",
                  y: -0.2,
                },
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: "100%", height: "100%" }}
              useResizeHandler
            />
          </ChartCard>

          <div className="bs-card bs-card-pad">
            <div className="flex items-center gap-2 mb-4">
              <div className="rounded-bs-md bg-bs-warn/10 p-2 border border-bs-warn/30">
                <AlertCircle
                  className="h-5 w-5 text-bs-warn"
                  aria-hidden="true"
                />
              </div>
              <div>
                <h3
                  className="text-[20px] leading-tight text-bs-fg"
                  style={sectionTitleStyle}
                >
                  Needs Attention
                </h3>
                <p className="text-xs text-bs-fg-muted mt-0.5">
                  Action items requiring review
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <AttentionItem
                icon={UserPlus}
                label="Pending Onboarding"
                count={platformMetrics.needsAttention.pendingOnboarding}
                tone="info"
              />
              <AttentionItem
                icon={AlertCircle}
                label="Failed Payments"
                count={platformMetrics.needsAttention.failedPayments}
                tone="danger"
              />
              <AttentionItem
                icon={AlertCircle}
                label="Support Tickets"
                count={platformMetrics.needsAttention.supportTickets}
                tone="warn"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Top Performing Stores */}
      <section className="bs-card bs-card-pad">
        <div className="mb-6">
          <h2
            className="text-[22px] leading-tight text-bs-fg"
            style={sectionTitleStyle}
          >
            Top Performing Stores
          </h2>
          <p className="text-sm text-bs-fg-muted">
            Stores ranked by order volume and revenue
          </p>
        </div>
        <div className="space-y-4">
          {analytics.topTenants.map((tenant: any, index: number) => (
            <div
              key={tenant.id}
              className="flex items-center justify-between p-4 bg-bs-card-2/50 rounded-bs-md hover:bg-bs-card-2 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-bs-green flex items-center justify-center font-bold text-bs-canvas text-lg">
                  {index + 1}
                </div>
                <div>
                  <p className="font-semibold text-lg text-bs-fg">
                    {tenant.businessName}
                  </p>
                  <p className="text-sm text-bs-fg-muted">
                    {tenant.subdomain}.
                    {process.env.NEXT_PUBLIC_BASE_DOMAIN || "budstacks.io"}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-bs-green">
                  €{tenant._sum?.total?.toFixed(2) || "0.00"}
                </p>
                <p className="text-sm text-bs-fg-muted">
                  {tenant._count?.orders || 0} orders
                </p>
              </div>
            </div>
          ))}
          {analytics.topTenants.length === 0 && (
            <p className="text-center text-bs-fg-muted py-8">
              No data available yet
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

