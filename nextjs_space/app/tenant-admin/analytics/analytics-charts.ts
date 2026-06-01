import type { AnalyticsData } from "./analytics-helpers";

// Plotly chart configurations — series hex literals PRESERVED per PRD
export function buildChartConfigs(
  analytics: AnalyticsData,
  salesTrendData: any[],
) {
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
    hovertemplate: "<b>%{x}</b><br>€%{y:.2f}<extra></extra>",
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
      tickprefix: "€",
    },
    hovermode: "x unified" as const,
  };

  const topProductsTrace = {
    x: analytics.topProducts.slice(0, 5).map((p: any) => p.revenue),
    y: analytics.topProducts.slice(0, 5).map((p: any) => p.name),
    type: "bar" as const,
    orientation: "h" as const,
    marker: {
      color: ["#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6"],
      cornerradius: 8,
    },
    hovertemplate: "<b>%{y}</b><br>Revenue: €%{x:.2f}<extra></extra>",
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
      tickprefix: "€",
    },
    yaxis: {
      showgrid: false,
      zeroline: false,
      tickfont: { size: 11, color: "#64748b" },
    },
  };

  const orderStatusTrace = {
    labels: analytics.ordersByStatus.map((s: any) => s.name),
    values: analytics.ordersByStatus.map((s: any) => s.value),
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
        font: { size: 24, color: "#10b981", family: "system-ui", weight: 700 },
        showarrow: false,
        text: String(
          analytics.ordersByStatus.reduce((a: any, b: any) => a + b.value, 0),
        ),
        x: 0.5,
        y: 0.55,
      },
      {
        font: { size: 12, color: "#64748b", family: "system-ui" },
        showarrow: false,
        text: "Total Orders",
        x: 0.5,
        y: 0.42,
      },
    ],
  };

  return {
    salesTrendTrace,
    salesTrendLayout,
    topProductsTrace,
    topProductsLayout,
    orderStatusTrace,
    orderStatusLayout,
  };
}
