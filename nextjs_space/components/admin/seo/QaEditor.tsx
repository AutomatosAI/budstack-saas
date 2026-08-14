"use client";

/**
 * LLM Visibility US-002 — the Q&A section of the product SEO editor.
 *
 * WHAT IT WRITES, and where it lands: `products.seo.qa`, a key in the same
 * authored record as the title and description (`lib/seo/entity-seo.ts`). No new
 * column, and nothing here is stored per-question.
 *
 * THE LOCK IS PRESENTATION, and like `IndexingFields` it HAS a server gate
 * underneath it: the product SEO PUT 403s `upgrade_required` when a Basic tenant
 * sends `qa` (`hasQaField` + `featureDenial`). The Basic arm therefore sends
 * nothing, which is also what stops a save from erasing pairs written while the
 * tenant was on Pro — those stay stored and dormant, and the card says so.
 *
 * THE COPY IS HONEST ABOUT WHAT THIS BUYS. Answer engines read a question and
 * its answer, and `FAQPage` markup is the machine-readable form of exactly that
 * — but nobody, including us, can promise that writing five questions gets a
 * store cited in an AI answer. The section says what it DOES (publishes the
 * questions on the page and in the schema) and never that it will be quoted.
 *
 * IMMUTABLE UPDATES throughout: every edit builds a new array and hands it to
 * `onChange`. The parent modal owns the state, so nothing here mutates a value
 * another render is still holding.
 */

import { Plus, Sparkles, Trash2, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AUTOMATOS_CONNECT } from "@/lib/seo/ai-assist-contract";
import { SEO_PRO_FEATURES } from "@/lib/seo/pro-features";
import {
  PRODUCT_QA_LIMITS,
  type ProductQaPair,
} from "@/lib/seo/product-qa";
import { LockedFeatureCard } from "./LockedFeatureCard";
import { requestQaDraft } from "./qa-draft-client";

const QA_FEATURE = SEO_PRO_FEATURES.find((feature) => feature.id === "product-qa");

/** One empty row — an added question the owner has not typed into yet. */
const EMPTY_PAIR: ProductQaPair = { question: "", answer: "" };

interface QaEditorProps {
  value: readonly ProductQaPair[];
  onChange: (pairs: readonly ProductQaPair[]) => void;
  /** US-013's `seoProUnlocked`, resolved server-side from `tenants.plan`. */
  canEdit: boolean;
  /** The product the draft is written FROM — the server reads it, never the client. */
  entityId: string;
  /** Pro AND connected: whether to offer the draft button at all. */
  showDraftButton: boolean;
  /** The tenant has no Automatos account — the modal shows the connect card. */
  onUnavailable: () => void;
  disabled?: boolean;
}

function swap(
  pairs: readonly ProductQaPair[],
  index: number,
  target: number,
): readonly ProductQaPair[] {
  if (target < 0 || target >= pairs.length) return pairs;
  return pairs.map((pair, position) => {
    if (position === index) return pairs[target];
    if (position === target) return pairs[index];
    return pair;
  });
}

