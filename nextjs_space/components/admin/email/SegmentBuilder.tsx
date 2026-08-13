"use client";

/**
 * US-025 — writing a saved audience rule, and seeing who it reaches while you
 * write it.
 *
 * The count is asked of the server on every settled edit rather than computed
 * here: it is the live intersection of this store's customers, their orders,
 * their tags, their consent and the suppression list, and the browser is given
 * only the numbers. The same trade the audience picker makes, for the same
 * reason — an author needs a figure, not a mailing list.
 *
 * The criteria list is allowed to be half-written while it is being typed into.
 * `readySegmentFilter` — the server's own parser — is what decides when it has
 * become a rule, so the save button and the count agree with the API by
 * construction rather than by a second opinion kept in step by hand.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Users, X } from "lucide-react";

import { TAG_MAX_LENGTH } from "@/lib/customers/tag-format";
import {
  SEGMENT_CRITERION_OPTIONS,
  SEGMENT_NAME_MAX,
  type SegmentCriterion,
  type SegmentCriterionKind,
  type SegmentSummary,
} from "@/lib/email/segment-filter";

import {
  defaultCriterion,
  fetchSegmentCount,
  findCriterion,
  readySegmentFilter,
  segmentCountLine,
  withCriterion,
  withoutCriterion,
  type SegmentCount,
} from "./segment-client";
import { isAbortError } from "./campaign-audience-count";

/** Long enough that a held-down arrow key is one request, not thirty. */
const COUNT_DEBOUNCE_MS = 400;

const TONE_CLASS = {
  muted: "text-bs-fg-muted",
  error: "text-bs-danger",
  count: "font-medium text-bs-fg",
} as const;

/** What the builder hands back to a save — criteria, not a parsed rule. */
export interface SegmentDraft {
  readonly name: string;
  readonly criteria: readonly SegmentCriterion[];
}

export interface SegmentBuilderProps {
  /** Absent when writing a new segment. */
  readonly initial?: SegmentSummary | null;
  readonly onSave: (draft: SegmentDraft) => Promise<void>;
  readonly onCancel: () => void;
  readonly isSaving?: boolean;
}

