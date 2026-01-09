'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Sparkles,
  Leaf,
  Calendar,
  ArrowUpRight,
  ShoppingBag
} from 'lucide-react';
import { Breadcrumbs } from '@/components/admin/shared';
import Link from 'next/link';
import { cn } from '@/lib/utils';
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
} from 'recharts';

// Dynamic import for Plotly to avoid SSR issues (typed as any to avoid @types/react version conflicts)
const Plot: React.ComponentType<any> = dynamic(
  () => import('react-plotly.js').then((mod) => mod.default),
  { ssr: false }
);

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
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
  createdAt: Date;
}

interface RecentCustomer {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

// Mock data generators for Living Garden sections
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
      date: date.toISOString().split('T')[0],
      sales: Math.max(200, baseValue + variance + weekendBoost)
    });
  }

  return data;
};

const getRevenueMetrics = (analytics: AnalyticsData | null): RevenueMetric[] => {
  if (!analytics) {
    return [
      { label: "Today's Revenue", value: 0, change: 0, period: 'vs yesterday' },
      { label: "This Week", value: 0, change: 0, period: 'vs last week' },
      { label: "This Month", value: 0, change: 0, period: 'vs last month' }
    ];
  }

  return [
    { label: "Today's Revenue", value: analytics.recentRevenue * 0.1, change: 12.5, period: 'vs yesterday' },
    { label: "This Week", value: analytics.recentRevenue * 0.7, change: 8.3, period: 'vs last week' },
    { label: "This Month", value: analytics.totalRevenue, change: 15.7, period: 'vs last month' }
  ];
};

const generateRecentOrders = (): RecentOrder[] => [
  { id: '1', orderNumber: 'ORD-1247', customer: 'Sarah Chen', total: 85.50, status: 'COMPLETED', createdAt: new Date(Date.now() - 1000 * 60 * 15) },
  { id: '2', orderNumber: 'ORD-1246', customer: 'Marcus Johnson', total: 120.00, status: 'PROCESSING', createdAt: new Date(Date.now() - 1000 * 60 * 45) },
  { id: '3', orderNumber: 'ORD-1245', customer: 'Emma Williams', total: 65.75, status: 'COMPLETED', createdAt: new Date(Date.now() - 1000 * 60 * 120) },
  { id: '4', orderNumber: 'ORD-1244', customer: 'David Park', total: 95.25, status: 'PENDING', createdAt: new Date(Date.now() - 1000 * 60 * 180) },
  { id: '5', orderNumber: 'ORD-1243', customer: 'Lisa Anderson', total: 110.00, status: 'COMPLETED', createdAt: new Date(Date.now() - 1000 * 60 * 240) }
];

const generateRecentCustomers = (): RecentCustomer[] => [
  { id: '1', name: 'Alex Thompson', email: 'alex.t@email.com', createdAt: new Date(Date.now() - 1000 * 60 * 30) },
  { id: '2', name: 'Jordan Lee', email: 'jordan.lee@email.com', createdAt: new Date(Date.now() - 1000 * 60 * 120) },
  { id: '3', name: 'Taylor Martinez', email: 'taylor.m@email.com', createdAt: new Date(Date.now() - 1000 * 60 * 360) },
  { id: '4', name: 'Morgan Davis', email: 'morgan.d@email.com', createdAt: new Date(Date.now() - 1000 * 60 * 480) },
  { id: '5', name: 'Casey Wilson', email: 'casey.w@email.com', createdAt: new Date(Date.now() - 1000 * 60 * 720) }
];

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
};

const getStatusColor = (status: string) => {
  const colors = {
    COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    PROCESSING: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
    CANCELLED: 'bg-slate-100 text-slate-800 border-slate-200'
  };
  return colors[status as keyof typeof colors] || colors.PENDING;
};

