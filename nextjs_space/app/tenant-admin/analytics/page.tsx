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
  ShoppingBag,
} from "lucide-react";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/admin/shared/StatCard";
import { RowPill } from "@/components/admin/shared/RowPill";
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

import {
  getRevenueMetrics,
  formatCurrency,
  getStatusTone,
  formatTimeAgo,
  getInitials,
  type AnalyticsData,
  type RecentOrder,
  type RecentCustomer,
} from "./analytics-helpers";
import { buildChartConfigs } from "./analytics-charts";
import { AnalyticsLoadingSkeleton } from "./AnalyticsLoadingSkeleton";

// Dynamic import for Plotly to avoid SSR issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Plot = dynamic(() => import("react-plotly.js") as any, {
  ssr: false,
}) as any;

// Blank-slate analytics used on API error and for brand-new tenants — no mock.
const EMPTY_ANALYTICS: AnalyticsData = {
  totalProducts: 0,
  totalOrders: 0,
  totalCustomers: 0,
  totalRevenue: 0,
  recentOrders: 0,
  recentCustomers: 0,
  recentRevenue: 0,
  avgOrderValue: 0,
  revenueByDay: [],
  ordersByDay: [],
  topProducts: [],
  customerGrowth: [],
  ordersByStatus: [],
  recentOrdersList: [],
  recentCustomersList: [],
  pendingConsultations: 0,
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
  const [pendingConsultations, setPendingConsultations] = useState(0);

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

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(
        `/api/tenant-admin/analytics?timeRange=${timeRange}`,
      );
      if (response.ok) {
        const data = (await response.json()) as AnalyticsData;
        setAnalytics(data);
        setRecentOrders((data.recentOrdersList ?? []) as RecentOrder[]);
        setRecentCustomers((data.recentCustomersList ?? []) as RecentCustomer[]);
        setSalesTrendData(
          (data.revenueByDay ?? []).map(
            (d: { date: string; revenue: number }) => ({
              date: d.date,
              sales: d.revenue,
            }),
          ),
        );
        setPendingConsultations(data.pendingConsultations ?? 0);
      } else {
        console.error("API error:", response.status, response.statusText);
        // Blank slate on error — never fabricate data.
        setAnalytics(EMPTY_ANALYTICS);
        setRecentOrders([]);
        setRecentCustomers([]);
        setSalesTrendData([]);
        setPendingConsultations(0);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
      // Blank slate on error — never fabricate data.
      setAnalytics(EMPTY_ANALYTICS);
      setRecentOrders([]);
      setRecentCustomers([]);
      setSalesTrendData([]);
      setPendingConsultations(0);
    } finally {
      setLoading(false);
    }
  };

  // Chart series hex literals are intentional product output — DO NOT change
  const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6"];

  if (!isLoaded || loading) {
    return <AnalyticsLoadingSkeleton />;
  }

  if (!isSignedIn || !user || !analytics) {
    return null;
  }

  const revenueMetrics = getRevenueMetrics(analytics);

  const {
    salesTrendTrace,
    salesTrendLayout,
    topProductsTrace,
    topProductsLayout,
    orderStatusTrace,
    orderStatusLayout,
  } = buildChartConfigs(analytics, salesTrendData);

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

            {/* Consultations card is hidden for ID-upload tenants (they skip
                consultations). The former "View All Consultations" link pointed
                to a non-existent /tenant-admin/consultations route (404) and was
                removed. */}
            {analytics.verificationMode !== "ID_UPLOAD" && (
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
                </div>
              </div>
            )}
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
