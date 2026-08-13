"use client";

/**
 * US-015 — the editing surface: whichever editor the mode selects, beside the
 * preview.
 *
 * Split out of `EmailEditor` so that component keeps its one job (deciding what
 * a save writes) and the layout keeps its own. The preview lives HERE, outside
 * both editors, because it is the same preview for both: US-012's visual
 * composer shows the author's document, the HTML pane shows their source, and
 * neither of those is the email that arrives — only the server's render is.
 *
 * No `previewUrl` (a screen with no preview endpoint wired) collapses to the
 * editor alone rather than showing a pane that can never load.
 */

import React from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import { EmailPreviewPane } from "./EmailPreviewPane";
import type { EmailPreviewRequest } from "./email-preview-request";

export interface EmailEditorPanesProps {
  readonly editor: React.ReactNode;
  readonly previewUrl?: string;
  readonly previewRequest: EmailPreviewRequest;
}

export function EmailEditorPanes({
  editor,
  previewUrl,
  previewRequest,
}: EmailEditorPanesProps) {
  if (!previewUrl) return <>{editor}</>;

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel defaultSize={55} minSize={30}>
        <div className="h-full border-r border-bs-border-100">{editor}</div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={45} minSize={25}>
        <EmailPreviewPane url={previewUrl} request={previewRequest} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
