"use client";

/**
 * US-013 — the composer's "Personalize" menu.
 *
 * The point of the story: an author picks "Customer name" from a list instead of
 * remembering that the variable is spelled `userName` and takes two braces on
 * each side. Everything the menu offers comes from
 * `lib/email/email-merge-tags.ts`, keyed by the event this template is mapped to,
 * so the tags on offer are the ones a send will actually carry a value for.
 *
 * The custom-tag field is the escape hatch for a variable this platform does not
 * know about yet — a send site can pass anything in its `variables` bag. It is
 * validated against the same rule the node applies, because whatever it produces
 * ends up inside `{{ }}` in HTML that `scripts/email-worker.ts` later compiles.
 */

import React, { useState } from "react";
import type { Editor } from "@tiptap/react";
import { Braces } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EMAIL_MERGE_TAG_NAME } from "@/lib/email/email-merge-tag-node";
import {
  mergeTagGroupsForEvent,
  mergeTagText,
  normaliseMergeTagName,
} from "@/lib/email/email-merge-tags";

const CUSTOM_TAG_INVALID =
  "Use letters, numbers and underscores only — for example order_reference.";

export interface EmailMergeTagMenuProps {
  readonly editor: Editor;
  /** The event this template is mapped to, if any. Selects the extra tags. */
  readonly eventType?: string | null;
}

/** Insert one chip at the caret. One path, so both entry points behave alike. */
function insertMergeTag(editor: Editor, tag: string) {
  editor
    .chain()
    .focus()
    .insertContent({ type: EMAIL_MERGE_TAG_NAME, attrs: { tag } })
    .run();
}

function CustomTagDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (tag: string) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const tag = normaliseMergeTagName(value);
    if (!tag) {
      setError(CUSTOM_TAG_INVALID);
      return;
    }
    onSubmit(tag);
    setValue("");
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bs-dialog-content sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="text-bs-fg">Add a custom tag</DialogTitle>
            <DialogDescription className="text-bs-fg-muted">
              For a value this platform does not list. It is replaced when the
              email is sent, and left blank if the send has no value for it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label htmlFor="merge-tag-name" className="bs-eyebrow">
              Tag name
            </label>
            <input
              id="merge-tag-name"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              placeholder="order_reference"
              autoComplete="off"
              className="bs-input w-full font-mono"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "merge-tag-error" : undefined}
            />
            {error && (
              <p id="merge-tag-error" className="text-xs text-bs-danger">
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
              Add tag
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EmailMergeTagMenu({ editor, eventType }: EmailMergeTagMenuProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const groups = mergeTagGroupsForEvent(eventType);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="Insert a value that changes for each recipient"
            className="bs-btn bs-btn-ghost bs-btn-sm"
          >
            <Braces className="h-4 w-4" /> <span>Personalize</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-96 w-64 overflow-y-auto">
          {groups.map((group) => (
            <React.Fragment key={group.category}>
              <DropdownMenuLabel className="bs-eyebrow">
                {group.category}
              </DropdownMenuLabel>
              {group.tags.map((tag) => (
                <DropdownMenuItem
                  key={`${group.category}:${tag.name}`}
                  onSelect={() => insertMergeTag(editor, tag.name)}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span>{tag.label}</span>
                  <span className="font-mono text-[10px] text-bs-fg-muted">
                    {mergeTagText(tag.name)}
                  </span>
                </DropdownMenuItem>
              ))}
            </React.Fragment>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCustomOpen(true)}>
            Custom tag…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CustomTagDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        onSubmit={(tag) => {
          insertMergeTag(editor, tag);
          setCustomOpen(false);
        }}
      />
    </>
  );
}
