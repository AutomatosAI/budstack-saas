"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Calendar,
  ArrowUpRight,
  ShoppingBag,
} from "lucide-react";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/admin/shared/StatCard";
import { RowPill, type RowPillTone } from "@/components/admin/shared/RowPill";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// Dynamic import for Plotly to avoid SSR issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Plot = dynamic(() => import("react-plotly.js") as any, {
  ssr: false,
}) as any;

interface AnalyticsData {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
  recentOrders: number;
  recentCustomers: number;
  recentRevenue: number;
  avgOrderValue: number;
  revenueByDay: any[];
  ordersByDay: any[];
  topProducts: any[];
  customerGrowth: any[];
  ordersByStatus: any[];
}

interface RevenueMetric {
  label: string;
  value: number;
  change: number;
  period: string;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  customer: string;
  total: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELLED";
  createdAt: Date;
}

interface RecentCustomer {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

const generateSalesTrendData = () => {
  const days = 30;
  const data = [];
  let baseValue = 800;

  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (days - i));
    const variance = Math.random() * 400 - 200;
    const weekendBoost = [0, 6].includes(date.getDay()) ? 200 : 0;
    baseValue += Math.random() * 100 - 50;
    data.push({
      date: date.toISOString().split("T")[0],
      sales: Math.max(200, baseValue + variance + weekendBoost),
    });
  }

  return data;
};

const getRevenueMetrics = (
  analytics: AnalyticsData | null,
): RevenueMetric[] => {
  if (!analytics) {
    return [
      { label: "Today's Revenue", value: 0, change: 0, period: "vs yesterday" },
      { label: "This Week", value: 0, change: 0, period: "vs last week" },
      { label: "This Month", value: 0, change: 0, period: "vs last month" },
    ];
  }

  return [
    {
      label: "Today's Revenue",
      value: analytics.recentRevenue * 0.1,
      change: 12.5,
      period: "vs yesterday",
    },
    {
      label: "This Week",
      value: analytics.recentRevenue * 0.7,
      change: 8.3,
      period: "vs last week",
    },
    {
      label: "This Month",
      value: analytics.totalRevenue,
      change: 15.7,
      period: "vs last month",
    },
  ];
};

const generateRecentOrders = (): RecentOrder[] => [
  {
    id: "1",
    orderNumber: "ORD-1247",
    customer: "Sarah Chen",
    total: 85.5,
    status: "COMPLETED",
    createdAt: new Date(Date.now() - 1000 * 60 * 15),
  },
  {
    id: "2",
    orderNumber: "ORD-1246",
    customer: "Marcus Johnson",
    total: 120.0,
    status: "PROCESSING",
    createdAt: new Date(Date.now() - 1000 * 60 * 45),
  },
  {
    id: "3",
    orderNumber: "ORD-1245",
    customer: "Emma Williams",
    total: 65.75,
    status: "COMPLETED",
    createdAt: new Date(Date.now() - 1000 * 60 * 120),
  },
  {
    id: "4",
    orderNumber: "ORD-1244",
    customer: "David Park",
    total: 95.25,
    status: "PENDING",
    createdAt: new Date(Date.now() - 1000 * 60 * 180),
  },
  {
    id: "5",
    orderNumber: "ORD-1243",
    customer: "Lisa Anderson",
    total: 110.0,
    status: "COMPLETED",
    createdAt: new Date(Date.now() - 1000 * 60 * 240),
  },
];

const generateRecentCustomers = (): RecentCustomer[] => [
  {
    id: "1",
    name: "Alex Thompson",
    email: "alex.t@email.com",
    createdAt: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    id: "2",
    name: "Jordan Lee",
    email: "jordan.lee@email.com",
    createdAt: new Date(Date.now() - 1000 * 60 * 120),
  },
  {
    id: "3",
    name: "Taylor Martinez",
    email: "taylor.m@email.com",
    createdAt: new Date(Date.now() - 1000 * 60 * 360),
  },
  {
    id: "4",
    name: "Morgan Davis",
    email: "morgan.d@email.com",
    createdAt: new Date(Date.now() - 1000 * 60 * 480),
  },
  {
    id: "5",
    name: "Casey Wilson",
    email: "casey.w@email.com",
    createdAt: new Date(Date.now() - 1000 * 60 * 720),
  },
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
};

