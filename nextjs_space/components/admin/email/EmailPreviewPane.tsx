"use client";

/**
 * US-015 — the preview pane.
 *
 * It renders NOTHING itself. The email in the iframe is whatever
 * `POST .../email-templates/preview` returned, which is the save pipeline's own
 * output with sample values filled in (`lib/email/email-preview.ts`). The
 * browser cannot reproduce that — the shell needs react-email, inlining needs
 * juice, and the sanitizer is a security boundary — so an approximation here
 * would be a second pipeline drifting from the one that reaches an inbox.
 *
 * The iframe keeps the sandbox it had before this story. Everything in it has
 * been through `sanitizeEmailHtml`, and without `allow-scripts` nothing in it
 * runs; the attribute is the belt to the sanitizer's braces.
 */

import React, { useEffect, useState } from "react";
import { Eye, Loader2, Monitor, Smartphone } from "lucide-react";

import { Toggle } from "@/components/ui/toggle";

import {
  DEFAULT_EMAIL_PREVIEW_WIDTH,
  EMAIL_PREVIEW_DEBOUNCE_MS,
  EMAIL_PREVIEW_FAILED_MESSAGE,
  EMAIL_PREVIEW_WIDTHS,
  emailPreviewErrorMessage,
  type EmailPreviewRequest,
  type EmailPreviewWidth,
} from "./email-preview-request";

const WIDTH_ICONS: Record<
  EmailPreviewWidth,
  React.ComponentType<{ className?: string }>
> = { 375: Smartphone, 800: Monitor };

export interface EmailPreviewPaneProps {
  /** The preview endpoint for this screen (tenant-admin or super-admin). */
  readonly url: string;
  /** The content to preview, rebuilt by the editor on every change. */
  readonly request: EmailPreviewRequest;
}

export function EmailPreviewPane({ url, request }: EmailPreviewPaneProps) {
  const [width, setWidth] = useState<EmailPreviewWidth>(
    DEFAULT_EMAIL_PREVIEW_WIDTH,
  );
  const [html, setHtml] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // The serialised body, not the object: the editor rebuilds `request` on every
  // render, so depending on its identity would refetch when nothing changed.
  const body = JSON.stringify(request);

  useEffect(() => {
    const controller = new AbortController();

    const timer = setTimeout(() => {
      setIsLoading(true);
      void (async () => {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
            signal: controller.signal,
          });
          const payload = await res.json().catch(() => null);
          if (!res.ok) throw new Error(emailPreviewErrorMessage(payload));
          setHtml(typeof payload?.html === "string" ? payload.html : "");
          setError(null);
        } catch (err) {
          // Aborted means a newer edit owns the pane now — its result, and its
          // error if it has one, is the one the author should be looking at.
          if (controller.signal.aborted) return;
          setError(
            err instanceof Error ? err.message : EMAIL_PREVIEW_FAILED_MESSAGE,
          );
        } finally {
          if (!controller.signal.aborted) setIsLoading(false);
        }
      })();
    }, EMAIL_PREVIEW_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [url, body]);

  return (
    <div className="flex h-full flex-col bg-bs-canvas">
      <div className="flex items-center justify-between gap-2 border-b border-bs-border-100 bg-bs-card-2 p-2">
        <span className="flex items-center font-mono text-xs uppercase tracking-wide text-bs-fg-muted">
          <Eye className="mr-1 h-3 w-3" aria-hidden="true" /> Preview
          {isLoading && (
            <Loader2
              className="ml-2 h-3 w-3 animate-spin"
              aria-label="Updating preview"
            />
          )}
        </span>
        <div className="flex items-center gap-1">
          {EMAIL_PREVIEW_WIDTHS.map(({ value, label }) => {
            const Icon = WIDTH_ICONS[value];
            return (
              <Toggle
                key={value}
                size="sm"
                pressed={width === value}
                onPressedChange={() => setWidth(value)}
                aria-label={`${label} width (${value}px)`}
                title={`${label} — ${value}px`}
              >
                <Icon className="h-4 w-4" />
              </Toggle>
            );
          })}
        </div>
      </div>

      {/*
        A banner, not a replacement. The server refuses the same things a save
        refuses (a document it cannot render, one over the size cap), and an
        author mid-edit trips those transiently — blanking the pane every time
        would hide the last good render exactly when it is the useful reference.
      */}
      {error && (
        <p className="mx-4 mt-4 rounded-bs-md border border-bs-border-100 bg-bs-card-2 p-3 text-sm text-bs-fg-muted">
          {error}
        </p>
      )}

      <div className="flex-1 overflow-auto p-4">
        <div
          style={{ width }}
          className="mx-auto h-full min-h-[520px] overflow-hidden rounded bg-white shadow-sm"
        >
          <iframe
            srcDoc={html}
            className="h-full w-full border-0"
            title="Email preview"
            sandbox="allow-same-origin"
          />
        </div>
      </div>
    </div>
  );
}
