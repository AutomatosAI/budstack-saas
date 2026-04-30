"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  TrendingUp,
  Package,
  Users,
  Calendar,
  ShoppingBag,
  DollarSign,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Plot = dynamic(() => import("react-plotly.js") as any, {
  ssr: false,
}) as any;

interface StoreAnalyticsProps {
  className?: string;
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

interface TopProduct {
  name: string;
  sales: number;
  revenue: number;
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

const generateTopProducts = (): TopProduct[] => [
  { name: "Blue Dream - 3.5g", sales: 145, revenue: 2175 },
  { name: "Sour Diesel - 7g", sales: 98, revenue: 1960 },
  { name: "Girl Scout Cookies", sales: 87, revenue: 1305 },
  { name: "OG Kush - Premium", sales: 76, revenue: 1520 },
  { name: "Gelato - Hybrid", sales: 65, revenue: 975 },
];

const generateOrderStatusData = () => ({
  COMPLETED: 156,
  PROCESSING: 23,
  PENDING: 12,
  CANCELLED: 8,
});

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

const getRevenueMetrics = (): RevenueMetric[] => [
  {
    label: "Today's Revenue",
    value: 1247.5,
    change: 12.5,
    period: "vs yesterday",
  },
  { label: "This Week", value: 8935.25, change: 8.3, period: "vs last week" },
  {
    label: "This Month",
    value: 34521.75,
    change: 15.7,
    period: "vs last month",
  },
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
};

const getStatusChipClass = (status: string) => {
  const map: Record<string, string> = {
    COMPLETED: "bs-chip bs-chip-green",
    PROCESSING: "bs-chip bs-chip-info",
    PENDING: "bs-chip bs-chip-warn",
    CANCELLED: "bs-chip bs-chip-muted",
  };
  return map[status] || "bs-chip bs-chip-muted";
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

const MetricCardSkeleton = () => (
  <div className="bs-card bs-card-pad">
    <div className="space-y-3">
      <div className="h-4 w-24 bg-bs-card-2 rounded animate-pulse" />
      <div className="h-8 w-32 bg-bs-card-2 rounded animate-pulse" />
      <div className="h-3 w-20 bg-bs-card-2 rounded animate-pulse" />
    </div>
  </div>
);

const ChartCardSkeleton = () => (
  <div className="bs-card bs-card-pad">
    <div className="h-6 w-32 bg-bs-card-2 rounded animate-pulse mb-6" />
    <div className="h-64 bg-bs-card-2 rounded-lg animate-pulse" />
  </div>
);

export default function StoreAnalytics({ className }: StoreAnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetric[]>([]);
  const [salesTrendData, setSalesTrendData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [orderStatusData, setOrderStatusData] = useState<any>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<RecentCustomer[]>([]);
  const [pendingConsultations] = useState(7);

  useEffect(() => {
    const timer = setTimeout(() => {
      setRevenueMetrics(getRevenueMetrics());
      setSalesTrendData(generateSalesTrendData());
      setTopProducts(generateTopProducts());
      setOrderStatusData(generateOrderStatusData());
      setRecentOrders(generateRecentOrders());
      setRecentCustomers(generateRecentCustomers());
      setLoading(false);
    }, 800);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCardSkeleton />
          <ChartCardSkeleton />
        </div>
      </div>
    );
  }

  // Sales Trend Chart Configuration — chart series colours PRESERVED
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
    hovertemplate: "<b>%{x}</b><br>$%{y:.2f}<extra></extra>",
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
      tickprefix: "$",
    },
    hovermode: "x unified" as const,
  };

  // Top Products Chart Configuration — chart series colours PRESERVED
  const topProductsTrace = {
    x: topProducts.map((p) => p.revenue),
    y: topProducts.map((p) => p.name),
    type: "bar" as const,
    orientation: "h" as const,
    marker: {
      color: topProducts.map((_, i) => {
        const colors = ["#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6"];
        return colors[i];
      }),
      cornerradius: 8,
    },
    hovertemplate: "<b>%{y}</b><br>Revenue: $%{x:.2f}<extra></extra>",
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
      tickprefix: "$",
    },
    yaxis: {
      showgrid: false,
      zeroline: false,
      tickfont: { size: 11, color: "#64748b" },
    },
  };