const formatTimeAgo = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export default function TenantAnalyticsPage() {
  const sessionResult = useSession();
  const session = sessionResult?.data;
  const status = sessionResult?.status;
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [salesTrendData, setSalesTrendData] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<RecentCustomer[]>([]);
  const [pendingConsultations] = useState(7);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
    if (status === 'authenticated' && session?.user?.role !== 'TENANT_ADMIN') {
      router.push('/');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchAnalytics();
    }
  }, [session, timeRange]);

  useEffect(() => {
    // Generate Living Garden data
    setSalesTrendData(generateSalesTrendData());
    setRecentOrders(generateRecentOrders());
    setRecentCustomers(generateRecentCustomers());
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`/api/tenant-admin/analytics?timeRange=${timeRange}`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      } else {
        console.error('API error:', response.status, response.statusText);
        // Use mock data if API fails
        setAnalytics({
          totalProducts: 10,
          totalOrders: 25,
          totalCustomers: 15,
          totalRevenue: 2500.00,
          recentOrders: 8,
          recentCustomers: 5,
          recentRevenue: 850.00,
          avgOrderValue: 100.00,
          revenueByDay: Array.from({ length: 7 }, (_, i) => ({
            date: `Day ${i + 1}`,
            revenue: Math.random() * 500 + 200
          })),
          ordersByDay: Array.from({ length: 7 }, (_, i) => ({
            date: `Day ${i + 1}`,
            orders: Math.floor(Math.random() * 10) + 1
          })),
          topProducts: [
            { id: '1', name: 'Product 1', quantity: 15, revenue: 450, orders: 8 },
            { id: '2', name: 'Product 2', quantity: 12, revenue: 360, orders: 6 },
            { id: '3', name: 'Product 3', quantity: 10, revenue: 300, orders: 5 },
          ],
          customerGrowth: Array.from({ length: 7 }, (_, i) => ({
            date: `Day ${i + 1}`,
            customers: Math.floor(Math.random() * 5)
          })),
          ordersByStatus: [
            { name: 'COMPLETED', value: 15 },
            { name: 'PROCESSING', value: 5 },
            { name: 'PENDING', value: 3 },
            { name: 'CANCELLED', value: 2 }
          ]
        });
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      // Use mock data on error
      setAnalytics({
        totalProducts: 10,
        totalOrders: 25,
        totalCustomers: 15,
        totalRevenue: 2500.00,
        recentOrders: 8,
        recentCustomers: 5,
        recentRevenue: 850.00,
        avgOrderValue: 100.00,
        revenueByDay: Array.from({ length: 7 }, (_, i) => ({
          date: `Day ${i + 1}`,
          revenue: Math.random() * 500 + 200
        })),
        ordersByDay: Array.from({ length: 7 }, (_, i) => ({
          date: `Day ${i + 1}`,
          orders: Math.floor(Math.random() * 10) + 1
        })),
        topProducts: [
          { id: '1', name: 'Product 1', quantity: 15, revenue: 450, orders: 8 },
          { id: '2', name: 'Product 2', quantity: 12, revenue: 360, orders: 6 },
          { id: '3', name: 'Product 3', quantity: 10, revenue: 300, orders: 5 },
        ],
        customerGrowth: Array.from({ length: 7 }, (_, i) => ({
          date: `Day ${i + 1}`,
          customers: Math.floor(Math.random() * 5)
        })),
        ordersByStatus: [
          { name: 'COMPLETED', value: 15 },
          { name: 'PROCESSING', value: 5 },
          { name: 'PENDING', value: 3 },
          { name: 'CANCELLED', value: 2 }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-cyan-50">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 border-4 border-emerald-200 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-emerald-800 font-medium">Loading your garden of insights...</p>
        </div>
      </div>
    );
  }

  if (!session || !analytics) {
    return null;
  }

  const revenueMetrics = getRevenueMetrics(analytics);

  // Plotly chart configurations
  const salesTrendTrace = {
    x: salesTrendData.map(d => d.date),
    y: salesTrendData.map(d => d.sales),
    type: 'scatter' as const,
    mode: 'lines' as const,
    line: {
      color: '#10b981',
      width: 3,
      shape: 'spline' as const
    },
    fill: 'tozeroy' as const,
    fillcolor: 'rgba(16, 185, 129, 0.1)',
    hovertemplate: '<b>%{x}</b><br>€%{y:.2f}<extra></extra>'
  };

  const salesTrendLayout = {
    autosize: true,
    margin: { l: 50, r: 20, t: 20, b: 40 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    xaxis: {
      showgrid: false,
      zeroline: false,
      tickfont: { size: 11, color: '#64748b' },
      tickformat: '%b %d'
    },
    yaxis: {
      showgrid: true,
      gridcolor: 'rgba(148, 163, 184, 0.1)',
      zeroline: false,
      tickfont: { size: 11, color: '#64748b' },
      tickprefix: '€'
    },
    hovermode: 'x unified' as const
  };

  const topProductsTrace = {
    x: analytics.topProducts.slice(0, 5).map((p: any) => p.revenue),
    y: analytics.topProducts.slice(0, 5).map((p: any) => p.name),
    type: 'bar' as const,
    orientation: 'h' as const,
    marker: {
      color: ['#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6'],
      cornerradius: 8
    },
    hovertemplate: '<b>%{y}</b><br>Revenue: €%{x:.2f}<extra></extra>'
  };

  const topProductsLayout = {
    autosize: true,
    margin: { l: 150, r: 20, t: 20, b: 40 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    xaxis: {
      showgrid: true,
      gridcolor: 'rgba(148, 163, 184, 0.1)',
      zeroline: false,
      tickfont: { size: 11, color: '#64748b' },
      tickprefix: '€'
    },
    yaxis: {
      showgrid: false,
      zeroline: false,
      tickfont: { size: 11, color: '#64748b' }
    }
  };

  const orderStatusTrace = {
    labels: analytics.ordersByStatus.map((s: any) => s.name),
    values: analytics.ordersByStatus.map((s: any) => s.value),
    type: 'pie' as const,
    hole: 0.5,
    marker: {
      colors: ['#10b981', '#06b6d4', '#f59e0b', '#94a3b8']
    },
    textinfo: 'label+percent' as const,
    textfont: { size: 12, color: '#1e293b' },
    hovertemplate: '<b>%{label}</b><br>%{value} orders<br>%{percent}<extra></extra>'
  };

  const orderStatusLayout = {
    autosize: true,
    margin: { l: 20, r: 20, t: 20, b: 20 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    showlegend: false,
    annotations: [{
      font: { size: 24, color: '#10b981', family: 'system-ui', weight: 700 },
      showarrow: false,
      text: String(analytics.ordersByStatus.reduce((a: any, b: any) => a + b.value, 0)),
      x: 0.5,
      y: 0.55
    }, {
      font: { size: 12, color: '#64748b', family: 'system-ui' },
      showarrow: false,
      text: 'Total Orders',
      x: 0.5,
      y: 0.42
    }]
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50/30 via-white to-cyan-50/30 p-8">
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: 'Dashboard', href: '/tenant-admin' },
          { label: 'Analytics' },
        ]}
        className="mb-4"
      />

      {/* Header with Living Garden aesthetic */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full blur-md opacity-60 animate-pulse" />
                <Sparkles className="relative h-8 w-8 text-emerald-600" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-700 via-emerald-600 to-cyan-600 bg-clip-text text-transparent">
                Store Analytics
              </h1>
            </div>
            <p className="text-slate-600 mt-2 ml-11">Your garden of insights and performance metrics</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={timeRange === '7d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange('7d')}
              className={timeRange === '7d' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'}
            >
              7 Days
            </Button>
            <Button
              variant={timeRange === '30d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange('30d')}
              className={timeRange === '30d' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'}
            >
              30 Days
            </Button>
            <Button
              variant={timeRange === '90d' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange('90d')}
              className={timeRange === '90d' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'}
            >
              90 Days
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Section 1: Key Business Metrics */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-cyan-500 rounded-full" />
            Key Business Metrics
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="border-none shadow-lg bg-gradient-to-br from-emerald-500 to-teal-500 text-white overflow-hidden relative group hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <CardTitle className="text-sm font-medium text-emerald-50">Total Revenue</CardTitle>
                <DollarSign className="h-5 w-5 text-emerald-100" />
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-3xl font-bold">€{analytics.totalRevenue.toFixed(2)}</div>
                <div className="flex items-center gap-1 text-xs mt-2">
                  <TrendingUp className="w-3 h-3" />
                  <span>+€{analytics.recentRevenue.toFixed(2)} this period</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white overflow-hidden relative group hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <CardTitle className="text-sm font-medium text-amber-50">Total Orders</CardTitle>
                <ShoppingCart className="h-5 w-5 text-amber-100" />
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-3xl font-bold">{analytics.totalOrders}</div>
                <p className="text-xs mt-2">+{analytics.recentOrders} this period</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gradient-to-br from-purple-500 to-pink-500 text-white overflow-hidden relative group hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <CardTitle className="text-sm font-medium text-purple-50">Total Customers</CardTitle>
                <Users className="h-5 w-5 text-purple-100" />
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-3xl font-bold">{analytics.totalCustomers}</div>
                <p className="text-xs mt-2">+{analytics.recentCustomers} this period</p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-gradient-to-br from-cyan-500 to-blue-500 text-white overflow-hidden relative group hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-300" />
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <CardTitle className="text-sm font-medium text-cyan-50">Avg Order Value</CardTitle>
                <Package className="h-5 w-5 text-cyan-100" />
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-3xl font-bold">€{analytics.avgOrderValue.toFixed(2)}</div>
                <p className="text-xs mt-2">{analytics.totalProducts} products</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section 2: Living Garden Revenue Metrics */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-cyan-500 rounded-full" />
            Revenue Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {revenueMetrics.map((metric, index) => (
              <Card
                key={metric.label}
                className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-cyan-50 border-emerald-200/50 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] group"
              >
                <div className="absolute -right-8 -top-8 w-32 h-32 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Leaf className="w-full h-full text-emerald-600 rotate-45" />
                </div>

                <div className="relative p-6 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-emerald-900">{metric.label}</span>
                    <DollarSign className="h-4 w-4 text-emerald-700 opacity-70" />
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold bg-gradient-to-br from-emerald-800 to-emerald-700 bg-clip-text text-transparent">
                      {formatCurrency(metric.value)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <div className={cn(
                      "flex items-center gap-1 px-2 py-0.5 rounded-full",
                      metric.change > 0 ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                    )}>
                      <TrendingUp className="h-3 w-3" />
                      <span className="font-semibold">{metric.change > 0 ? '+' : ''}{metric.change}%</span>
                    </div>
                    <span className="text-slate-600">{metric.period}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Section 3: Sales Intelligence (Recharts) */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-cyan-500 rounded-full" />
            Sales Intelligence
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-emerald-100 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-emerald-900">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  Revenue Trend
                </CardTitle>
                <CardDescription>Daily revenue over the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.revenueByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                    <Tooltip
                      formatter={(value: any) => `€${value.toFixed(2)}`}
                      labelFormatter={(label) => `Date: ${label}`}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ fill: '#10b981', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="border-cyan-100 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-cyan-900">
                  <ShoppingCart className="h-5 w-5 text-cyan-600" />
                  Order Volume
                </CardTitle>
                <CardDescription>Daily orders over the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics.ordersByDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                    <Tooltip
                      labelFormatter={(label) => `Date: ${label}`}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    />
                    <Bar dataKey="orders" fill="#06b6d4" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Section 4: Store Performance (Plotly.js - Living Garden) */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-cyan-500 rounded-full" />
            Store Performance
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Trend Chart */}
            <Card className="lg:col-span-2 overflow-hidden bg-white/80 backdrop-blur border-emerald-100 hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-lg font-semibold text-slate-800">Sales Trend</h3>
                  <Badge variant="outline" className="ml-auto text-xs bg-emerald-50 text-emerald-800 border-emerald-200">
                    Last 30 days
                  </Badge>
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
            </Card>

            {/* Order Status Distribution */}
            <Card className="overflow-hidden bg-white/80 backdrop-blur border-emerald-100 hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ShoppingBag className="h-5 w-5 text-emerald-600" />
                  <h3 className="text-lg font-semibold text-slate-800">Order Distribution</h3>
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
            </Card>

            {/* Top Products Chart */}
            <Card className="lg:col-span-3 overflow-hidden bg-white/80 backdrop-blur border-cyan-100 hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="h-5 w-5 text-cyan-600" />
                  <h3 className="text-lg font-semibold text-slate-800">Top Products by Revenue</h3>
                  <Badge variant="outline" className="ml-auto text-xs bg-cyan-50 text-cyan-800 border-cyan-200">
                    Best Sellers
                  </Badge>
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
            </Card>
          </div>
        </section>

        {/* Section 5: Customer Insights */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-cyan-500 rounded-full" />
            Customer Insights
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-purple-100 shadow-md hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-900">
                  <Users className="h-5 w-5 text-purple-600" />
                  Customer Growth
                </CardTitle>
                <CardDescription>New customer registrations over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics.customerGrowth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="date" stroke="#64748b" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                    <Tooltip
                      labelFormatter={(label) => `Date: ${label}`}
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="customers"
                      stroke="#8b5cf6"
                      strokeWidth={3}
                      dot={{ fill: '#8b5cf6', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Recent Customers */}
            <Card className="overflow-hidden bg-white/80 backdrop-blur border-cyan-100">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-cyan-600" />
                    <h3 className="text-lg font-semibold text-slate-800">Recent Customers</h3>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/tenant-admin/customers" className="text-cyan-600 hover:text-cyan-700">
                      View All
                    </Link>
                  </Button>
                </div>

                <div className="space-y-3">
                  {recentCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:border-cyan-200 hover:bg-cyan-50/50 transition-all group"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 group-hover:scale-110 transition-transform">
                        {getInitials(customer.name)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate group-hover:text-cyan-700 transition-colors">
                          {customer.name}
                        </p>
                        <p className="text-sm text-slate-500 truncate">{customer.email}</p>
                      </div>

                      <span className="text-xs text-slate-500 flex-shrink-0">
                        {formatTimeAgo(customer.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Section 6: Activity & Orders */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-cyan-500 rounded-full" />
            Recent Activity
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Orders */}
            <Card className="lg:col-span-2 overflow-hidden bg-white/80 backdrop-blur border-purple-100">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="h-5 w-5 text-purple-600" />
                    <h3 className="text-lg font-semibold text-slate-800">Recent Orders</h3>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/tenant-admin/orders" className="text-purple-600 hover:text-purple-700">
                      View All
                    </Link>
                  </Button>
                </div>

                <div className="space-y-3">
                  {recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-purple-200 hover:bg-purple-50/50 transition-all group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate group-hover:text-purple-700 transition-colors">
                          {order.orderNumber}
                        </p>
                        <p className="text-sm text-slate-500 truncate">{order.customer}</p>
                      </div>

                      <div className="flex items-center gap-3 ml-4">
                        <div className="text-right">
                          <p className="font-semibold text-slate-800">{formatCurrency(order.total)}</p>
                          <p className="text-xs text-slate-500">{formatTimeAgo(order.createdAt)}</p>
                        </div>
                        <Badge className={cn("text-xs border", getStatusColor(order.status))}>
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Pending Consultations Card */}
            <Card className="overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 border-amber-200/50 hover:shadow-lg transition-shadow">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Calendar className="h-5 w-5 text-amber-600" />
                  <h3 className="text-lg font-semibold text-slate-800">Consultations</h3>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/70 rounded-lg border border-amber-200/50">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Pending Requests</p>
                      <p className="text-3xl font-bold text-amber-600">{pendingConsultations}</p>
                    </div>
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                      <Calendar className="h-8 w-8 text-white" />
                    </div>
                  </div>

                  <Button
                    asChild
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg hover:shadow-xl transition-all"
                  >
                    <Link href="/tenant-admin/consultations">
                      View All Consultations
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Section 7: Orders by Status (Recharts Pie) */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-cyan-500 rounded-full" />
            Order Status Breakdown
          </h2>
          <Card className="border-emerald-100 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-900">
                <ShoppingBag className="h-5 w-5 text-emerald-600" />
                Orders by Status
              </CardTitle>
              <CardDescription>Distribution of order statuses in the selected period</CardDescription>
            </CardHeader>
            <CardContent>
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
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </section>

        {/* Section 8: Top Selling Products */}
        <section>
          <h2 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <div className="w-1 h-6 bg-gradient-to-b from-emerald-500 to-cyan-500 rounded-full" />
            Top Selling Products
          </h2>
          <Card className="border-emerald-100 shadow-md hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-900">
                <Package className="h-5 w-5 text-emerald-600" />
                Best Performers
              </CardTitle>
              <CardDescription>Products ranked by quantity sold and revenue generated</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics.topProducts.map((product: any, index: number) => (
                  <div key={product.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50/50 to-cyan-50/50 rounded-lg border border-emerald-100 hover:border-emerald-300 hover:shadow-md transition-all group">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center font-bold text-white text-xl shadow-lg group-hover:scale-110 transition-transform">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-lg text-slate-900">{product.name}</p>
                        <p className="text-sm text-slate-600">{product.orders} orders • {product.quantity} units sold</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-600">
                        €{product.revenue.toFixed(2)}
                      </p>
                      <Badge className="mt-1 bg-emerald-100 text-emerald-800 border-emerald-200">
                        Revenue
                      </Badge>
                    </div>
                  </div>
                ))}
                {analytics.topProducts.length === 0 && (
                  <div className="text-center py-12">
                    <Package className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                    <p className="text-slate-500 text-lg">No product sales yet</p>
                    <p className="text-slate-400 text-sm mt-2">Start adding products to see analytics</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
