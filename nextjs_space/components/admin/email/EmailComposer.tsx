"use client";

/**
 * US-012 — the visual email editor.
 *
 * Fetch-free by design: everything it needs arrives as props and everything it
 * produces leaves as a callback, so the same component serves the tenant-admin
 * and super-admin screens without either of them being special-cased. It edits
 * one thing — the message body — and knows nothing about templates, tenants or
 * saving.
 *
 * WHAT IT PRODUCES is a TipTap document, never HTML. The HTML an inbox receives
 * is derived server-side by `lib/email/email-render-pipeline.ts` from the
 * document this writes, using the SAME extension set
 * (`lib/email/editor-extensions.ts`). That is the only reason a stored document
 * can be re-opened here and re-rendered there without drifting.
 *
 * NOT `components/editor/tiptap.tsx`. That editor writes HTML for a web page and
 * belongs to The Wire; this one writes JSON for an inbox. They answer to
 * different constraints and are deliberately kept apart.
 */

import React from "react";
import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";

import { emailEditorExtensions } from "@/lib/email/editor-extensions";
import { EMAIL_BODY_CLASS, EMAIL_BODY_CSS } from "@/lib/email/email-body-css";
import { EMAIL_BUTTON_BACKGROUND_COLOR } from "@/lib/email/email-button-node";
import type { EmailContentJson } from "@/lib/email/email-content-json";

import { EMPTY_EMAIL_DOC } from "./email-editor-mode";
import { EmailComposerToolbar } from "./EmailComposerToolbar";

/**
 * Mirrors the content styles in `emails/email-shell.tsx`, which cannot be
 * imported here — that module pulls in react-email. Presentation only: nothing
 * below reaches the sent message, which is styled by the shell and
 * `EMAIL_BODY_CSS`.
 */
const COMPOSER_TEXT_COLOR = "#1f2937";
const COMPOSER_FONT_STACK = "Helvetica, Arial, sans-serif";

/**
 * Rules that belong to the EDITOR only.
 *
 * List markers are here rather than in `EMAIL_BODY_CSS` on purpose: Tailwind's
 * preflight strips them in the admin, while an inbox applies its own defaults —
 * and `list-style` is not on the sanitizer's allow-list, so adding it to the
 * shared sheet would inline a declaration into every email that then gets
 * dropped. Editor chrome stays in the editor.
 */
const COMPOSER_CSS = `
.${EMAIL_BODY_CLASS} { font-family: ${COMPOSER_FONT_STACK}; color: ${COMPOSER_TEXT_COLOR}; }
.${EMAIL_BODY_CLASS}:focus { outline: none; }
.${EMAIL_BODY_CLASS} ul { list-style: disc; }
.${EMAIL_BODY_CLASS} ol { list-style: decimal; }
.${EMAIL_BODY_CLASS} .ProseMirror-selectednode { outline: 2px solid ${EMAIL_BUTTON_BACKGROUND_COLOR}; outline-offset: 2px; }
`;

export interface EmailComposerProps {
  /** The stored document, or null for a body that has never been written. */
  readonly value: EmailContentJson | null;
  /** Fires on every edit with the whole document. */
  readonly onChange: (doc: EmailContentJson) => void;
  readonly editable?: boolean;
}

/**
 * A ProseMirror root is always a `doc`; TipTap types `getJSON()` loosely because
 * a document node is not special-cased in its types. Stating it here is what
 * lets the value be handed straight to the save payload.
 */
function toEmailContentJson(json: JSONContent): EmailContentJson {
  return { type: "doc", content: json.content };
}

export function EmailComposer({
  value,
  onChange,
  editable = true,
}: EmailComposerProps) {
  const editor = useEditor({
    extensions: emailEditorExtensions(),
    // Set once, on mount. `value` is not pushed back in on later renders: the
    // editor owns the live document while it is open, and re-seeding it from a
    // prop that it just produced would fight the caret on every keystroke.
    content: value ?? EMPTY_EMAIL_DOC,
    editable,
    // Required under the App Router: rendering the editor during SSR mismatches.
    immediatelyRender: false,
    onUpdate: ({ editor: instance }) =>
      onChange(toEmailContentJson(instance.getJSON())),
    editorProps: {
      attributes: {
        class: `${EMAIL_BODY_CLASS} min-h-[320px] px-8 py-6`,
      },
    },
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <style>{`${EMAIL_BODY_CSS}${COMPOSER_CSS}`}</style>
      {editable && editor && <EmailComposerToolbar editor={editor} />}
      <div className="flex-1 overflow-auto bg-bs-canvas p-4">
        <div className="mx-auto w-full max-w-[600px] rounded bg-white shadow-sm">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  );
}

export default EmailComposer;
