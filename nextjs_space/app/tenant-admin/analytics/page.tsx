"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
import {
  AdminPageHeader,
  AdminStatGrid,
  StatCard,
  RowPill,
} from "@/components/admin/shared";

interface AnalyticsData {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
  recentOrders: number;
  recentCustomers: number;
  recentRevenue: number;
  avgOrderValue: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  revenueByDay: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ordersByDay: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  topProducts: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  customerGrowth: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ordersByStatus: any[];
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);

const STATUS_TONE: Record<string, "emerald" | "amber" | "blue" | "slate"> = {
  COMPLETED: "emerald",
  PROCESSING: "blue",
  PENDING: "amber",
  CANCELLED: "slate",
};

const CHART_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#94a3b8", "#8b5cf6"];

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-floating-static p-6">
      <div className="mb-4">
        <h3 className="font-display text-lg font-semibold text-foreground">
          {title}
        </h3>
        {subtitle ? (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export default function TenantAnalyticsPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/auth/login");
    }
    if (
      isLoaded &&
      isSignedIn &&
      user?.publicMetadata?.role !== "TENANT_ADMIN"
    ) {
      router.push("/");
    }
  }, [isLoaded, isSignedIn, user, router]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch(
          `/api/tenant-admin/analytics?timeRange=${timeRange}`,
        );
        if (response.ok) {
          const data = await response.json();
          setAnalytics(data);
        }
      } catch (error) {
        console.error("Error fetching analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      fetchAnalytics();
    }
  }, [user, timeRange]);

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <div className="relative mx-auto mb-4 h-12 w-12">
            <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20" />
            <div className="absolute inset-0 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          </div>
          <p className="text-sm text-muted-foreground">Loading analytics…</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn || !user || !analytics) {
    return null;
  }

  const totalOrdersByStatus = analytics.ordersByStatus.reduce(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (acc: number, s: any) => acc + (s.value || 0),
    0,
  );

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Analytics"
        eyebrowIcon={TrendingUp}
        title="Store Analytics"
        subtitle="Performance metrics across your store."
        actions={
          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.02] p-1">
            {(["7d", "30d", "90d"] as const).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? "default" : "ghost"}
                size="sm"
                onClick={() => setTimeRange(range)}
                className={cn(
                  "rounded-full",
                  timeRange === range
                    ? "bg-emerald-500 text-white hover:bg-emerald-600"
                    : "text-slate-300 hover:bg-white/5 hover:text-white",
                )}
              >
                {range === "7d"
                  ? "7 Days"
                  : range === "30d"
                    ? "30 Days"
                    : "90 Days"}
              </Button>
            ))}
          </div>
        }
      />

      <AdminStatGrid columns={4}>
        <StatCard
          label="Total Revenue"
          value={formatCurrency(analytics.totalRevenue)}
          icon={DollarSign}
          hint={`+${formatCurrency(analytics.recentRevenue)} this period`}
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
          value={formatCurrency(analytics.avgOrderValue)}
          icon={Package}
          hint={`${analytics.totalProducts} products`}
        />
      </AdminStatGrid>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Revenue Trend" subtitle="Daily revenue over the selected period">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={analytics.revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                stroke="#8A938F"
                style={{ fontSize: "12px" }}
              />
              <YAxis stroke="#8A938F" style={{ fontSize: "12px" }} />
              <Tooltip
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => `€${Number(value).toFixed(2)}`}
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{
                  backgroundColor: "#151A1C",
                  border: "1px solid #222A2C",
                  borderRadius: "8px",
                  color: "#F2F4F2",
                }}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: "#10b981", r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Order Volume" subtitle="Daily orders over the selected period">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={analytics.ordersByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                stroke="#8A938F"
                style={{ fontSize: "12px" }}
              />
              <YAxis stroke="#8A938F" style={{ fontSize: "12px" }} />
              <Tooltip
                labelFormatter={(label) => `Date: ${label}`}
                contentStyle={{
                  backgroundColor: "#151A1C",
                  border: "1px solid #222A2C",
                  borderRadius: "8px",
                  color: "#F2F4F2",
                }}
              />
              <Bar dataKey="orders" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChartCard title="Top Products" subtitle="Best performers by revenue">
            <div className="space-y-3">
              {analytics.topProducts.length === 0 ? (
                <div className="py-12 text-center">
                  <Package className="mx-auto mb-3 h-12 w-12 text-slate-500" />
                  <p className="text-muted-foreground">No product sales yet</p>
                </div>
              ) : (
                analytics.topProducts
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  .map((product: any, index: number) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-bold text-emerald-300">
                          {index + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">
                            {product.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {product.orders} orders • {product.quantity} units
                          </p>
                        </div>
                      </div>
                      <p className="font-semibold text-foreground">
                        {formatCurrency(product.revenue)}
                      </p>
                    </div>
                  ))
              )}
            </div>
          </ChartCard>
        </div>

        <ChartCard title="Order Status" subtitle="Distribution this period">
          <div className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={analytics.ordersByStatus}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  innerRadius={50}
                  dataKey="value"
                >
                  {analytics.ordersByStatus.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#151A1C",
                    border: "1px solid #222A2C",
                    borderRadius: "8px",
                    color: "#F2F4F2",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 text-center">
              <div className="font-display text-2xl font-bold text-foreground">
                {totalOrdersByStatus}
              </div>
              <div className="text-xs text-muted-foreground">Total Orders</div>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {analytics.ordersByStatus.map((s: any) => (
                <RowPill
                  key={s.name}
                  tone={STATUS_TONE[s.name] || "slate"}
                >
                  {s.name} · {s.value}
                </RowPill>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Customer Growth" subtitle="New customer registrations">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={analytics.customerGrowth}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="date"
              stroke="#8A938F"
              style={{ fontSize: "12px" }}
            />
            <YAxis stroke="#8A938F" style={{ fontSize: "12px" }} />
            <Tooltip
              labelFormatter={(label) => `Date: ${label}`}
              contentStyle={{
                backgroundColor: "#151A1C",
                border: "1px solid #222A2C",
                borderRadius: "8px",
                color: "#F2F4F2",
              }}
            />
            <Line
              type="monotone"
              dataKey="customers"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ fill: "#8b5cf6", r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
