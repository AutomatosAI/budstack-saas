'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp,
  DollarSign,
  PieChart as PieChartIcon,
  AlertCircle,
  Users,
  Percent,
  UserPlus
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Dynamic import of Plotly for code splitting
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface PlatformAnalyticsProps {
  className?: string;
}

interface ChartData {
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

/**
 * Platform Analytics Component
 *
 * Mission Control aesthetic with dark slate theme, monospaced numerics,
 * and sharp cyan accents. Features Plotly.js charts with loading states.
 */
export function PlatformAnalytics({ className }: PlatformAnalyticsProps) {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API fetch with realistic delay
    const fetchData = async () => {
      setLoading(true);

      // In production, replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Mock data generation
      const mockData: ChartData = {
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

      setData(mockData);
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return <AnalyticsLoadingSkeleton className={className} />;
  }

  if (!data) return null;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Platform Analytics
          </h2>
          <p className="text-slate-600 mt-1">Real-time insights and trends</p>
        </div>
      </div>

      {/* Quick Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          icon={DollarSign}
          label="Monthly Recurring Revenue"
          value={`$${(data.quickMetrics.mrr / 1000).toFixed(1)}k`}
          subValue="MRR"
          delay="0ms"
          accentColor="cyan"
        />
        <MetricCard
          icon={Percent}
          label="Churn Rate"
          value={`${data.quickMetrics.churnRate}%`}
          subValue="Last 30 days"
          delay="100ms"
          accentColor="amber"
        />
        <MetricCard
          icon={Users}
          label="Avg Users per Tenant"
          value={data.quickMetrics.avgUsersPerTenant.toFixed(1)}
          subValue="Platform-wide"
          delay="200ms"
          accentColor="emerald"
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tenant Signups Chart */}
        <ChartCard
          title="Tenant Signups"
          subtitle="Last 90 days"
          icon={TrendingUp}
          delay="300ms"
        >
          <Plot
            data={[
              {
                x: data.tenantSignups.map(d => d.date),
                y: data.tenantSignups.map(d => d.count),
                type: 'scatter',
                mode: 'lines+markers',
                line: {
                  color: '#06b6d4',
                  width: 3,
                  shape: 'spline',
                },
                marker: {
                  color: '#06b6d4',
                  size: 6,
                  line: {
                    color: '#0e7490',
                    width: 2,
                  },
                },
                fill: 'tozeroy',
                fillcolor: 'rgba(6, 182, 212, 0.1)',
              },
            ]}
            layout={{
              autosize: true,
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)',
              margin: { l: 40, r: 20, t: 20, b: 40 },
              xaxis: {
                gridcolor: '#e2e8f0',
                showgrid: true,
                zeroline: false,
                tickfont: { family: 'JetBrains Mono, monospace', size: 10, color: '#64748b' },
              },
              yaxis: {
                gridcolor: '#e2e8f0',
                showgrid: true,
                zeroline: false,
                tickfont: { family: 'JetBrains Mono, monospace', size: 10, color: '#64748b' },
              },
              hovermode: 'closest',
            }}
            config={{
              displayModeBar: false,
              responsive: true,
            }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
          />
        </ChartCard>

        {/* Platform Revenue Chart */}
        <ChartCard
          title="Platform Revenue"
          subtitle="Last 12 months"
          icon={DollarSign}
          delay="400ms"
        >
          <Plot
            data={[
              {
                x: data.platformRevenue.map(d => d.month),
                y: data.platformRevenue.map(d => d.revenue),
                type: 'bar',
                marker: {
                  color: data.platformRevenue.map((_, i) =>
                    i === data.platformRevenue.length - 1 ? '#06b6d4' : '#cbd5e1'
                  ),
                  line: {
                    color: data.platformRevenue.map((_, i) =>
                      i === data.platformRevenue.length - 1 ? '#0e7490' : '#94a3b8'
                    ),
                    width: 2,
                  },
                },
              },
            ]}
            layout={{
              autosize: true,
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)',
              margin: { l: 50, r: 20, t: 20, b: 60 },
              xaxis: {
                gridcolor: '#e2e8f0',
                showgrid: false,
                zeroline: false,
                tickfont: { family: 'JetBrains Mono, monospace', size: 10, color: '#64748b' },
                tickangle: -45,
              },
              yaxis: {
                gridcolor: '#e2e8f0',
                showgrid: true,
                zeroline: false,
                tickfont: { family: 'JetBrains Mono, monospace', size: 10, color: '#64748b' },
                tickprefix: '$',
              },
              hovermode: 'closest',
            }}
            config={{
              displayModeBar: false,
              responsive: true,
            }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
          />
        </ChartCard>
      </div>

      {/* Bottom Row: Pie Chart + Needs Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active vs Inactive Tenants */}
        <ChartCard
          title="Tenant Distribution"
          subtitle="Active vs Inactive"
          icon={PieChartIcon}
          delay="500ms"
        >
          <Plot
            data={[
              {
                values: [data.tenantDistribution.active, data.tenantDistribution.inactive],
                labels: ['Active', 'Inactive'],
                type: 'pie',
                marker: {
                  colors: ['#06b6d4', '#cbd5e1'],
                  line: {
                    color: '#fff',
                    width: 3,
                  },
                },
                textfont: {
                  family: 'JetBrains Mono, monospace',
                  size: 14,
                  color: '#fff',
                },
                hole: 0.4,
              },
            ]}
            layout={{
              autosize: true,
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)',
              margin: { l: 20, r: 20, t: 20, b: 20 },
              showlegend: true,
              legend: {
                font: { family: 'JetBrains Mono, monospace', size: 12, color: '#64748b' },
                orientation: 'h',
                y: -0.2,
              },
            }}
            config={{
              displayModeBar: false,
              responsive: true,
            }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
          />
        </ChartCard>

        {/* Needs Attention Card */}
        <Card
          className="border-2 border-slate-200 shadow-lg bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-4"
          style={{ animationDelay: '600ms', animationFillMode: 'backwards' }}
        >
          <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold text-slate-900">Needs Attention</CardTitle>
                <p className="text-xs text-slate-600 mt-0.5">Action items requiring review</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <AttentionItem
                icon={UserPlus}
                label="Pending Onboarding"
                count={data.needsAttention.pendingOnboarding}
                color="cyan"
              />
              <AttentionItem
                icon={AlertCircle}
                label="Failed Payments"
                count={data.needsAttention.failedPayments}
                color="red"
              />
              <AttentionItem
                icon={AlertCircle}
                label="Support Tickets"
                count={data.needsAttention.supportTickets}
                color="amber"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================================
 * Supporting Components
 * ========================================================================= */

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue: string;
  delay: string;
  accentColor: 'cyan' | 'amber' | 'emerald';
}

function MetricCard({ icon: Icon, label, value, subValue, delay, accentColor }: MetricCardProps) {
  const colorMap = {
    cyan: {
      border: 'border-cyan-200',
      iconBg: 'bg-cyan-500/10',
      iconBorder: 'border-cyan-500/20',
      iconColor: 'text-cyan-600',
      valueColor: 'text-cyan-600',
    },
    amber: {
      border: 'border-amber-200',
      iconBg: 'bg-amber-500/10',
      iconBorder: 'border-amber-500/20',
      iconColor: 'text-amber-600',
      valueColor: 'text-amber-600',
    },
    emerald: {
      border: 'border-emerald-200',
      iconBg: 'bg-emerald-500/10',
      iconBorder: 'border-emerald-500/20',
      iconColor: 'text-emerald-600',
      valueColor: 'text-emerald-600',
    },
  };

  const colors = colorMap[accentColor];

  return (
    <Card
      className={cn(
        'border-2 shadow-lg bg-white overflow-hidden hover:shadow-xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-4',
        colors.border
      )}
      style={{ animationDelay: delay, animationFillMode: 'backwards' }}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <div className={cn('p-2.5 rounded-lg border inline-block', colors.iconBg, colors.iconBorder)}>
              <Icon className={cn('h-5 w-5', colors.iconColor)} />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wider">
                {label}
              </p>
              <p className={cn('text-4xl font-bold mt-2', colors.valueColor)} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {value}
              </p>
              <p className="text-xs text-slate-500 mt-1" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                {subValue}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface ChartCardProps {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  delay: string;
  children: React.ReactNode;
}

function ChartCard({ title, subtitle, icon: Icon, delay, children }: ChartCardProps) {
  return (
    <Card
      className="border-2 border-slate-200 shadow-lg bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-4"
      style={{ animationDelay: delay, animationFillMode: 'backwards' }}
    >
      <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
            <Icon className="h-5 w-5 text-cyan-600" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold text-slate-900">{title}</CardTitle>
            <p className="text-xs text-slate-600 mt-0.5">{subtitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="h-[280px] relative">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

interface AttentionItemProps {
  icon: React.ElementType;
  label: string;
  count: number;
  color: 'cyan' | 'red' | 'amber';
}

function AttentionItem({ icon: Icon, label, count, color }: AttentionItemProps) {
  const colorMap = {
    cyan: {
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-500/20',
      icon: 'text-cyan-600',
      badge: 'bg-cyan-500 text-white',
    },
    red: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      icon: 'text-red-600',
      badge: 'bg-red-500 text-white',
    },
    amber: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      icon: 'text-amber-600',
      badge: 'bg-amber-500 text-white',
    },
  };

  const colors = colorMap[color];

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border-2 border-slate-200 hover:border-slate-300 transition-colors">
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-lg border', colors.bg, colors.border)}>
          <Icon className={cn('h-4 w-4', colors.icon)} />
        </div>
        <span className="text-sm font-medium text-slate-700">{label}</span>
      </div>
      <div className={cn('px-3 py-1 rounded-full text-sm font-bold', colors.badge)} style={{ fontFamily: 'JetBrains Mono, monospace' }}>
        {count}
      </div>
    </div>
  );
}

function AnalyticsLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-64 bg-slate-200 rounded animate-pulse" />
        <div className="h-4 w-48 bg-slate-100 rounded animate-pulse" />
      </div>

      {/* Quick Metrics Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="border-2 border-slate-200 shadow-lg">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="h-12 w-12 bg-slate-200 rounded-lg animate-pulse" />
                <div className="space-y-2">
                  <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
                  <div className="h-10 w-28 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1].map((i) => (
          <Card key={i} className="border-2 border-slate-200 shadow-lg">
            <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 bg-slate-200 rounded-lg animate-pulse" />
                <div className="space-y-2">
                  <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[280px] bg-slate-100 rounded-lg animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom Row Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1].map((i) => (
          <Card key={i} className="border-2 border-slate-200 shadow-lg">
            <CardHeader className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 bg-slate-200 rounded-lg animate-pulse" />
                <div className="space-y-2">
                  <div className="h-5 w-40 bg-slate-200 rounded animate-pulse" />
                  <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[280px] bg-slate-100 rounded-lg animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
 * Mock Data Generators
 * ========================================================================= */

function generateMockSignupData() {
  const data = [];
  const today = new Date();

  for (let i = 89; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const count = Math.floor(Math.random() * 5) + 1;

    data.push({
      date: date.toISOString().split('T')[0],
      count,
    });
  }

  return data;
}

function generateMockRevenueData() {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const data = [];

  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthName = months[date.getMonth()];
    const year = date.getFullYear().toString().slice(2);
    const revenue = Math.floor(Math.random() * 50000) + 80000;

    data.push({
      month: `${monthName} '${year}`,
      revenue,
    });
  }

  return data;
}
