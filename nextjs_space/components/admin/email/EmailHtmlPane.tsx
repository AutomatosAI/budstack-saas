"use client";

/**
 * The raw-HTML editor — Advanced mode.
 *
 * Lifted out of `EmailEditor.tsx` unchanged when US-012 added the Simple tab, so
 * that component could hold the two modes without growing a second job. This is
 * the pre-US-012 experience exactly: an HTML source pane, a live preview of that
 * source, and the merge-tag reference.
 *
 * US-013 took the one thing that was NOT presentation out of it. The reference
 * list used to be a literal in this file; it now comes from
 * `lib/email/email-merge-tags.ts`, the same module the visual composer's
 * Personalize menu reads, so the two editors cannot offer different tags for the
 * same template.
 */

import React from "react";
import { Code, Eye, HelpCircle } from "lucide-react";
import { toast } from "sonner";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  EMAIL_TEMPLATE_HELPERS,
  EMAIL_TEMPLATE_HELPERS_CATEGORY,
  mergeTagGroupsForEvent,
} from "@/lib/email/email-merge-tags";

/**
 * The reference the HTML author sees: every tag the composer offers, plus the
 * block helpers — which only this pane lists, because they are half of a pair
 * and cannot be a chip.
 */
function referenceGroups(eventType?: string | null) {
  return [
    ...mergeTagGroupsForEvent(eventType).map((group) => ({
      category: group.category,
      vars: group.tags.map((tag) => tag.name),
    })),
    { category: EMAIL_TEMPLATE_HELPERS_CATEGORY, vars: [...EMAIL_TEMPLATE_HELPERS] },
  ];
}

function VariablesReference({ eventType }: { readonly eventType?: string | null }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="bs-btn bs-btn-ghost bs-btn-sm">
          <HelpCircle className="h-3 w-3" /> <span>Variables Reference</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none text-bs-fg">
              Available Variables
            </h4>
            <p className="text-xs text-bs-fg-muted">
              Click to copy common placeholders. Availability depends on the
              event.
            </p>
          </div>
          <div className="grid gap-3">
            {referenceGroups(eventType).map((group) => (
              <div key={group.category} className="space-y-1">
                <h5 className="bs-eyebrow">{group.category}</h5>
                <div className="flex flex-wrap gap-1.5">
                  {group.vars.map((variable) => (
                    <code
                      key={variable}
                      className="cursor-pointer rounded border border-bs-border-100 bg-bs-card-2 px-1.5 py-0.5 font-mono text-[10px] text-bs-fg transition-colors hover:bg-bs-card-3 sm:text-xs"
                      onClick={() => {
                        const text = `{{${variable}}}`;
                        navigator.clipboard.writeText(text);
                        toast.success(`Copied ${text}`);
                      }}
                    >
                      {`{{${variable}}}`}
                    </code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export interface EmailHtmlPaneProps {
  readonly value: string;
  readonly onChange: (html: string) => void;
  /** US-013 — the mapped event, which decides the tags the reference lists. */
  readonly eventType?: string | null;
}

export function EmailHtmlPane({
  value,
  onChange,
  eventType,
}: EmailHtmlPaneProps) {
  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={50} minSize={30}>
        <div className="flex h-full flex-col border-r border-bs-border-100">
          <div className="flex items-center justify-between border-b border-bs-border-100 bg-bs-card-2 p-2">
            <span className="flex items-center font-mono text-xs uppercase tracking-wide text-bs-fg-muted">
              <Code className="mr-1 h-3 w-3" /> HTML Source
            </span>
            <VariablesReference eventType={eventType} />
          </div>
          <textarea
            className="bs-input flex-1 resize-none rounded-none border-0 p-4 font-mono text-sm leading-relaxed focus-visible:ring-0"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="<html>...</html>"
          />
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={50} minSize={30}>
        <div className="flex h-full flex-col bg-bs-canvas">
          <div className="flex items-center justify-between border-b border-bs-border-100 bg-bs-card-2 p-2">
            <span className="flex items-center font-mono text-xs uppercase tracking-wide text-bs-fg-muted">
              <Eye className="mr-1 h-3 w-3" /> Live Preview
            </span>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-auto p-4">
            <div className="mx-auto h-full w-full max-w-[800px] overflow-hidden rounded bg-white shadow-sm">
              <iframe
                srcDoc={value}
                className="h-full w-full border-0"
                title="Email Preview"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
