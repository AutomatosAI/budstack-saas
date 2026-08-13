"use client";

/**
 * US-018 — choosing who a campaign goes to, and seeing how many that is.
 *
 * The count is asked of the server on every change of selection rather than
 * computed here: it is the live intersection of confirmed subscribers,
 * consented customers and this tenant's suppression list, and the browser is
 * given only the number. Handing a compose screen the tenant's mailing list to
 * count it locally would be the wrong trade for a figure that fits in an int.
 */

import React, { useEffect, useState } from "react";
import { Loader2, Users } from "lucide-react";

import {
  CAMPAIGN_AUDIENCE_OPTIONS,
  type CampaignAudience,
} from "@/lib/email/campaign-audience";

import {
  AUDIENCE_COUNT_FAILED_MESSAGE,
  audienceSummaryLine,
  fetchAudienceCount,
  isAbortError,
  settledCount,
  type CountedAudience,
} from "./campaign-audience-count";

export interface CampaignAudiencePickerProps {
  readonly value: CampaignAudience | null;
  readonly onChange: (audience: CampaignAudience) => void;
  /**
   * Absent on the new-campaign screen — there is no row to count against until
   * the draft is saved, so the picker records the choice and says so.
   */
  readonly campaignId?: string;
}

const SUMMARY_TONE_CLASS = {
  muted: "text-bs-fg-muted",
  error: "text-bs-danger",
  count: "font-medium text-bs-fg",
} as const;

export function CampaignAudiencePicker({
  value,
  onChange,
  campaignId,
}: CampaignAudiencePickerProps) {
  const [result, setResult] = useState<CountedAudience | null>(null);
  const [isCounting, setIsCounting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = value?.type ?? null;

  useEffect(() => {
    if (!campaignId || !selected) {
      setResult(null);
      setError(null);
      // Unconditional, so there is no path out of this effect that leaves a
      // spinner running with nothing behind it.
      setIsCounting(false);
      return;
    }

    // `cancelled` as well as the abort: a selection changed mid-flight starts a
    // fresh request immediately, and the old one's handlers must not put a
    // stale count — or a stale spinner — back on screen.
    let cancelled = false;
    const controller = new AbortController();
    setIsCounting(true);
    setError(null);

    fetchAudienceCount(campaignId, selected, controller.signal)
      .then((count) => {
        if (cancelled) return;
        // Tagged with the audience it answers, so `settledCount` can refuse it
        // the moment the selection moves on.
        setResult({ ...count, type: selected });
      })
      .catch((cause: unknown) => {
        if (cancelled || isAbortError(cause)) return;
        setResult(null);
        setError(
          cause instanceof Error ? cause.message : AUDIENCE_COUNT_FAILED_MESSAGE,
        );
      })
      .finally(() => {
        if (!cancelled) setIsCounting(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [campaignId, selected]);

  const summary = audienceSummaryLine({
    hasSelection: selected !== null,
    hasCampaign: Boolean(campaignId),
    isCounting,
    error,
    // Never the previous audience's figure: a count for an audience that is no
    // longer selected is discarded here rather than rendered next to the
    // radio the author has just ticked.
    result: settledCount(result, selected),
  });

  return (
    <section className="shrink-0 rounded-bs-md border border-bs-border-100 bg-bs-card-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Users className="h-4 w-4 shrink-0 text-bs-fg-muted" aria-hidden="true" />
        <span className="bs-eyebrow">Audience</span>
        <span className="ml-auto flex items-center gap-1.5 text-sm" aria-live="polite">
          {isCounting && (
            <Loader2
              className="h-3.5 w-3.5 animate-spin text-bs-fg-muted"
              aria-hidden="true"
            />
          )}
          <span className={SUMMARY_TONE_CLASS[summary.tone]}>{summary.text}</span>
        </span>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {CAMPAIGN_AUDIENCE_OPTIONS.map((option) => (
          <label
            key={option.type}
            className={`flex cursor-pointer gap-2.5 rounded-bs-md border p-3 ${
              selected === option.type
                ? "border-bs-green/40 bg-bs-green/10"
                : "border-bs-border-100"
            }`}
          >
            <input
              type="radio"
              name="campaign-audience"
              value={option.type}
              checked={selected === option.type}
              onChange={() => onChange({ type: option.type })}
              className="mt-0.5"
            />
            <span className="space-y-1">
              <span className="block text-sm font-medium text-bs-fg">
                {option.label}
              </span>
              <span className="block text-xs text-bs-fg-muted">
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}

