"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

import type {
  SeoAuditCheckResult,
  SeoAuditGrade,
  SeoAuditSeverity,
  SeoAuditTarget,
} from "@/lib/seo/audit-types";
import type { SeoAuditSnapshot } from "@/lib/seo/audit-cache";
import { fetchSeoAudit } from "./audit-client";

/**
 * SEO Supercharge US-023 — the Audit tab of the SEO Manager.
 *
 * WHAT MAKES THIS DIFFERENT FROM A SCORE WIDGET: every finding carries a button
 * that opens the editor which fixes it. `onFix` is the SEO Manager's own tab and
 * modal state (app/tenant-admin/seo/seo-page-client.tsx) — a finding about a
 * product opens that product's SEO editor, a finding about a redirect opens the
 * Redirects tab. A panel that says "12 products have no description" and leaves
 * an owner to find them by hand is the version of this feature nobody uses.
 *
 * Rendered only for a tenant holding `seo.pro`. That is PRESENTATION: the
 * boundary is `requireFeature(FEATURES.SEO_PRO)` on the route, which 403s a
 * Basic tenant whatever this component does — and the upgrade state below is
 * what it renders when that happens anyway.
 */

interface SeoAuditTabProps {
  /** Open the editor a finding points at. */
  onFix: (target: SeoAuditTarget) => void;
}

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

const GRADE_COPY: Readonly<
  Record<SeoAuditGrade, { label: string; chip: string; ring: string }>
> = {
  good: {
    label: "Good",
    chip: "bs-chip bs-chip-green",
    ring: "text-bs-green",
  },
  "needs-work": {
    label: "Needs work",
    chip: "bs-chip bs-chip-warn",
    ring: "text-bs-warn",
  },
  poor: { label: "Poor", chip: "bs-chip bs-chip-danger", ring: "text-bs-danger" },
};

const SEVERITY_CHIP: Readonly<Record<SeoAuditSeverity, string>> = {
  critical: "bs-chip bs-chip-danger",
  warning: "bs-chip bs-chip-warn",
  info: "bs-chip bs-chip-info",
};

const SEVERITY_LABEL: Readonly<Record<SeoAuditSeverity, string>> = {
  critical: "Critical",
  warning: "Warning",
  info: "Suggestion",
};

function SeverityIcon({ severity }: { severity: SeoAuditSeverity }) {
  const className = "h-4 w-4 flex-shrink-0";
  if (severity === "critical") {
    return <ShieldAlert className={className} aria-hidden="true" />;
  }
  if (severity === "warning") {
    return <AlertTriangle className={className} aria-hidden="true" />;
  }
  return <Info className={className} aria-hidden="true" />;
}

