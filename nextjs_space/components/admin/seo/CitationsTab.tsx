"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, CheckCircle2, Loader2, MinusCircle, RefreshCw } from "lucide-react";

import {
  CITATION_MONITOR_COPY,
  summariseCitationChecks,
  type CitationCheckRow,
  type CitationEngineSummary,
} from "@/lib/seo/citation-monitor";
import { AutomatosConnectCard } from "./AiAssistButton";
import { fetchCitationChecks } from "./citations-client";

/**
 * LLM Visibility US-005 — the AI Citations tab of the SEO Manager.
 *
 * THE CAVEAT IS PART OF THE FEATURE, not a footnote. Every number on this
 * screen comes from asking the STORE'S OWN configured model, on the store's own
 * Automatos account, and that is the only thing it can honestly claim — so
 * `CITATION_MONITOR_COPY.caveat` renders in the header, in plain sight, and
 * nothing here is phrased as a ranking, a score or a position. The answering
 * model id sits on every row for the same reason: an owner should never have to
 * guess which model produced a tally.
 *
 * NOT CITED IS A RESULT, NOT AN EMPTY STATE. A model that answered the question
 * without linking the store is the common case and the baseline the tally is
 * read against, so it is shown as a count rather than hidden — the only true
 * empty state is "no run has happened yet".
 *
 * A STORE WITH NO AUTOMATOS ACCOUNT gets the same connect card AI drafting
 * shows, because "not configured" is a cross-sell surface and not an error.
 *
 * Rendered only for a tenant holding `seo.pro`; a Basic tenant meets the locked
 * card in the Pro tab instead. That is PRESENTATION — the boundary is
 * `requireFeature(FEATURES.SEO_PRO, …)` on the GET route, which 403s a Basic
 * tenant whatever this component renders.
 */

const sectionTitleStyle = {
  fontFamily: "var(--bs-font-display, 'Cormorant Garamond', serif)",
};

/** A date a human reads, from an ISO string that may be anything. */
function checkedOn(value: string | null): string {
  if (!value) return "never";
  const at = Date.parse(value);
  if (Number.isNaN(at)) return "unknown";
  return new Date(at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function LatestMention({ row }: { row: CitationCheckRow }) {
  return (
    <div className="rounded-md border border-bs-border-100 bg-bs-bg-subtle p-3 space-y-2">
      <p className="text-xs uppercase tracking-wide text-bs-fg-muted">
        Latest answer that linked you
      </p>
      <p className="text-sm text-bs-fg">{row.mentionText}</p>
      {row.citedUrl && (
        // Plain text, deliberately NOT a link: this string is a model's output,
        // and a URL it wrote is not something this admin should offer as a
        // one-click destination. An owner who wants to visit it can copy it.
        <p className="text-xs text-bs-fg-muted break-all">{row.citedUrl}</p>
      )}
      <p className="text-xs text-bs-fg-muted">
        Asked: “{row.prompt}”
      </p>
    </div>
  );
}

function EngineCard({ summary }: { summary: CitationEngineSummary }) {
  const notCited = summary.checks - summary.cited;

  return (
    <section className="bs-card bs-card-pad space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="bs-chip bs-chip-muted inline-flex items-center gap-1">
          <Bot className="h-3 w-3" aria-hidden="true" />
          {summary.engine}
        </span>
        <span className="text-sm text-bs-fg-muted">
          last checked {checkedOn(summary.lastCheckedAt)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <span className="inline-flex items-center gap-1 text-bs-fg">
          <CheckCircle2 className="h-4 w-4 text-bs-green" aria-hidden="true" />
          {summary.cited} cited
        </span>
        <span className="inline-flex items-center gap-1 text-bs-fg-muted">
          <MinusCircle className="h-4 w-4" aria-hidden="true" />
          {notCited} not cited
        </span>
        <span className="text-bs-fg-muted">
          {summary.checks} {summary.checks === 1 ? "check" : "checks"} recorded
        </span>
      </div>

      {summary.runs.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-bs-fg-muted">
            Weekly runs, newest first
          </p>
          <ul className="divide-y divide-bs-border-100">
            {summary.runs.map((run) => (
              <li
                key={run.checkedAt}
                className="flex items-center justify-between py-1.5 text-sm"
              >
                <span className="text-bs-fg-muted">
                  {checkedOn(run.checkedAt)}
                </span>
                <span className="text-bs-fg">
                  {run.cited} of {run.checks} answers linked you
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.latestMention ? (
        <LatestMention row={summary.latestMention} />
      ) : (
        <p className="text-sm text-bs-fg-muted">
          This model has not linked your store in any answer yet.
        </p>
      )}
    </section>
  );
}

function MonitorHeader() {
  return (
    <section className="bs-card bs-card-pad space-y-2">
      <h3 className="text-[22px] leading-tight" style={sectionTitleStyle}>
        {CITATION_MONITOR_COPY.headline}
      </h3>
      <p className="text-sm text-bs-fg-muted">{CITATION_MONITOR_COPY.body}</p>
      <p className="text-sm text-bs-fg-muted">
        {CITATION_MONITOR_COPY.caveat}
      </p>
      <p className="text-xs text-bs-fg-muted">
        {CITATION_MONITOR_COPY.spendNote}
      </p>
    </section>
  );
}

export function CitationsTab() {
  const [checks, setChecks] = useState<readonly CitationCheckRow[]>([]);
  const [connected, setConnected] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const outcome = await fetchCitationChecks();
    if (outcome.ok) {
      setChecks(outcome.checks);
      setConnected(outcome.connected);
      setError(null);
      setUpgradeRequired(false);
    } else {
      setError(outcome.error);
      setUpgradeRequired(outcome.upgradeRequired);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <section className="bs-card bs-card-pad">
        <p className="text-sm text-bs-fg-muted text-center py-8 inline-flex items-center gap-2 w-full justify-center">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading your citation checks…
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="bs-card bs-card-pad space-y-3">
        <h3 className="text-[22px] leading-tight" style={sectionTitleStyle}>
          {CITATION_MONITOR_COPY.headline}
        </h3>
        <p className="text-sm text-bs-danger" role="alert">
          {error}
        </p>
        {!upgradeRequired && (
          <button
            type="button"
            className="bs-btn bs-btn-ghost bs-btn-sm"
            onClick={() => void load()}
          >
            <RefreshCw className="h-4 w-4 mr-1" aria-hidden="true" />
            Try again
          </button>
        )}
      </section>
    );
  }

  const engines = summariseCitationChecks(checks);

  return (
    <div className="space-y-4">
      <MonitorHeader />

      {!connected && <AutomatosConnectCard />}

      {connected && engines.length === 0 && (
        <section className="bs-card bs-card-pad text-center space-y-2 py-8">
          <Bot className="h-6 w-6 mx-auto text-bs-fg-muted" aria-hidden="true" />
          <h4 className="font-medium text-bs-fg">
            {CITATION_MONITOR_COPY.emptyHeadline}
          </h4>
          <p className="text-sm text-bs-fg-muted">
            {CITATION_MONITOR_COPY.emptyBody}
          </p>
        </section>
      )}

      {engines.map((summary) => (
        <EngineCard key={summary.engine} summary={summary} />
      ))}
    </div>
  );
}
