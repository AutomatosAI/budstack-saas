"use client";

/**
 * US-012 — the composer's toolbar.
 *
 * Every control maps to something an email can actually express. There is no
 * font picker, no colour picker and no table tool: the shell
 * (`emails/email-shell.tsx`) owns typography and brand colour so an author
 * cannot mistype them, and anything the sanitizer would strip is not offered in
 * the first place.
 */

import React, { useMemo, useState } from "react";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Minus,
  MousePointerClick,
  Redo,
  Send,
  Underline,
  Undo,
} from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import {
  EMAIL_BUTTON_DEFAULT_LABEL,
  EMAIL_BUTTON_NAME,
} from "@/lib/email/email-button-node";
import { EMAIL_HEADING_LEVELS } from "@/lib/email/editor-extensions";

import {
  composerDialogCopy,
  type DialogKind,
} from "./email-composer-dialogs";
import {
  EmailComposerDialog,
  type ComposerDialogValues,
} from "./EmailComposerDialog";
import {
  insertEmailImage,
  measureImageWidth,
  type EmailImageUpload,
} from "./email-image-upload";
import { EmailImageUploadField } from "./EmailImageUploadField";
import { EmailMergeTagMenu } from "./EmailMergeTagMenu";

const HEADING_ICONS = [Heading1, Heading2, Heading3] as const;
const ALIGNMENTS = [
  { value: "left", label: "Align left", icon: AlignLeft },
  { value: "center", label: "Centre", icon: AlignCenter },
  { value: "right", label: "Align right", icon: AlignRight },
] as const;

interface ToolbarButtonProps {
  readonly label: string;
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly pressed?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
}

function ToolbarButton({
  label,
  icon: Icon,
  pressed = false,
  disabled = false,
  onClick,
}: ToolbarButtonProps) {
  return (
    <Toggle
      size="sm"
      pressed={pressed}
      disabled={disabled}
      onPressedChange={onClick}
      aria-label={label}
      title={label}
    >
      <Icon className="h-4 w-4" />
    </Toggle>
  );
}

/** Selection-derived state. `useEditorState` is what re-renders the toolbar. */
function useToolbarState(editor: Editor) {
  return useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      bold: instance.isActive("bold"),
      italic: instance.isActive("italic"),
      underline: instance.isActive("underline"),
      bulletList: instance.isActive("bulletList"),
      orderedList: instance.isActive("orderedList"),
      link: instance.isActive("link"),
      button: instance.isActive(EMAIL_BUTTON_NAME),
      headings: EMAIL_HEADING_LEVELS.map((level) =>
        instance.isActive("heading", { level }),
      ),
      alignments: ALIGNMENTS.map(({ value }) =>
        instance.isActive({ textAlign: value }),
      ),
      canUndo: instance.can().undo(),
      canRedo: instance.can().redo(),
    }),
  });
}

/** The values a dialog opens with, read off whatever is selected. */
function dialogDefaults(editor: Editor, kind: DialogKind): ComposerDialogValues {
  if (kind === "button") {
    const attrs = editor.getAttributes(EMAIL_BUTTON_NAME);
    return {
      url: typeof attrs.href === "string" ? attrs.href : "",
      text: typeof attrs.label === "string" ? attrs.label : "",
    };
  }
  if (kind === "link") {
    const { from, to } = editor.state.selection;
    return {
      url: editor.getAttributes("link").href ?? "",
      text: editor.state.doc.textBetween(from, to, " "),
    };
  }
  return { url: "", text: "" };
}

/** Apply a dialog's result. One place, so every tool focuses the editor after. */
async function applyDialog(
  editor: Editor,
  kind: DialogKind,
  { url, text }: ComposerDialogValues,
) {
  if (kind === "image") {
    // US-014 — a linked image is sized like an uploaded one, so the column
    // constraint does not depend on which way the image arrived. `null` (a
    // host the admin origin cannot load) inserts it unsized, as before.
    insertEmailImage(editor, {
      src: url,
      alt: text,
      width: await measureImageWidth(url),
    });
    return;
  }
  if (kind === "button") {
    const attrs = { href: url, label: text || EMAIL_BUTTON_DEFAULT_LABEL };
    if (editor.isActive(EMAIL_BUTTON_NAME)) {
      editor.chain().focus().updateAttributes(EMAIL_BUTTON_NAME, attrs).run();
    } else {
      editor.chain().focus().insertContent({ type: EMAIL_BUTTON_NAME, attrs }).run();
    }
    return;
  }
  // One path for both an empty caret and a selection: extending over any link
  // already under the cursor means editing one replaces it rather than nesting.
  editor
    .chain()
    .focus()
    .extendMarkRange("link")
    .insertContent({
      type: "text",
      text: text || url,
      marks: [{ type: "link", attrs: { href: url } }],
    })
    .run();
}

