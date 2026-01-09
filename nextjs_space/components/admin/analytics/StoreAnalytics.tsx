'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  TrendingUp,
  Package,
  Users,
  Calendar,
  ShoppingBag,
  DollarSign,
  Sparkles,
  ArrowUpRight,
  Leaf
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Link from 'next/link'

// Dynamic import for Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

interface StoreAnalyticsProps {
  className?: string
}

interface RevenueMetric {
  label: string
  value: number
  change: number
  period: string
}

interface RecentOrder {
  id: string
  orderNumber: string
  customer: string
  total: number
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED'
  createdAt: Date
}

interface RecentCustomer {
  id: string
  name: string
  email: string
  createdAt: Date
}

interface TopProduct {
  name: string
  sales: number
  revenue: number
}

// Mock data generators
const generateSalesTrendData = () => {
  const days = 30
  const data = []
  let baseValue = 800

  for (let i = 0; i < days; i++) {
    const date = new Date()
    date.setDate(date.getDate() - (days - i))
    const variance = Math.random() * 400 - 200
    const weekendBoost = [0, 6].includes(date.getDay()) ? 200 : 0
    baseValue += Math.random() * 100 - 50
    data.push({
      date: date.toISOString().split('T')[0],
      sales: Math.max(200, baseValue + variance + weekendBoost)
    })
  }

  return data
}

const generateTopProducts = (): TopProduct[] => [
  { name: 'Blue Dream - 3.5g', sales: 145, revenue: 2175 },
  { name: 'Sour Diesel - 7g', sales: 98, revenue: 1960 },
  { name: 'Girl Scout Cookies', sales: 87, revenue: 1305 },
  { name: 'OG Kush - Premium', sales: 76, revenue: 1520 },
  { name: 'Gelato - Hybrid', sales: 65, revenue: 975 }
]

const generateOrderStatusData = () => ({
  COMPLETED: 156,
  PROCESSING: 23,
  PENDING: 12,
  CANCELLED: 8
})

const generateRecentOrders = (): RecentOrder[] => [
  { id: '1', orderNumber: 'ORD-1247', customer: 'Sarah Chen', total: 85.50, status: 'COMPLETED', createdAt: new Date(Date.now() - 1000 * 60 * 15) },
  { id: '2', orderNumber: 'ORD-1246', customer: 'Marcus Johnson', total: 120.00, status: 'PROCESSING', createdAt: new Date(Date.now() - 1000 * 60 * 45) },
  { id: '3', orderNumber: 'ORD-1245', customer: 'Emma Williams', total: 65.75, status: 'COMPLETED', createdAt: new Date(Date.now() - 1000 * 60 * 120) },
  { id: '4', orderNumber: 'ORD-1244', customer: 'David Park', total: 95.25, status: 'PENDING', createdAt: new Date(Date.now() - 1000 * 60 * 180) },
  { id: '5', orderNumber: 'ORD-1243', customer: 'Lisa Anderson', total: 110.00, status: 'COMPLETED', createdAt: new Date(Date.now() - 1000 * 60 * 240) }
]

const generateRecentCustomers = (): RecentCustomer[] => [
  { id: '1', name: 'Alex Thompson', email: 'alex.t@email.com', createdAt: new Date(Date.now() - 1000 * 60 * 30) },
  { id: '2', name: 'Jordan Lee', email: 'jordan.lee@email.com', createdAt: new Date(Date.now() - 1000 * 60 * 120) },
  { id: '3', name: 'Taylor Martinez', email: 'taylor.m@email.com', createdAt: new Date(Date.now() - 1000 * 60 * 360) },
  { id: '4', name: 'Morgan Davis', email: 'morgan.d@email.com', createdAt: new Date(Date.now() - 1000 * 60 * 480) },
  { id: '5', name: 'Casey Wilson', email: 'casey.w@email.com', createdAt: new Date(Date.now() - 1000 * 60 * 720) }
]

const getRevenueMetrics = (): RevenueMetric[] => [
  { label: "Today's Revenue", value: 1247.50, change: 12.5, period: 'vs yesterday' },
  { label: "This Week", value: 8935.25, change: 8.3, period: 'vs last week' },
  { label: "This Month", value: 34521.75, change: 15.7, period: 'vs last month' }
]

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}

const getStatusColor = (status: string) => {
  // Updated with darker text colors for WCAG AA compliance (4.5:1 contrast on light backgrounds)
  const colors = {
    COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    PROCESSING: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
    CANCELLED: 'bg-slate-100 text-slate-800 border-slate-200'
  }
  return colors[status as keyof typeof colors] || colors.PENDING
}

const formatTimeAgo = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

// Loading skeleton component
const MetricCardSkeleton = () => (
  <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-cyan-50">
    <div className="p-6 space-y-3">
      <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
      <div className="h-8 w-32 bg-slate-200 rounded animate-pulse" />
      <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
    </div>
  </Card>
)

