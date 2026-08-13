import type { RowPillTone } from "@/components/admin/shared/RowPill";

export interface AnalyticsData {
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
  verificationMode?: "KYC" | "ID_UPLOAD";
  recentOrdersList?: RecentOrder[];
  recentCustomersList?: RecentCustomer[];
  pendingConsultations?: number;
}

export interface RevenueMetric {
  label: string;
  value: number;
  change: number;
  period: string;
}

export interface RecentOrder {
  id: string;
  orderNumber: string;
  customer: string;
  total: number;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELLED";
  // ISO string over the wire; Date only in code that constructs rows locally
  createdAt: Date | string;
}

export interface RecentCustomer {
  id: string;
  name: string;
  email: string;
  createdAt: Date | string;
}

export const getRevenueMetrics = (
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

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
};

export const getStatusTone = (status: string): RowPillTone => {
  const map: Record<string, RowPillTone> = {
    COMPLETED: "emerald",
    PROCESSING: "blue",
    PENDING: "amber",
    CANCELLED: "slate",
  };
  return map[status] || "slate";
};

export const formatTimeAgo = (date: Date | string) => {
  const timestamp = new Date(date).getTime();
  if (Number.isNaN(timestamp)) return "—";
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

export const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};