export interface EmailComposerToolbarProps {
  readonly editor: Editor;
  /** US-013 — the mapped event, which decides the tags on offer. */
  readonly eventType?: string | null;
  /** US-014 — image uploading, when the screen has an endpoint for it. */
  readonly imageUpload?: EmailImageUpload;
  /**
   * US-015 — queue a test send of the SAVED template to the signed-in admin.
   * Owned by the editor (the composer stays fetch-free); absent on the create
   * screens, where there is nothing saved to send yet.
   */
  readonly onSendTest?: () => void;
  readonly isSendingTest?: boolean;
}

export function EmailComposerToolbar({
  editor,
  eventType,
  imageUpload,
  onSendTest,
  isSendingTest = false,
}: EmailComposerToolbarProps) {
  const state = useToolbarState(editor);
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const canUpload = Boolean(imageUpload?.enabled);

  const initialValues = useMemo(
    () => (dialog ? dialogDefaults(editor, dialog) : { url: "", text: "" }),
    [dialog, editor],
  );

  const handleSubmit = (values: ComposerDialogValues) => {
    if (!dialog) return;
    void applyDialog(editor, dialog, values);
    setDialog(null);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1 border-b border-bs-border-100 bg-bs-card-2 p-2">
        <ToolbarButton
          label="Bold"
          icon={Bold}
          pressed={state.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="Italic"
          icon={Italic}
          pressed={state.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="Underline"
          icon={Underline}
          pressed={state.underline}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        {EMAIL_HEADING_LEVELS.map((level, index) => (
          <ToolbarButton
            key={level}
            label={`Heading ${level}`}
            icon={HEADING_ICONS[index]}
            pressed={state.headings[index]}
            onClick={() =>
              editor.chain().focus().toggleHeading({ level }).run()
            }
          />
        ))}

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          label="Bulleted list"
          icon={List}
          pressed={state.bulletList}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="Numbered list"
          icon={ListOrdered}
          pressed={state.orderedList}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        {ALIGNMENTS.map(({ value, label, icon }, index) => (
          <ToolbarButton
            key={value}
            label={label}
            icon={icon}
            pressed={state.alignments[index]}
            onClick={() => editor.chain().focus().setTextAlign(value).run()}
          />
        ))}

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolbarButton
          label="Add a link"
          icon={Link2}
          pressed={state.link}
          onClick={() => setDialog("link")}
        />
        {state.link && (
          <ToolbarButton
            label="Remove link"
            icon={Link2Off}
            onClick={() =>
              editor.chain().focus().extendMarkRange("link").unsetLink().run()
            }
          />
        )}
        <ToolbarButton
          label="Add an image"
          icon={ImageIcon}
          onClick={() => setDialog("image")}
        />
        <ToolbarButton
          label={state.button ? "Edit this button" : "Add a button"}
          icon={MousePointerClick}
          pressed={state.button}
          onClick={() => setDialog("button")}
        />
        <ToolbarButton
          label="Add a divider"
          icon={Minus}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        <EmailMergeTagMenu editor={editor} eventType={eventType} />

        {onSendTest && (
          <>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <ToolbarButton
              label={
                isSendingTest
                  ? "Sending a test…"
                  : "Send a test of the saved version to yourself"
              }
              icon={Send}
              disabled={isSendingTest}
              onClick={onSendTest}
            />
          </>
        )}

        <div className="flex-1" />

        <ToolbarButton
          label="Undo"
          icon={Undo}
          disabled={!state.canUndo}
          onClick={() => editor.chain().focus().undo().run()}
        />
        <ToolbarButton
          label="Redo"
          icon={Redo}
          disabled={!state.canRedo}
          onClick={() => editor.chain().focus().redo().run()}
        />
      </div>

      {dialog && (
        <EmailComposerDialog
          {...composerDialogCopy(dialog, canUpload)}
          open
          initialValues={initialValues}
          onSubmit={handleSubmit}
          onOpenChange={(open) => {
            if (!open) setDialog(null);
          }}
        >
          {dialog === "image" && imageUpload?.enabled && (
            <EmailImageUploadField
              editor={editor}
              upload={imageUpload}
              onUploaded={() => setDialog(null)}
            />
          )}
        </EmailComposerDialog>
      )}
    </>
  );
}