const ChartCardSkeleton = () => (
  <Card className="overflow-hidden bg-white/80 backdrop-blur">
    <div className="p-6">
      <div className="h-6 w-32 bg-slate-200 rounded animate-pulse mb-6" />
      <div className="h-64 bg-slate-100 rounded-lg animate-pulse" />
    </div>
  </Card>
)

export default function StoreAnalytics({ className }: StoreAnalyticsProps) {
  const [loading, setLoading] = useState(true)
  const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetric[]>([])
  const [salesTrendData, setSalesTrendData] = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [orderStatusData, setOrderStatusData] = useState<any>(null)
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([])
  const [recentCustomers, setRecentCustomers] = useState<RecentCustomer[]>([])
  const [pendingConsultations] = useState(7) // Mock value

  useEffect(() => {
    // Simulate API fetch with delay
    const timer = setTimeout(() => {
      setRevenueMetrics(getRevenueMetrics())
      setSalesTrendData(generateSalesTrendData())
      setTopProducts(generateTopProducts())
      setOrderStatusData(generateOrderStatusData())
      setRecentOrders(generateRecentOrders())
      setRecentCustomers(generateRecentCustomers())
      setLoading(false)
    }, 800)

    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return (
      <div className={cn('space-y-6', className)}>
        {/* Revenue Metrics Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCardSkeleton />
          <MetricCardSkeleton />
          <MetricCardSkeleton />
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCardSkeleton />
          <ChartCardSkeleton />
        </div>
      </div>
    )
  }

  // Sales Trend Chart Configuration
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
    hovertemplate: '<b>%{x}</b><br>$%{y:.2f}<extra></extra>'
  }

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
      tickprefix: '$'
    },
    hovermode: 'x unified' as const
  }

  // Top Products Chart Configuration
  const topProductsTrace = {
    x: topProducts.map(p => p.revenue),
    y: topProducts.map(p => p.name),
    type: 'bar' as const,
    orientation: 'h' as const,
    marker: {
      color: topProducts.map((_, i) => {
        const colors = ['#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6']
        return colors[i]
      }),
      cornerradius: 8
    },
    hovertemplate: '<b>%{y}</b><br>Revenue: $%{x:.2f}<extra></extra>'
  }

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
      tickprefix: '$'
    },
    yaxis: {
      showgrid: false,
      zeroline: false,
      tickfont: { size: 11, color: '#64748b' }
    }
  }

  // Order Status Distribution Chart Configuration
  const orderStatusTrace = {
    labels: Object.keys(orderStatusData),
    values: Object.values(orderStatusData) as number[],
    type: 'pie' as const,
    hole: 0.5,
    marker: {
      colors: ['#10b981', '#06b6d4', '#f59e0b', '#94a3b8']
    },
    textinfo: 'label+percent' as const,
    textfont: { size: 12, color: '#1e293b' },
    hovertemplate: '<b>%{label}</b><br>%{value} orders<br>%{percent}<extra></extra>'
  }

  const orderStatusLayout = {
    autosize: true,
    margin: { l: 20, r: 20, t: 20, b: 20 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    showlegend: false,
    annotations: [{
      font: { size: 24, color: '#10b981', family: 'Inter, sans-serif', weight: 700 },
      showarrow: false,
      text: orderStatusData ? String((Object.values(orderStatusData) as number[]).reduce((a: number, b: number) => a + b, 0)) : '0',
      x: 0.5,
      y: 0.55
    }, {
      font: { size: 12, color: '#64748b', family: 'Inter, sans-serif' },
      showarrow: false,
      text: 'Total Orders',
      x: 0.5,
      y: 0.42
    }]
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Decorative header element */}
      <div className="flex items-center gap-3 mb-2">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full blur-md opacity-60 animate-pulse" />
          <Sparkles className="relative h-6 w-6 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-700 via-emerald-600 to-cyan-600 bg-clip-text text-transparent">
          Store Analytics
        </h2>
      </div>

      {/* Revenue Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {revenueMetrics.map((metric, index) => (
          <Card
            key={metric.label}
            className="relative overflow-hidden bg-gradient-to-br from-emerald-50 via-white to-cyan-50 border-emerald-200/50 hover:shadow-lg transition-all duration-300 hover:scale-[1.02] group"
            style={{
              animationDelay: `${index * 100}ms`,
              animationFillMode: 'backwards'
            }}
          >
            {/* Decorative leaf accent */}
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

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend Chart */}
        <Card className="overflow-hidden bg-white/80 backdrop-blur border-emerald-100 hover:shadow-lg transition-shadow">
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

        {/* Top Products Chart */}
        <Card className="overflow-hidden bg-white/80 backdrop-blur border-cyan-100 hover:shadow-lg transition-shadow">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-5 w-5 text-cyan-600" />
              <h3 className="text-lg font-semibold text-slate-800">Top Products</h3>
              <Badge variant="outline" className="ml-auto text-xs bg-cyan-50 text-cyan-800 border-cyan-200">
                By Revenue
              </Badge>
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

      {/* Activity Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <Card className="overflow-hidden bg-white/80 backdrop-blur border-purple-100">
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
    </div>
  )
}
