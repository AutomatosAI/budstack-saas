"use client";

/**
 * SEO Supercharge US-025 — the one control that asks Automatos AI for a draft,
 * and the card shown to a Pro tenant who has not connected an account yet.
 *
 * A DRAFT, NEVER A SAVE. `onDraft` hands the text to whatever owns the field;
 * the value lands in the input as an ordinary editable string and the existing
 * save button is still the only thing that writes. That is the whole review step
 * — an AI sentence must pass a human before it reaches a search result.
 *
 * WHERE EACH STATE GOES. Loading is the button itself (spinner, disabled, so a
 * second click cannot spend another generation). Errors are a toast, as every
 * other async failure in this editor already is, because a message pinned under
 * one of three fields in a scrolling dialog is a message nobody sees. The
 * unavailable state is neither: it is hoisted to the caller through
 * `onUnavailable`, so the editor can replace ALL of its buttons with one
 * {@link AutomatosConnectCard} rather than repeat the same card three times.
 *
 * PRESENTATION ONLY. The route composes `canEditSeo` with
 * `requireFeature(SEO_PRO)` and re-reads the tenant's credentials on every call
 * — hiding this button grants nobody anything, and showing it grants nobody
 * anything either.
 */

import { useState } from "react";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  AUTOMATOS_CONNECT,
  type AiAssistEntityKind,
  type AiAssistKind,
} from "@/lib/seo/ai-assist-contract";
import { requestSeoDraft } from "./ai-assist-client";

/** What each field is called when the button describes itself to a reader. */
const FIELD_LABEL: Readonly<Record<AiAssistKind, string>> = {
  title: "meta title",
  description: "meta description",
  imageAlt: "image alt text",
};

interface AiAssistButtonProps {
  kind: AiAssistKind;
  entityType: AiAssistEntityKind;
  /** The row the draft is written FROM — the server reads it, never the client. */
  entityId: string;
  /** Receives the draft. The caller puts it in the field; nothing is saved. */
  onDraft: (text: string) => void;
  /** The tenant has no Automatos account — the caller shows the connect card. */
  onUnavailable: () => void;
  disabled?: boolean;
}

export function AiAssistButton({
  kind,
  entityType,
  entityId,
  onDraft,
  onUnavailable,
  disabled = false,
}: AiAssistButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleClick = async () => {
    setIsGenerating(true);
    try {
      const outcome = await requestSeoDraft({ kind, entityType, entityId });

      if (outcome.ok) {
        onDraft(outcome.text);
        toast.success(`Draft ${FIELD_LABEL[kind]} ready — review it before saving`);
        return;
      }

      if (outcome.unavailable) {
        onUnavailable();
        return;
      }

      toast.error(outcome.error);
    } finally {
      // In `finally` because the outcome branches all return: a thrown render
      // error must not leave the button spinning forever.
      setIsGenerating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isGenerating}
      aria-label={`Generate ${FIELD_LABEL[kind]} with ${AUTOMATOS_CONNECT.provider}`}
      className="bs-btn bs-btn-ghost bs-btn-sm shrink-0 text-[11px] disabled:opacity-50"
    >
      {isGenerating ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span>{isGenerating ? "Drafting..." : `Generate with ${AUTOMATOS_CONNECT.provider}`}</span>
    </button>
  );
}

/**
 * The Pro tenant who has not connected an account.
 *
 * DELIBERATELY NOT THE UPGRADE CARD. `LockedFeatureCard` sells Pro; this points
 * at a field in Settings. Whoever sees this has already bought the plan, and
 * sending them to a checkout for it is the one mistake this shape exists to
 * prevent (US-024).
 */
export function AutomatosConnectCard() {
  return (
    <section className="bs-card bs-card-pad flex flex-col gap-3" data-ai-assist="connect">
      <div className="bs-card-head mb-0">
        <div className="bs-card-icon">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="bs-card-title">{AUTOMATOS_CONNECT.headline}</h3>
        </div>
      </div>

      <p className="bs-card-desc">{AUTOMATOS_CONNECT.body}</p>

      <Link
        href={AUTOMATOS_CONNECT.settingsPath}
        className="bs-btn bs-btn-ghost bs-btn-sm self-start"
      >
        {AUTOMATOS_CONNECT.actionLabel}
      </Link>
    </section>
  );
}