const getStatusTone = (status: string): RowPillTone => {
  const map: Record<string, RowPillTone> = {
    COMPLETED: "emerald",
    PROCESSING: "blue",
    PENDING: "amber",
    CANCELLED: "slate",
  };
  return map[status] || "slate";
};

const formatTimeAgo = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export default function TenantAnalyticsPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [salesTrendData, setSalesTrendData] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<RecentCustomer[]>([]);
  const [pendingConsultations] = useState(7);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/auth/login");
    }
    if (isLoaded && isSignedIn && user?.publicMetadata?.role !== "TENANT_ADMIN") {
      router.push("/");
    }
  }, [isLoaded, isSignedIn, user, router]);

  useEffect(() => {
    if (user?.id) {
      fetchAnalytics();
    }
  }, [user, timeRange]);

  useEffect(() => {
    setSalesTrendData(generateSalesTrendData());
    setRecentOrders(generateRecentOrders());
    setRecentCustomers(generateRecentCustomers());
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(
        `/api/tenant-admin/analytics?timeRange=${timeRange}`,
      );
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      } else {
        console.error("API error:", response.status, response.statusText);
        setAnalytics({
          totalProducts: 10,
          totalOrders: 25,
          totalCustomers: 15,
          totalRevenue: 2500.0,
          recentOrders: 8,
          recentCustomers: 5,
          recentRevenue: 850.0,
          avgOrderValue: 100.0,
          revenueByDay: Array.from({ length: 7 }, (_, i) => ({
            date: `Day ${i + 1}`,
            revenue: Math.random() * 500 + 200,
          })),
          ordersByDay: Array.from({ length: 7 }, (_, i) => ({
            date: `Day ${i + 1}`,
            orders: Math.floor(Math.random() * 10) + 1,
          })),
          topProducts: [
            { id: "1", name: "Product 1", quantity: 15, revenue: 450, orders: 8 },
            { id: "2", name: "Product 2", quantity: 12, revenue: 360, orders: 6 },
            { id: "3", name: "Product 3", quantity: 10, revenue: 300, orders: 5 },
          ],
          customerGrowth: Array.from({ length: 7 }, (_, i) => ({
            date: `Day ${i + 1}`,
            customers: Math.floor(Math.random() * 5),
          })),
          ordersByStatus: [
            { name: "COMPLETED", value: 15 },
            { name: "PROCESSING", value: 5 },
            { name: "PENDING", value: 3 },
            { name: "CANCELLED", value: 2 },
          ],
        });
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
      setAnalytics({
        totalProducts: 10,
        totalOrders: 25,
        totalCustomers: 15,
        totalRevenue: 2500.0,
        recentOrders: 8,
        recentCustomers: 5,
        recentRevenue: 850.0,
        avgOrderValue: 100.0,
        revenueByDay: Array.from({ length: 7 }, (_, i) => ({
          date: `Day ${i + 1}`,
          revenue: Math.random() * 500 + 200,
        })),
        ordersByDay: Array.from({ length: 7 }, (_, i) => ({
          date: `Day ${i + 1}`,
          orders: Math.floor(Math.random() * 10) + 1,
        })),
        topProducts: [
          { id: "1", name: "Product 1", quantity: 15, revenue: 450, orders: 8 },
          { id: "2", name: "Product 2", quantity: 12, revenue: 360, orders: 6 },
          { id: "3", name: "Product 3", quantity: 10, revenue: 300, orders: 5 },
        ],
        customerGrowth: Array.from({ length: 7 }, (_, i) => ({
          date: `Day ${i + 1}`,
          customers: Math.floor(Math.random() * 5),
        })),
        ordersByStatus: [
          { name: "COMPLETED", value: 15 },
          { name: "PROCESSING", value: 5 },
          { name: "PENDING", value: 3 },
          { name: "CANCELLED", value: 2 },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  // Chart series hex literals are intentional product output — DO NOT change
  const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-bs-border rounded-full"></div>
            <div className="absolute inset-0 border-4 border-bs-green-soft border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-bs-fg-muted font-medium">
            Loading your garden of insights...
          </p>
        </div>
      </div>
    );
  }

  if (!isSignedIn || !user || !analytics) {
    return null;
  }

  const revenueMetrics = getRevenueMetrics(analytics);

  // Plotly chart configurations — series hex literals PRESERVED per PRD
  const salesTrendTrace = {
    x: salesTrendData.map((d) => d.date),
    y: salesTrendData.map((d) => d.sales),
    type: "scatter" as const,
    mode: "lines" as const,
    line: {
      color: "#10b981",
      width: 3,
      shape: "spline" as const,
    },
    fill: "tozeroy" as const,
    fillcolor: "rgba(16, 185, 129, 0.1)",
    hovertemplate: "<b>%{x}</b><br>€%{y:.2f}<extra></extra>",
  };

  const salesTrendLayout = {
    autosize: true,
    margin: { l: 50, r: 20, t: 20, b: 40 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    xaxis: {
      showgrid: false,
      zeroline: false,
      tickfont: { size: 11, color: "#64748b" },
      tickformat: "%b %d",
    },
    yaxis: {
      showgrid: true,
      gridcolor: "rgba(148, 163, 184, 0.1)",
      zeroline: false,
      tickfont: { size: 11, color: "#64748b" },
      tickprefix: "€",
    },
    hovermode: "x unified" as const,
  };

  const topProductsTrace = {
    x: analytics.topProducts.slice(0, 5).map((p: any) => p.revenue),
    y: analytics.topProducts.slice(0, 5).map((p: any) => p.name),
    type: "bar" as const,
    orientation: "h" as const,
    marker: {
      color: ["#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6"],
      cornerradius: 8,
    },
    hovertemplate: "<b>%{y}</b><br>Revenue: €%{x:.2f}<extra></extra>",
  };

  const topProductsLayout = {
    autosize: true,
    margin: { l: 150, r: 20, t: 20, b: 40 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    xaxis: {
      showgrid: true,
      gridcolor: "rgba(148, 163, 184, 0.1)",
      zeroline: false,
      tickfont: { size: 11, color: "#64748b" },
      tickprefix: "€",
    },
    yaxis: {
      showgrid: false,
      zeroline: false,
      tickfont: { size: 11, color: "#64748b" },
    },
  };

  const orderStatusTrace = {
    labels: analytics.ordersByStatus.map((s: any) => s.name),
    values: analytics.ordersByStatus.map((s: any) => s.value),
    type: "pie" as const,
    hole: 0.5,
    marker: {
      colors: ["#10b981", "#06b6d4", "#f59e0b", "#94a3b8"],
    },
    textinfo: "label+percent" as const,
    textfont: { size: 12, color: "#1e293b" },
    hovertemplate:
      "<b>%{label}</b><br>%{value} orders<br>%{percent}<extra></extra>",
  };

  const orderStatusLayout = {
    autosize: true,
    margin: { l: 20, r: 20, t: 20, b: 20 },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    showlegend: false,
    annotations: [
      {
        font: { size: 24, color: "#10b981", family: "system-ui", weight: 700 },
        showarrow: false,
        text: String(
          analytics.ordersByStatus.reduce((a: any, b: any) => a + b.value, 0),
        ),
        x: 0.5,
        y: 0.55,
      },
      {
        font: { size: 12, color: "#64748b", family: "system-ui" },
        showarrow: false,
        text: "Total Orders",
        x: 0.5,
        y: 0.42,
      },
    ],
  };

  const sectionTitleClass = "text-[22px] font-semibold text-bs-fg flex items-center gap-2";
  const sectionTitleStyle = { fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" } as const;

  return (
    <div className="space-y-8">
      <div className="bs-page-header-compact flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1
            className="bs-page-title"
            style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
          >
            Store Analytics
          </h1>
          <p className="bs-page-subtitle">
            Your garden of insights and performance metrics.
          </p>
        </div>
        <div className="flex gap-2 justify-start sm:justify-end">
          <button
            type="button"
            onClick={() => setTimeRange("7d")}
            className={cn(
              "bs-btn bs-btn-sm",
              timeRange === "7d" ? "bs-btn-green" : "bs-btn-ghost",
            )}
          >
            7 Days
          </button>
          <button
            type="button"
            onClick={() => setTimeRange("30d")}
            className={cn(
              "bs-btn bs-btn-sm",
              timeRange === "30d" ? "bs-btn-green" : "bs-btn-ghost",
            )}
          >
            30 Days
          </button>
          <button
            type="button"
            onClick={() => setTimeRange("90d")}
            className={cn(
              "bs-btn bs-btn-sm",
              timeRange === "90d" ? "bs-btn-green" : "bs-btn-ghost",
            )}
          >
            90 Days
          </button>
        </div>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className={sectionTitleClass} style={sectionTitleStyle}>
            <div className="w-1 h-6 bg-bs-green-soft rounded-full" />
            Key Business Metrics
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mt-6">
            <StatCard
              label="Total Revenue"
              value={`€${analytics.totalRevenue.toFixed(2)}`}
              icon={DollarSign}
              hint={`+€${analytics.recentRevenue.toFixed(2)} this period`}
            />
            <StatCard
              label="Total Orders"
              value={analytics.totalOrders}
              icon={ShoppingCart}
              hint={`+${analytics.recentOrders} this period`}
            />
            <StatCard
              label="Total Customers"
              value={analytics.totalCustomers}
              icon={Users}
              hint={`+${analytics.recentCustomers} this period`}
            />
            <StatCard
              label="Avg Order Value"
              value={`€${analytics.avgOrderValue.toFixed(2)}`}
              icon={Package}
              hint={`${analytics.totalProducts} products`}
            />
          </div>
        </section>

        <section>
          <h2 className={sectionTitleClass} style={sectionTitleStyle}>
            <div className="w-1 h-6 bg-bs-green-soft rounded-full" />
            Revenue Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {revenueMetrics.map((metric) => (
              <div key={metric.label} className="bs-stat">
                <div className="bs-stat-row">
                  <span className="bs-stat-label">{metric.label}</span>
                  <span className="bs-stat-icon">
                    <DollarSign className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
                <div className="bs-stat-value font-mono tabular-nums">
                  {formatCurrency(metric.value)}
                </div>
                <div className="bs-stat-delta flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      metric.change > 0 ? "text-bs-green-soft" : "text-bs-warn",
                    )}
                  >
                    <TrendingUp className="h-3 w-3" aria-hidden="true" />
                    <span className="font-mono tabular-nums">
                      {metric.change > 0 ? "+" : ""}
                      {metric.change}%
                    </span>
                  </span>
                  <span className="text-bs-fg-muted">{metric.period}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className={sectionTitleClass} style={sectionTitleStyle}>
            <div className="w-1 h-6 bg-bs-green-soft rounded-full" />
            Sales Intelligence
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="bs-card bs-card-pad">
              <div className="bs-card-head pb-4">
                <h3
                  className="text-[22px] font-semibold text-bs-fg flex items-center gap-2"
                  style={sectionTitleStyle}
                >
                  <TrendingUp className="h-5 w-5 text-bs-green-soft" />
                  Revenue Trend
                </h3>
                <p className="text-sm text-bs-fg-muted">
                  Daily revenue over the selected period
                </p>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    style={{ fontSize: "12px" }}
                  />
                  <YAxis stroke="#64748b" style={{ fontSize: "12px" }} />
                  <Tooltip
                    formatter={(value: any) => `€${value.toFixed(2)}`}
                    labelFormatter={(label) => `Date: ${label}`}
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ fill: "#10b981", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bs-card bs-card-pad">
              <div className="bs-card-head pb-4">
                <h3
                  className="text-[22px] font-semibold text-bs-fg flex items-center gap-2"
                  style={sectionTitleStyle}
                >
                  <ShoppingCart className="h-5 w-5 text-bs-green-soft" />
                  Order Volume
                </h3>
                <p className="text-sm text-bs-fg-muted">
                  Daily orders over the selected period
                </p>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analytics.ordersByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    style={{ fontSize: "12px" }}
                  />
                  <YAxis stroke="#64748b" style={{ fontSize: "12px" }} />
                  <Tooltip
                    labelFormatter={(label) => `Date: ${label}`}
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar
                    dataKey="orders"
                    fill="#06b6d4"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section>
          <h2 className={sectionTitleClass} style={sectionTitleStyle}>
            <div className="w-1 h-6 bg-bs-green-soft rounded-full" />
            Store Performance
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <div className="lg:col-span-2 bs-card bs-card-pad">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-bs-green-soft" />
                <h3
                  className="text-[22px] font-semibold text-bs-fg"
                  style={sectionTitleStyle}
                >
                  Sales Trend
                </h3>
                <RowPill tone="emerald" className="ml-auto">
                  Last 30 days
                </RowPill>
              </div>
              <div className="h-[280px]">
                <Plot
                  data={[salesTrendTrace]}
                  layout={salesTrendLayout}
                  config={{ displayModeBar: false, responsive: true }}
                  className="w-full h-full"
                  useResizeHandler
                />
              </div>
            </div>

            <div className="bs-card bs-card-pad">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingBag className="h-5 w-5 text-bs-green-soft" />
                <h3
                  className="text-[22px] font-semibold text-bs-fg"
                  style={sectionTitleStyle}
                >
                  Order Distribution
                </h3>
              </div>
              <div className="h-[280px]">
                <Plot
                  data={[orderStatusTrace]}
                  layout={orderStatusLayout}
                  config={{ displayModeBar: false, responsive: true }}
                  className="w-full h-full"
                  useResizeHandler
                />
              </div>
            </div>

            <div className="lg:col-span-3 bs-card bs-card-pad">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-5 w-5 text-bs-green-soft" />
                <h3
                  className="text-[22px] font-semibold text-bs-fg"
                  style={sectionTitleStyle}
                >
                  Top Products by Revenue
                </h3>
                <RowPill tone="blue" className="ml-auto">
                  Best Sellers
                </RowPill>
              </div>
              <div className="h-[320px]">
                <Plot
                  data={[topProductsTrace]}
                  layout={topProductsLayout}
                  config={{ displayModeBar: false, responsive: true }}
                  className="w-full h-full"
                  useResizeHandler
                />
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className={sectionTitleClass} style={sectionTitleStyle}>
            <div className="w-1 h-6 bg-bs-green-soft rounded-full" />
            Customer Insights
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="bs-card bs-card-pad">
              <div className="bs-card-head pb-4">
                <h3
                  className="text-[22px] font-semibold text-bs-fg flex items-center gap-2"
                  style={sectionTitleStyle}
                >
                  <Users className="h-5 w-5 text-bs-green-soft" />
                  Customer Growth
                </h3>
                <p className="text-sm text-bs-fg-muted">
                  New customer registrations over time
                </p>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={analytics.customerGrowth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis
                    dataKey="date"
                    stroke="#64748b"
                    style={{ fontSize: "12px" }}
                  />
                  <YAxis stroke="#64748b" style={{ fontSize: "12px" }} />
                  <Tooltip
                    labelFormatter={(label) => `Date: ${label}`}
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="customers"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    dot={{ fill: "#8b5cf6", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bs-card bs-card-pad">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-bs-green-soft" />
                  <h3
                    className="text-[22px] font-semibold text-bs-fg"
                    style={sectionTitleStyle}
                  >
                    Recent Customers
                  </h3>
                </div>
                <Link
                  href="/tenant-admin/customers"
                  className="bs-btn bs-btn-ghost bs-btn-sm"
                >
                  View All
                </Link>
              </div>

              <div className="space-y-3">
                {recentCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center gap-3 p-3 rounded-bs-md border border-bs-border-100 hover:bg-bs-card-2 transition-all group"
                  >
                    <div className="bs-avatar flex-shrink-0 w-10 h-10 text-sm">
                      {getInitials(customer.name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-bs-fg truncate">
                        {customer.name}
                      </p>
                      <p className="text-sm text-bs-fg-muted truncate font-mono">
                        {customer.email}
                      </p>
                    </div>

                    <span className="text-xs text-bs-fg-muted font-mono flex-shrink-0">
                      {formatTimeAgo(customer.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className={sectionTitleClass} style={sectionTitleStyle}>
            <div className="w-1 h-6 bg-bs-green-soft rounded-full" />
            Recent Activity
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
            <div className="lg:col-span-2 bs-card bs-card-pad">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-bs-green-soft" />
                  <h3
                    className="text-[22px] font-semibold text-bs-fg"
                    style={sectionTitleStyle}
                  >
                    Recent Orders
                  </h3>
                </div>
                <Link
                  href="/tenant-admin/orders"
                  className="bs-btn bs-btn-ghost bs-btn-sm"
                >
                  View All
                </Link>
              </div>

              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 rounded-bs-md border border-bs-border-100 hover:bg-bs-card-2 transition-all group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-bs-fg truncate font-mono">
                        {order.orderNumber}
                      </p>
                      <p className="text-sm text-bs-fg-muted truncate">
                        {order.customer}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 ml-4">
                      <div className="text-right">
                        <p className="font-semibold text-bs-fg font-mono tabular-nums">
                          {formatCurrency(order.total)}
                        </p>
                        <p className="text-xs text-bs-fg-muted font-mono">
                          {formatTimeAgo(order.createdAt)}
                        </p>
                      </div>
                      <RowPill tone={getStatusTone(order.status)}>
                        {order.status}
                      </RowPill>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bs-card bs-card-pad">
              <div className="flex items-center gap-2 mb-6">
                <Calendar className="h-5 w-5 text-bs-warn" />
                <h3
                  className="text-[22px] font-semibold text-bs-fg"
                  style={sectionTitleStyle}
                >
                  Consultations
                </h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bs-card-2 rounded-bs-md border border-bs-border-100">
                  <div>
                    <p className="text-sm text-bs-fg-muted mb-1">
                      Pending Requests
                    </p>
                    <p className="text-3xl font-bold text-bs-warn font-mono tabular-nums">
                      {pendingConsultations}
                    </p>
                  </div>
                  <div className="w-16 h-16 rounded-full bs-card-2 border border-bs-border-100 flex items-center justify-center">
                    <Calendar className="h-8 w-8 text-bs-warn" />
                  </div>
                </div>

                <Link
                  href="/tenant-admin/consultations"
                  className="bs-btn bs-btn-green w-full justify-center"
                >
                  View All Consultations
                  <ArrowUpRight className="ml-2 h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className={sectionTitleClass} style={sectionTitleStyle}>
            <div className="w-1 h-6 bg-bs-green-soft rounded-full" />
            Order Status Breakdown
          </h2>
          <div className="bs-card bs-card-pad mt-6">
            <div className="bs-card-head pb-4">
              <h3
                className="text-[22px] font-semibold text-bs-fg flex items-center gap-2"
                style={sectionTitleStyle}
              >
                <ShoppingBag className="h-5 w-5 text-bs-green-soft" />
                Orders by Status
              </h3>
              <p className="text-sm text-bs-fg-muted">
                Distribution of order statuses in the selected period
              </p>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={analytics.ordersByStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {analytics.ordersByStatus.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section>
          <h2 className={sectionTitleClass} style={sectionTitleStyle}>
            <div className="w-1 h-6 bg-bs-green-soft rounded-full" />
            Top Selling Products
          </h2>
          <div className="bs-card bs-card-pad mt-6">
            <div className="bs-card-head pb-4">
              <h3
                className="text-[22px] font-semibold text-bs-fg flex items-center gap-2"
                style={sectionTitleStyle}
              >
                <Package className="h-5 w-5 text-bs-green-soft" />
                Best Performers
              </h3>
              <p className="text-sm text-bs-fg-muted">
                Products ranked by quantity sold and revenue generated
              </p>
            </div>
            <div className="space-y-4">
              {analytics.topProducts.map((product: any, index: number) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-4 bs-card-2 rounded-bs-md border border-bs-border-100 hover:border-bs-green-soft/40 transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="bs-avatar flex-shrink-0 w-12 h-12 text-lg font-mono">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-lg text-bs-fg">
                        {product.name}
                      </p>
                      <p className="text-sm text-bs-fg-muted font-mono">
                        {product.orders} orders • {product.quantity} units sold
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-bs-green-soft font-mono tabular-nums">
                      €{product.revenue.toFixed(2)}
                    </p>
                    <RowPill tone="emerald" className="mt-1">
                      Revenue
                    </RowPill>
                  </div>
                </div>
              ))}
              {analytics.topProducts.length === 0 && (
                <div className="text-center py-12">
                  <Package className="h-16 w-16 text-bs-fg-muted mx-auto mb-4" />
                  <p className="text-bs-fg text-lg">No product sales yet</p>
                  <p className="text-bs-fg-muted text-sm mt-2">
                    Start adding products to see analytics
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
