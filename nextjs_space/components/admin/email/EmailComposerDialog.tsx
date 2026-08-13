"use client";

/**
 * US-012 — the one form the composer's link, image and button tools all use.
 *
 * Three tools ask the same two questions ("where does this point?" and "what
 * does it say?"), so they share one dialog rather than three near-identical
 * ones. `window.prompt` — what `components/editor/tiptap.tsx` uses for images —
 * is not an option here: this editor is aimed at an admin who is not expected to
 * know what a URL scheme is, so the field needs a label, a placeholder and an
 * error message.
 */

import React, { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ComposerDialogValues {
  readonly url: string;
  readonly text: string;
}

export interface EmailComposerDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly urlLabel: string;
  readonly urlPlaceholder: string;
  /** Omit to hide the second field entirely (the link tool has no label). */
  readonly textLabel?: string;
  readonly textPlaceholder?: string;
  readonly submitLabel: string;
  readonly initialValues: ComposerDialogValues;
  readonly onSubmit: (values: ComposerDialogValues) => void;
  readonly onOpenChange: (open: boolean) => void;
  /**
   * US-014 — rendered above the fields, separated by an "or". The image tool
   * puts its upload control here; the link and button tools pass nothing and
   * the divider disappears with it, so this file needs no idea what an upload
   * is.
   */
  readonly children?: React.ReactNode;
}

/**
 * Client-side URL check. The authority is the sanitizer's `allowedSchemes`,
 * which runs server-side over the finished document and would drop anything
 * else; this exists so the author is told rather than watching their link
 * silently not arrive. A scheme-less value is allowed through — that is how a
 * merge tag (`{{resetLink}}`) is typed.
 */
const BLOCKED_SCHEME = /^\s*(?:javascript|data|vbscript|file):/i;

const URL_REQUIRED = "Enter a web address.";
const URL_BLOCKED = "That kind of address cannot be used in an email.";

function urlError(url: string): string | null {
  if (!url.trim()) return URL_REQUIRED;
  if (BLOCKED_SCHEME.test(url)) return URL_BLOCKED;
  return null;
}

export function EmailComposerDialog({
  open,
  title,
  description,
  urlLabel,
  urlPlaceholder,
  textLabel,
  textPlaceholder,
  submitLabel,
  initialValues,
  onSubmit,
  onOpenChange,
  children,
}: EmailComposerDialogProps) {
  const [url, setUrl] = useState(initialValues.url);
  const [text, setText] = useState(initialValues.text);
  const [error, setError] = useState<string | null>(null);

  // Re-seed on open: the same dialog instance serves every tool, and each one
  // opens with either its own defaults or the values of the selected node.
  useEffect(() => {
    if (!open) return;
    setUrl(initialValues.url);
    setText(initialValues.text);
    setError(null);
  }, [open, initialValues.url, initialValues.text]);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const problem = urlError(url);
    if (problem) {
      setError(problem);
      return;
    }
    onSubmit({ url: url.trim(), text: text.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bs-dialog-content sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-bs-fg">{title}</DialogTitle>
            <DialogDescription className="text-bs-fg-muted">
              {description}
            </DialogDescription>
          </DialogHeader>

          {children && (
            <>
              {children}
              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-bs-border-100" />
                <span className="text-xs uppercase text-bs-fg-muted">or</span>
                <span className="h-px flex-1 bg-bs-border-100" />
              </div>
            </>
          )}

          {textLabel && (
            <div className="space-y-2">
              <label htmlFor="composer-text" className="bs-eyebrow">
                {textLabel}
              </label>
              <input
                id="composer-text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={textPlaceholder}
                className="bs-input w-full"
              />
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="composer-url" className="bs-eyebrow">
              {urlLabel}
            </label>
            <input
              id="composer-url"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setError(null);
              }}
              placeholder={urlPlaceholder}
              autoComplete="off"
              className="bs-input w-full"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "composer-url-error" : undefined}
            />
            {error && (
              <p id="composer-url-error" className="text-xs text-bs-danger">
                {error}
              </p>
            )}
          </div>

          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="bs-btn bs-btn-ghost"
            >
              Cancel
            </button>
            <button type="submit" className="bs-btn bs-btn-green">
              {submitLabel}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
