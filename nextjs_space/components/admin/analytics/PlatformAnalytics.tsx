"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  TrendingUp,
  DollarSign,
  PieChart as PieChartIcon,
  AlertCircle,
  Users,
  Percent,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Plot = dynamic(() => import("react-plotly.js") as any, {
  ssr: false,
}) as any;

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

export function PlatformAnalytics({ className }: PlatformAnalyticsProps) {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      await new Promise((resolve) => setTimeout(resolve, 1200));

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
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <div className="bs-eyebrow mb-2">Platform Analytics</div>
          <h2
            className="font-display text-[36px] text-bs-fg leading-tight"
            style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}
          >
            Real-time insights and trends
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          icon={DollarSign}
          label="Monthly Recurring Revenue"
          value={`$${(data.quickMetrics.mrr / 1000).toFixed(1)}k`}
          subValue="MRR"
        />
        <MetricCard
          icon={Percent}
          label="Churn Rate"
          value={`${data.quickMetrics.churnRate}%`}
          subValue="Last 30 days"
        />
        <MetricCard
          icon={Users}
          label="Avg Users per Tenant"
          value={data.quickMetrics.avgUsersPerTenant.toFixed(1)}
          subValue="Platform-wide"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Tenant Signups"
          subtitle="Last 90 days"
          icon={TrendingUp}
        >
          <Plot
            data={[
              {
                x: data.tenantSignups.map((d) => d.date),
                y: data.tenantSignups.map((d) => d.count),
                type: "scatter",
                mode: "lines+markers",
                line: {
                  color: "#06b6d4",
                  width: 3,
                  shape: "spline",
                },
                marker: {
                  color: "#06b6d4",
                  size: 6,
                  line: {
                    color: "#0e7490",
                    width: 2,
                  },
                },
                fill: "tozeroy",
                fillcolor: "rgba(6, 182, 212, 0.1)",
              },
            ]}
            layout={{
              autosize: true,
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor: "rgba(0,0,0,0)",
              margin: { l: 40, r: 20, t: 20, b: 40 },
              xaxis: {
                gridcolor: "#e2e8f0",
                showgrid: true,
                zeroline: false,
                tickfont: {
                  family: "JetBrains Mono, monospace",
                  size: 10,
                  color: "#64748b",
                },
              },
              yaxis: {
                gridcolor: "#e2e8f0",
                showgrid: true,
                zeroline: false,
                tickfont: {
                  family: "JetBrains Mono, monospace",
                  size: 10,
                  color: "#64748b",
                },
              },
              hovermode: "closest",
            }}
            config={{
              displayModeBar: false,
              responsive: true,
            }}
            style={{ width: "100%", height: "100%" }}
            useResizeHandler
          />
        </ChartCard>

        <ChartCard
          title="Platform Revenue"
          subtitle="Last 12 months"
          icon={DollarSign}
        >
          <Plot
            data={[
              {
                x: data.platformRevenue.map((d) => d.month),
                y: data.platformRevenue.map((d) => d.revenue),
                type: "bar",
                marker: {
                  color: data.platformRevenue.map((_, i) =>
                    i === data.platformRevenue.length - 1
                      ? "#06b6d4"
                      : "#cbd5e1",
                  ),
                  line: {
                    color: data.platformRevenue.map((_, i) =>
                      i === data.platformRevenue.length - 1
                        ? "#0e7490"
                        : "#94a3b8",
                    ),
                    width: 2,
                  },
                },
              },
            ]}
            layout={{
              autosize: true,
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor: "rgba(0,0,0,0)",
              margin: { l: 50, r: 20, t: 20, b: 60 },
              xaxis: {
                gridcolor: "#e2e8f0",
                showgrid: false,
                zeroline: false,
                tickfont: {
                  family: "JetBrains Mono, monospace",
                  size: 10,
                  color: "#64748b",
                },
                tickangle: -45,
              },
              yaxis: {
                gridcolor: "#e2e8f0",
                showgrid: true,
                zeroline: false,
                tickfont: {
                  family: "JetBrains Mono, monospace",
                  size: 10,
                  color: "#64748b",
                },
                tickprefix: "$",
              },
              hovermode: "closest",
            }}
            config={{
              displayModeBar: false,
              responsive: true,
            }}
            style={{ width: "100%", height: "100%" }}
            useResizeHandler
          />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Tenant Distribution"
          subtitle="Active vs Inactive"
          icon={PieChartIcon}
        >
          <Plot
            data={[
              {
                values: [
                  data.tenantDistribution.active,
                  data.tenantDistribution.inactive,
                ],
                labels: ["Active", "Inactive"],
                type: "pie",
                marker: {
                  colors: ["#06b6d4", "#cbd5e1"],
                  line: {
                    color: "#fff",
                    width: 3,
                  },
                },
                textfont: {
                  family: "JetBrains Mono, monospace",
                  size: 14,
                  color: "#fff",
                },
                hole: 0.4,
              },
            ]}
            layout={{
              autosize: true,
              paper_bgcolor: "rgba(0,0,0,0)",
              plot_bgcolor: "rgba(0,0,0,0)",
              margin: { l: 20, r: 20, t: 20, b: 20 },
              showlegend: true,
              legend: {
                font: {
                  family: "JetBrains Mono, monospace",
                  size: 12,
                  color: "#64748b",
                },
                orientation: "h",
                y: -0.2,
              },
            }}
            config={{
              displayModeBar: false,
              responsive: true,
            }}
            style={{ width: "100%", height: "100%" }}
            useResizeHandler
          />
        </ChartCard>

        <div className="bs-card bs-card-pad">
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-xl p-2 bg-bs-card-2 border border-bs-border-100">
              <AlertCircle className="h-5 w-5 text-bs-gold" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-display text-[22px] text-bs-fg" style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}>
                Needs Attention
              </h3>
              <p className="text-xs text-bs-fg-muted mt-0.5">
                Action items requiring review
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <AttentionItem
              icon={UserPlus}
              label="Pending Onboarding"
              count={data.needsAttention.pendingOnboarding}
              tone="info"
            />
            <AttentionItem
              icon={AlertCircle}
              label="Failed Payments"
              count={data.needsAttention.failedPayments}
              tone="danger"
            />
            <AttentionItem
              icon={AlertCircle}
              label="Support Tickets"
              count={data.needsAttention.supportTickets}
              tone="warn"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  subValue: string;
}