/** "just now" / "6 minutes ago" — the cache age, so a stale score reads as one. */
function auditedAgo(generatedAt: string): string {
  const at = Date.parse(generatedAt);
  if (Number.isNaN(at)) return "just now";
  const minutes = Math.floor((Date.now() - at) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  return `${minutes} minutes ago`;
}

function CheckGroup({
  group,
  onFix,
}: {
  group: SeoAuditCheckResult;
  onFix: (target: SeoAuditTarget) => void;
}) {
  const hidden = group.total - group.findings.length;

  return (
    <section className="bs-card bs-card-pad space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${SEVERITY_CHIP[group.severity]} inline-flex items-center gap-1`}>
          <SeverityIcon severity={group.severity} />
          {SEVERITY_LABEL[group.severity]}
        </span>
        <h4 className="font-medium text-bs-fg">{group.title}</h4>
        <span className="text-sm text-bs-fg-muted">
          {group.total} {group.total === 1 ? "item" : "items"} · −{group.penalty}{" "}
          {group.penalty === 1 ? "point" : "points"}
        </span>
      </div>

      <ul className="divide-y divide-bs-border-100">
        {group.findings.map((item, index) => (
          <li
            key={`${item.check}-${item.target.entityId ?? item.target.tab}-${index}`}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-2"
          >
            <p className="text-sm text-bs-fg-body min-w-0">{item.message}</p>
            <button
              type="button"
              className="bs-btn bs-btn-ghost bs-btn-sm flex-shrink-0 self-start sm:self-auto"
              onClick={() => onFix(item.target)}
            >
              Fix
              <ArrowRight className="h-4 w-4 ml-1" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {hidden > 0 && (
        <p className="text-sm text-bs-fg-muted">
          Showing {group.findings.length} of {group.total}. Fix these and re-run
          to see the rest.
        </p>
      )}
    </section>
  );
}

function ScoreHeader({
  snapshot,
  refreshing,
  onRefresh,
}: {
  snapshot: SeoAuditSnapshot;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { audit } = snapshot;
  const grade = GRADE_COPY[audit.grade] ?? GRADE_COPY.poor;
  const { stats, severityCounts } = audit;

  return (
    <section className="bs-card bs-card-pad space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`text-5xl font-semibold tabular-nums ${grade.ring}`}>
            {audit.score}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={grade.chip}>{grade.label}</span>
              <span className="text-sm text-bs-fg-muted">out of 100</span>
            </div>
            <p className="text-sm text-bs-fg-muted">
              {severityCounts.critical} critical · {severityCounts.warning}{" "}
              warnings · {severityCounts.info} suggestions
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-bs-fg-muted">
            Audited {auditedAgo(snapshot.generatedAt)}
          </span>
          <button
            type="button"
            className="bs-btn bs-btn-ghost bs-btn-sm"
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-1" aria-hidden="true" />
            )}
            Re-run
          </button>
        </div>
      </div>

      <p className="text-sm text-bs-fg-muted">
        Checked {stats.products} products, {stats.posts} posts,{" "}
        {stats.conditions} condition pages, {stats.pages} store pages and{" "}
        {stats.redirects} redirects. Your sitemap publishes {stats.sitemapEntries}{" "}
        URLs.
      </p>

      {stats.truncated.length > 0 && (
        <p className="text-sm text-bs-warn">
          This store is large enough that only the first rows of{" "}
          {stats.truncated.join(", ")} were audited, so the score is a sample
          rather than the whole catalogue.
        </p>
      )}
    </section>
  );
}

export function SeoAuditTab({ onFix }: SeoAuditTabProps) {
  const [snapshot, setSnapshot] = useState<SeoAuditSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh: boolean) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    const outcome = await fetchSeoAudit({ refresh });
    if (outcome.ok) {
      setSnapshot(outcome.snapshot);
      setError(null);
      setUpgradeRequired(false);
    } else {
      setError(outcome.error);
      setUpgradeRequired(outcome.upgradeRequired);
    }

    setRefreshing(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(false);
  }, [load]);

  if (loading) {
    return (
      <section className="bs-card bs-card-pad">
        <p className="text-sm text-bs-fg-muted text-center py-8 inline-flex items-center gap-2 w-full justify-center">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Checking every page in your store…
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="bs-card bs-card-pad space-y-3">
        <h3 className="text-[22px] leading-tight" style={sectionTitleStyle}>
          SEO audit
        </h3>
        <p className="text-sm text-bs-danger" role="alert">
          {error}
        </p>
        {!upgradeRequired && (
          <button
            type="button"
            className="bs-btn bs-btn-ghost bs-btn-sm"
            onClick={() => void load(false)}
          >
            <RefreshCw className="h-4 w-4 mr-1" aria-hidden="true" />
            Try again
          </button>
        )}
      </section>
    );
  }

  if (!snapshot) return null;

  const failing = snapshot.audit.checks.filter((group) => group.total > 0);
  const passed = snapshot.audit.checks.length - failing.length;

  return (
    <div className="space-y-4">
      <ScoreHeader
        snapshot={snapshot}
        refreshing={refreshing}
        onRefresh={() => void load(true)}
      />

      {failing.length === 0 ? (
        <section className="bs-card bs-card-pad text-center space-y-2 py-8">
          <Sparkles
            className="h-6 w-6 mx-auto text-bs-green"
            aria-hidden="true"
          />
          <h4 className="font-medium text-bs-fg">Nothing to fix</h4>
          <p className="text-sm text-bs-fg-muted">
            All {passed} checks passed. Titles, descriptions, images, your
            sitemap and your redirects are all in order.
          </p>
        </section>
      ) : (
        <>
          {failing.map((group) => (
            <CheckGroup key={group.check} group={group} onFix={onFix} />
          ))}
          {passed > 0 && (
            <p className="text-sm text-bs-fg-muted inline-flex items-center gap-2">
              <CheckCircle2
                className="h-4 w-4 text-bs-green"
                aria-hidden="true"
              />
              {passed} other {passed === 1 ? "check" : "checks"} passed.
            </p>
          )}
        </>
      )}
    </div>
  );
}
