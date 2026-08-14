"use client";

import { useState } from "react";
import { ArrowRight, Check, Loader2, Trash2, X } from "lucide-react";

import { SEO_REDIRECT_MAX_PATH_LENGTH } from "@/lib/seo/redirects";

/**
 * SEO Supercharge US-020 — one stored redirect, with its destination editable
 * in place.
 *
 * `fromPath` is NOT editable, here or on the API. Changing which path a rule
 * claims is not an edit: the old path stops redirecting and a new one starts,
 * and hiding that inside what looks like a tweak is how a live redirect
 * disappears without anyone deciding to remove it. Delete and re-add makes both
 * halves visible.
 */

export interface RedirectRow {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  /** ISO string — serialised across the server/client boundary, never a Date. */
  createdAt: string;
}

interface RedirectRowItemProps {
  row: RedirectRow;
  busy: boolean;
  onRetarget: (id: string, toPath: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<void>;
}

export function RedirectRowItem({
  row,
  busy,
  onRetarget,
  onDelete,
}: RedirectRowItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row.toPath);
  const [saving, setSaving] = useState(false);

  const startEditing = () => {
    setDraft(row.toPath);
    setEditing(true);
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // The parent owns the error banner and the row state; it reports back
      // only whether the edit stuck, so a rejected path keeps the input open
      // with the owner's text still in it.
      if (await onRetarget(row.id, draft)) setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-3">
      <div className="min-w-0 flex items-center gap-2 font-mono text-xs text-bs-fg flex-1">
        <span className="truncate" title={row.fromPath}>
          {row.fromPath}
        </span>
        <ArrowRight
          className="h-3 w-3 flex-shrink-0 text-bs-fg-muted"
          aria-hidden="true"
        />
        {editing ? (
          <input
            className="bs-input font-mono text-xs h-8 flex-1 min-w-0"
            value={draft}
            maxLength={SEO_REDIRECT_MAX_PATH_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            aria-label={`New destination for ${row.fromPath}`}
            autoFocus
          />
        ) : (
          <button
            type="button"
            className="truncate text-left underline decoration-dotted underline-offset-4"
            onClick={startEditing}
            title="Change where this redirect points"
          >
            {row.toPath}
          </button>
        )}
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-2 flex-shrink-0">
        <span className="bs-chip bs-chip-muted">{row.statusCode}</span>
        {editing ? (
          <>
            <button
              type="button"
              className="bs-btn bs-btn-ghost bs-btn-sm"
              onClick={save}
              disabled={saving}
              aria-label={`Save new destination for ${row.fromPath}`}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              className="bs-btn bs-btn-text bs-btn-sm"
              onClick={() => setEditing(false)}
              disabled={saving}
              aria-label="Cancel"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        ) : (
          <button
            type="button"
            className="bs-btn bs-btn-danger bs-btn-sm"
            onClick={() => onDelete(row.id)}
            disabled={busy}
            aria-label={`Delete redirect from ${row.fromPath}`}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
