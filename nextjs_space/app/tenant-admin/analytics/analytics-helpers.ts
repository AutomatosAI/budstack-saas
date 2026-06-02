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
  createdAt: Date;
}

export interface RecentCustomer {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export const generateSalesTrendData = () => {
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

export const generateRecentOrders = (): RecentOrder[] => [
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

export const generateRecentCustomers = (): RecentCustomer[] => [
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

export const formatTimeAgo = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

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