  // Order Status Distribution Chart Configuration — chart series colours PRESERVED
  const orderStatusTrace = {
    labels: Object.keys(orderStatusData),
    values: Object.values(orderStatusData) as number[],
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
        font: {
          size: 24,
          color: "#10b981",
          family: "Inter, sans-serif",
          weight: 700,
        },
        showarrow: false,
        text: orderStatusData
          ? String(
              (Object.values(orderStatusData) as number[]).reduce(
                (a: number, b: number) => a + b,
                0,
              ),
            )
          : "0",
        x: 0.5,
        y: 0.55,
      },
      {
        font: { size: 12, color: "#64748b", family: "Inter, sans-serif" },
        showarrow: false,
        text: "Total Orders",
        x: 0.5,
        y: 0.42,
      },
    ],
  };

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center gap-3 mb-2">
        <div className="bs-eyebrow">Store Analytics</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {revenueMetrics.map((metric) => (
          <div key={metric.label} className="bs-stat">
            <div className="bs-stat-row">
              <span className="bs-stat-label">{metric.label}</span>
              <span className="bs-stat-icon">
                <DollarSign className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <div className="bs-stat-value">{formatCurrency(metric.value)}</div>
            <div
              className={cn(
                "bs-stat-delta",
                metric.change > 0 ? "text-bs-green-soft" : "text-bs-danger",
              )}
            >
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
              <span className="font-mono tabular-nums">
                {metric.change > 0 ? "+" : ""}
                {metric.change}%
              </span>
              <span className="text-bs-fg-muted ml-1">{metric.period}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bs-card bs-card-pad">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5 text-bs-green-soft" aria-hidden="true" />
            <h3 className="font-display text-[22px] text-bs-fg" style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}>
              Sales Trend
            </h3>
            <span className="bs-chip bs-chip-muted ml-auto">Last 30 days</span>
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
            <Package className="h-5 w-5 text-bs-fg-muted" aria-hidden="true" />
            <h3 className="font-display text-[22px] text-bs-fg" style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}>
              Top Products
            </h3>
            <span className="bs-chip bs-chip-muted ml-auto">By Revenue</span>
          </div>
          <div className="h-[280px]">
            <Plot
              data={[topProductsTrace]}
              layout={topProductsLayout}
              config={{ displayModeBar: false, responsive: true }}
              className="w-full h-full"
              useResizeHandler
            />
          </div>
        </div>

        <div className="bs-card bs-card-pad">
          <div className="flex items-center gap-2 mb-4">
            <ShoppingBag className="h-5 w-5 text-bs-green-soft" aria-hidden="true" />
            <h3 className="font-display text-[22px] text-bs-fg" style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}>
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

        <div className="bs-card bs-card-pad">
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="h-5 w-5 text-bs-gold" aria-hidden="true" />
            <h3 className="font-display text-[22px] text-bs-fg" style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}>
              Consultations
            </h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-bs-card-2 rounded-lg border border-bs-border-100">
              <div>
                <p className="text-sm text-bs-fg-muted mb-1">Pending Requests</p>
                <p className="font-display text-[36px] text-bs-gold" style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}>
                  {pendingConsultations}
                </p>
              </div>
              <div className="w-14 h-14 rounded-full bg-bs-card border border-bs-border-100 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-bs-gold" aria-hidden="true" />
              </div>
            </div>

            <Link href="/tenant-admin/consultations" className="bs-btn bs-btn-green w-full justify-center">
              <span>View All Consultations</span>
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bs-card bs-card-pad">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-bs-fg-muted" aria-hidden="true" />
              <h3 className="font-display text-[22px] text-bs-fg" style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}>
                Recent Orders
              </h3>
            </div>
            <Link href="/tenant-admin/orders" className="bs-btn bs-btn-ghost bs-btn-sm">
              View All
            </Link>
          </div>

          <div className="space-y-2">
            {recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-3 rounded-lg border border-bs-border-100 bg-bs-card-2 hover:border-bs-border transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-mono tabular-nums text-bs-fg truncate">
                    {order.orderNumber}
                  </p>
                  <p className="text-sm text-bs-fg-muted truncate">
                    {order.customer}
                  </p>
                </div>

                <div className="flex items-center gap-3 ml-4">
                  <div className="text-right">
                    <p className="font-mono tabular-nums font-semibold text-bs-fg">
                      {formatCurrency(order.total)}
                    </p>
                    <p className="font-mono tabular-nums text-xs text-bs-fg-muted">
                      {formatTimeAgo(order.createdAt)}
                    </p>
                  </div>
                  <span className={getStatusChipClass(order.status)}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bs-card bs-card-pad">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-bs-fg-muted" aria-hidden="true" />
              <h3 className="font-display text-[22px] text-bs-fg" style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}>
                Recent Customers
              </h3>
            </div>
            <Link href="/tenant-admin/customers" className="bs-btn bs-btn-ghost bs-btn-sm">
              View All
            </Link>
          </div>

          <div className="space-y-2">
            {recentCustomers.map((customer) => (
              <div
                key={customer.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-bs-border-100 bg-bs-card-2 hover:border-bs-border transition-colors"
              >
                <div className="bs-avatar w-10 h-10 flex-shrink-0">
                  {getInitials(customer.name)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-bs-fg truncate">
                    {customer.name}
                  </p>
                  <p className="text-sm text-bs-fg-muted truncate">
                    {customer.email}
                  </p>
                </div>

                <span className="font-mono tabular-nums text-xs text-bs-fg-muted flex-shrink-0">
                  {formatTimeAgo(customer.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
