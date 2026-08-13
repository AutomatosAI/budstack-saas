"use client";

import { Repeat, Clock, UserCheck, Hourglass } from "lucide-react";

import { StatCard } from "@/components/admin/shared/StatCard";
import { formatCurrency, type RetentionSummary } from "./analytics-helpers";

const sectionTitleClass =
  "text-[22px] font-semibold text-bs-fg flex items-center gap-2";
const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
} as const;

/**
 * Grow-tier retention block. Null metrics render as an em dash — a store
 * with no reorder history yet gets a blank slate, never a fake number.
 */
export function RetentionSection({
  retention,
}: {
  retention: RetentionSummary;
}) {
  return (
    <section>
      <h2 className={sectionTitleClass} style={sectionTitleStyle}>
        <div className="w-1 h-6 bg-bs-green-soft rounded-full" />
        Customer Retention
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mt-6">
        <StatCard
          label="Repeat Purchase Rate"
          value={
            retention.repeatRate === null ? "—" : `${retention.repeatRate}%`
          }
          icon={Repeat}
          hint="customers ordering 2+ times"
        />
        <StatCard
          label="Reorder Cycle"
          value={
            retention.medianReorderDays === null
              ? "—"
              : `${retention.medianReorderDays} days`
          }
          icon={Clock}
          hint="median gap between orders"
        />
        <StatCard
          label="Returning Revenue"
          value={
            retention.newVsReturning.returningShare === null
              ? "—"
              : `${retention.newVsReturning.returningShare}%`
          }
          icon={UserCheck}
          hint={`${formatCurrency(retention.newVsReturning.returningRevenue)} this period`}
        />
        <StatCard
          label="Overdue for Reorder"
          value={retention.overdueCustomers}
          icon={Hourglass}
          hint={`no order in ${retention.overdueCutoffDays}+ days`}
        />
      </div>
    </section>
  );
}
