import type { RowPillTone } from "@/components/admin/shared/RowPill";

export interface AnalyticsData {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
  paidRevenue?: number;
  recentOrders: number;
  recentCustomers: number;
  recentRevenue: number;
  avgOrderValue: number;
  revenueMetrics: RevenueMetric[];
  revenueByDay: any[];
  ordersByDay: any[];
  topProducts: any[];
  customerGrowth: any[];
  ordersByStatus: any[];
  verificationMode?: "KYC" | "ID_UPLOAD";
  recentOrdersList?: RecentOrder[];
  recentCustomersList?: RecentCustomer[];
  pendingConsultations?: number;
  retention?: RetentionSummary;
  // Entitlement keys granted to this tenant (lib/entitlements/features).
  features?: string[];
}

export interface RetentionSummary {
  repeatRate: number | null;
  medianReorderDays: number | null;
  overdueCustomers: number;
  overdueCutoffDays: number;
  newVsReturning: {
    newRevenue: number;
    returningRevenue: number;
    newOrders: number;
    returningOrders: number;
    returningShare: number | null;
  };
}

export interface RevenueMetric {
  label: string;
  value: number;
  // Null when there is no prior-period baseline — rendered as "—", never 0%.
  change: number | null;
  period: string;
}

// Blank-slate metrics for brand-new tenants and the API-error fallback.
export const EMPTY_REVENUE_METRICS: RevenueMetric[] = [
  { label: "Today's Revenue", value: 0, change: null, period: "vs yesterday" },
  { label: "This Week", value: 0, change: null, period: "vs prior 7 days" },
  { label: "This Month", value: 0, change: null, period: "vs prior 30 days" },
];

export interface RecentOrder {
  id: string;
  orderNumber: string;
  customer: string;
  total: number;
  // OrderStatus enum value; kept as string so new statuses can't break the UI
  status: string;
  // ISO string over the wire; Date only in code that constructs rows locally
  createdAt: Date | string;
}

export interface RecentCustomer {
  id: string;
  name: string;
  email: string;
  createdAt: Date | string;
}

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
};

export const getStatusTone = (status: string): RowPillTone => {
  const map: Record<string, RowPillTone> = {
    COMPLETED: "emerald",
    DELIVERED: "emerald",
    SHIPPED: "blue",
    CONFIRMED: "blue",
    PROCESSING: "blue",
    PENDING: "amber",
    PENDING_SYNC: "amber",
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