export function QaEditor({
  value,
  onChange,
  canEdit,
  entityId,
  showDraftButton,
  onUnavailable,
  disabled = false,
}: QaEditorProps) {
  const [isDrafting, setIsDrafting] = useState(false);

  if (!canEdit) {
    return (
      <div className="space-y-2">
        <LockedFeatureCard
          locked
          title="Product Q&A"
          valueProp={
            QA_FEATURE?.valueProp ??
            "Answer the questions buyers ask, on the product page and in the FAQ schema answer engines read."
          }
        />
        {value.length > 0 && (
          <p className="text-xs text-bs-fg-muted">
            This product has {value.length}{" "}
            {value.length === 1 ? "question" : "questions"} saved from Pro. They
            are not being published on your current plan, and saving here will
            not delete them.
          </p>
        )}
      </div>
    );
  }

  const atLimit = value.length >= PRODUCT_QA_LIMITS.maxPairs;

  const update = (index: number, patch: Partial<ProductQaPair>) => {
    onChange(
      value.map((pair, position) =>
        position === index ? { ...pair, ...patch } : pair,
      ),
    );
  };

  const handleDraft = async () => {
    setIsDrafting(true);
    try {
      const outcome = await requestQaDraft(entityId);

      if (outcome.ok) {
        // REPLACES the list rather than appending to it: the draft is a set of
        // questions about this product, and merging it into rows already there
        // is how an owner ends up with the same question twice. Nothing is
        // saved — the rows are editable and the save button is still the only
        // writer.
        onChange(outcome.pairs.slice(0, PRODUCT_QA_LIMITS.maxPairs));
        toast.success(
          `Drafted ${outcome.pairs.length} ${outcome.pairs.length === 1 ? "question" : "questions"} — review them before saving`,
        );
        return;
      }

      if (outcome.unavailable) {
        onUnavailable();
        return;
      }

      toast.error(outcome.error);
    } finally {
      setIsDrafting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <span className="bs-eyebrow">Questions &amp; Answers</span>
          <p className="mt-1.5 text-xs text-bs-fg-muted">
            The questions buyers actually ask about this product. They render on
            the product page and as FAQ structured data, which is the form search
            and AI answer engines read. It makes your answers readable to them —
            it is not a guarantee of being cited.
          </p>
        </div>
        {showDraftButton && (
          <button
            type="button"
            onClick={handleDraft}
            disabled={disabled || isDrafting}
            aria-label={`Draft Q&A with ${AUTOMATOS_CONNECT.provider}`}
            className="bs-btn bs-btn-ghost bs-btn-sm shrink-0 text-[11px] disabled:opacity-50"
          >
            {isDrafting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>
              {isDrafting
                ? "Drafting..."
                : `Draft Q&A with ${AUTOMATOS_CONNECT.provider}`}
            </span>
          </button>
        )}
      </div>

      {value.length === 0 && (
        <p className="text-xs text-bs-fg-muted">
          No questions yet. Add up to {PRODUCT_QA_LIMITS.maxPairs}.
        </p>
      )}

      {value.map((pair, index) => (
        <div
          key={index}
          className="space-y-2 rounded-bs-md border border-bs-border-100 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wide text-bs-fg-muted">
              Question {index + 1}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onChange(swap(value, index, index - 1))}
                disabled={disabled || index === 0}
                aria-label={`Move question ${index + 1} up`}
                className="bs-btn bs-btn-text h-7 px-1.5 disabled:opacity-30"
              >
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onChange(swap(value, index, index + 1))}
                disabled={disabled || index === value.length - 1}
                aria-label={`Move question ${index + 1} down`}
                className="bs-btn bs-btn-text h-7 px-1.5 disabled:opacity-30"
              >
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange(value.filter((_, position) => position !== index))
                }
                disabled={disabled}
                aria-label={`Remove question ${index + 1}`}
                className="bs-btn bs-btn-text h-7 px-1.5 text-bs-danger disabled:opacity-30"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          <input
            value={pair.question}
            onChange={(event) => update(index, { question: event.target.value })}
            placeholder="Is this strain good for evening use?"
            maxLength={PRODUCT_QA_LIMITS.maxQuestionLength}
            disabled={disabled}
            aria-label={`Question ${index + 1}`}
            className="bs-input w-full"
          />
          <textarea
            value={pair.answer}
            onChange={(event) => update(index, { answer: event.target.value })}
            placeholder="Answer in a sentence or two, using facts you can stand behind."
            rows={3}
            maxLength={PRODUCT_QA_LIMITS.maxAnswerLength}
            disabled={disabled}
            aria-label={`Answer ${index + 1}`}
            className="bs-input w-full resize-y py-2"
          />
          <p className="text-[10px] text-bs-fg-muted">
            {pair.question.length}/{PRODUCT_QA_LIMITS.maxQuestionLength} question
            · {pair.answer.length}/{PRODUCT_QA_LIMITS.maxAnswerLength} answer
          </p>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...value, EMPTY_PAIR])}
        disabled={disabled || atLimit}
        className="bs-btn bs-btn-ghost bs-btn-sm disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Add question</span>
      </button>
      {atLimit && (
        <p className="text-xs text-bs-fg-muted">
          {PRODUCT_QA_LIMITS.maxPairs} is the maximum. Remove one to add another.
        </p>
      )}
    </div>
  );
}