export function SegmentBuilder({
  initial,
  onSave,
  onCancel,
  isSaving = false,
}: SegmentBuilderProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [criteria, setCriteria] = useState<SegmentCriterion[]>(() => [
    ...(initial?.filter?.criteria ?? []),
  ]);
  const [result, setResult] = useState<SegmentCount | null>(null);
  const [isCounting, setIsCounting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `null` while the criteria are still half-written, which is also the signal
  // to ask nobody anything: an unreadable rule has no count.
  const filter = useMemo(() => readySegmentFilter(criteria), [criteria]);

  useEffect(() => {
    if (!filter) {
      setResult(null);
      setError(null);
      // Unconditional, so no path out of this effect leaves a spinner running
      // with nothing behind it.
      setIsCounting(false);
      return;
    }

    // `cancelled` as well as the abort: an edit mid-flight starts a fresh
    // request, and the old one's handlers must not put a stale count — or a
    // stale spinner — back on screen.
    let cancelled = false;
    const controller = new AbortController();
    setIsCounting(true);
    setError(null);

    // Debounced, not fired per keystroke: this is an unbounded customer read
    // plus up to three more queries, and "60" is typed one digit at a time.
    const timer = setTimeout(() => {
      fetchSegmentCount(filter, controller.signal)
        .then((count) => {
          if (!cancelled) setResult(count);
        })
        .catch((cause: unknown) => {
          if (cancelled || isAbortError(cause)) return;
          setResult(null);
          setError(cause instanceof Error ? cause.message : null);
        })
        .finally(() => {
          if (!cancelled) setIsCounting(false);
        });
    }, COUNT_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [filter]);

  const summary = segmentCountLine({
    hasRule: filter !== null,
    isCounting,
    error,
    result,
  });

  const canSave = Boolean(name.trim()) && filter !== null && !isSaving;

  const toggle = (kind: SegmentCriterionKind, on: boolean) => {
    setCriteria((current) =>
      on
        ? withCriterion(current, defaultCriterion(kind))
        : withoutCriterion(current, kind),
    );
  };

  const replace = (criterion: SegmentCriterion) => {
    setCriteria((current) => withCriterion(current, criterion));
  };

  return (
    <div className="space-y-4 rounded-bs-md border border-bs-border-100 bg-bs-card-2 p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1 space-y-2">
          <label htmlFor="segment-name" className="bs-eyebrow">
            Segment name
          </label>
          <input
            id="segment-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Reorder — 60 days"
            // The server's cap at the keyboard: over it, the schema rejects the
            // save as a bare "Invalid request", which nobody can act on.
            maxLength={SEGMENT_NAME_MAX}
            className="bs-input w-full"
          />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="bs-btn bs-btn-ghost">
            <X className="h-4 w-4" /> <span>Cancel</span>
          </button>
          <button
            type="button"
            onClick={() => onSave({ name: name.trim(), criteria })}
            disabled={!canSave}
            className="bs-btn bs-btn-green"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" /> <span>Save segment</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {SEGMENT_CRITERION_OPTIONS.map((option) => (
          <CriterionRow
            key={option.kind}
            option={option}
            criterion={findCriterion(criteria, option.kind)}
            onToggle={(on) => toggle(option.kind, on)}
            onChange={replace}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-bs-border-100 pt-3">
        <Users className="h-4 w-4 shrink-0 text-bs-fg-muted" aria-hidden="true" />
        <span className="flex items-center gap-1.5 text-sm" aria-live="polite">
          {isCounting && (
            <Loader2
              className="h-3.5 w-3.5 animate-spin text-bs-fg-muted"
              aria-hidden="true"
            />
          )}
          <span className={TONE_CLASS[summary.tone]}>{summary.text}</span>
        </span>
      </div>
    </div>
  );
}

interface CriterionRowProps {
  readonly option: (typeof SEGMENT_CRITERION_OPTIONS)[number];
  readonly criterion: SegmentCriterion | undefined;
  readonly onToggle: (on: boolean) => void;
  readonly onChange: (criterion: SegmentCriterion) => void;
}

/** One axis: a checkbox, its explanation, and its argument when it has one. */
function CriterionRow({ option, criterion, onToggle, onChange }: CriterionRowProps) {
  const checked = criterion !== undefined;
  const inputId = `segment-criterion-${option.kind}`;

  return (
    <div
      className={`rounded-bs-md border p-3 ${
        checked ? "border-bs-green/40 bg-bs-green/10" : "border-bs-border-100"
      }`}
    >
      <label className="flex cursor-pointer gap-2.5" htmlFor={inputId}>
        <input
          id={inputId}
          type="checkbox"
          checked={checked}
          onChange={(event) => onToggle(event.target.checked)}
          className="mt-0.5"
        />
        <span className="space-y-1">
          <span className="block text-sm font-medium text-bs-fg">{option.label}</span>
          <span className="block text-xs text-bs-fg-muted">{option.description}</span>
        </span>
      </label>

      {checked && option.value && criterion && (
        <div className="mt-2 flex items-center gap-2 pl-7">
          <input
            type="number"
            min={option.value.min}
            max={option.value.max}
            value={criterionNumber(criterion)}
            onChange={(event) =>
              onChange(withNumber(criterion, Number(event.target.value)))
            }
            aria-label={`${option.label} (${option.value.unit})`}
            className="bs-input w-24"
          />
          <span className="text-xs text-bs-fg-muted">{option.value.unit}</span>
        </div>
      )}

      {checked && option.takesTag && criterion?.kind === "has-tag" && (
        <div className="mt-2 pl-7">
          <input
            type="text"
            value={criterion.tag}
            onChange={(event) =>
              onChange({ kind: "has-tag", tag: event.target.value })
            }
            placeholder="vip"
            maxLength={TAG_MAX_LENGTH}
            aria-label="Tag"
            className="bs-input w-full max-w-xs"
          />
        </div>
      )}
    </div>
  );
}

/** The numeric argument of the two axes that take one. `""` clears the box. */
function criterionNumber(criterion: SegmentCriterion): number | string {
  if (criterion.kind === "last-order-age") {
    return Number.isFinite(criterion.days) ? criterion.days : "";
  }
  if (criterion.kind === "order-count-min") {
    return Number.isFinite(criterion.count) ? criterion.count : "";
  }
  return "";
}

/**
 * The same criterion with a new number — NaN included.
 *
 * A cleared box has to be representable: refusing the edit would trap the
 * cursor behind a digit the author is trying to replace. The rule simply stops
 * being readable until a number is back, and the save button follows.
 */
function withNumber(criterion: SegmentCriterion, value: number): SegmentCriterion {
  if (criterion.kind === "last-order-age") return { kind: criterion.kind, days: value };
  if (criterion.kind === "order-count-min") {
    return { kind: criterion.kind, count: value };
  }
  return criterion;
}