function MetricCard({ icon: Icon, label, value, subValue }: MetricCardProps) {
  return (
    <div className="bs-stat">
      <div className="bs-stat-row">
        <span className="bs-stat-label">{label}</span>
        <span className="bs-stat-icon">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="bs-stat-value">{value}</div>
      <div className="bs-stat-delta font-mono">{subValue}</div>
    </div>
  );
}

interface ChartCardProps {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  children: React.ReactNode;
}

function ChartCard({ title, subtitle, icon: Icon, children }: ChartCardProps) {
  return (
    <div className="bs-card bs-card-pad">
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-xl p-2 bg-bs-card-2 border border-bs-border-100">
          <Icon className="h-5 w-5 text-bs-fg-muted" aria-hidden="true" />
        </div>
        <div>
          <h3 className="font-display text-[22px] text-bs-fg" style={{ fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)" }}>
            {title}
          </h3>
          <p className="text-xs text-bs-fg-muted mt-0.5">{subtitle}</p>
        </div>
      </div>
      <div className="h-[280px] relative">{children}</div>
    </div>
  );
}

interface AttentionItemProps {
  icon: React.ElementType;
  label: string;
  count: number;
  tone: "info" | "danger" | "warn";
}

function AttentionItem({ icon: Icon, label, count, tone }: AttentionItemProps) {
  const chipClass =
    tone === "danger"
      ? "bs-chip bs-chip-danger"
      : tone === "warn"
        ? "bs-chip bs-chip-warn"
        : "bs-chip bs-chip-info";

  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-bs-border-100 bg-bs-card-2 hover:border-bs-border transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-bs-card border border-bs-border-100">
          <Icon className="h-4 w-4 text-bs-fg-muted" aria-hidden="true" />
        </div>
        <span className="text-sm font-medium text-bs-fg">{label}</span>
      </div>
      <span className={cn(chipClass, "font-mono tabular-nums")}>{count}</span>
    </div>
  );
}

function AnalyticsLoadingSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <div className="h-8 w-64 bg-bs-card-2 rounded animate-pulse" />
        <div className="h-4 w-48 bg-bs-card-2 rounded animate-pulse" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bs-card bs-card-pad">
            <div className="space-y-3">
              <div className="h-4 w-24 bg-bs-card-2 rounded animate-pulse" />
              <div className="h-8 w-32 bg-bs-card-2 rounded animate-pulse" />
              <div className="h-3 w-20 bg-bs-card-2 rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1].map((i) => (
          <div key={i} className="bs-card bs-card-pad">
            <div className="h-6 w-40 bg-bs-card-2 rounded animate-pulse mb-6" />
            <div className="h-[280px] bg-bs-card-2 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1].map((i) => (
          <div key={i} className="bs-card bs-card-pad">
            <div className="h-6 w-40 bg-bs-card-2 rounded animate-pulse mb-6" />
            <div className="h-[280px] bg-bs-card-2 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

function generateMockSignupData() {
  const data = [];
  const today = new Date();

  for (let i = 89; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const count = Math.floor(Math.random() * 5) + 1;

    data.push({
      date: date.toISOString().split("T")[0],
      count,
    });
  }

  return data;
}

function generateMockRevenueData() {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
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
