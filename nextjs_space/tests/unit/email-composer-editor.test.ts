// @vitest-environment happy-dom

import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import {
  emailEditorExtensions,
  EMAIL_HEADING_LEVELS,
  EMAIL_TEXT_ALIGNMENTS,
} from "@/lib/email/editor-extensions";
import {
  EMAIL_BUTTON_DEFAULT_LABEL,
  EMAIL_BUTTON_NAME,
} from "@/lib/email/email-button-node";

// Email Phase 2 US-012 — every command `EmailComposerToolbar` calls, run against
// a real editor built from the shared extension set.
//
// THE TYPECHECK CANNOT DO THIS. TipTap declares its commands through global
// module augmentation, so `toggleUnderline()` type-checks whether or not
// Underline is in the extension list — a toolbar button wired to a command no
// extension registered compiles clean and throws when an admin clicks it. The
// only way to know a button works is to press it.
//
// It also pins the composer and the save pipeline to ONE schema: these commands
// produce the document, and `lib/email/email-render-pipeline.ts` re-renders it
// server-side with this same `emailEditorExtensions()`. A node the composer can
// create but that list cannot render is a 400 at save time.

let editor: Editor | null = null;

function makeEditor(): Editor {
  editor = new Editor({ extensions: emailEditorExtensions(), content: "<p>Hello</p>" });
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

/** Put the caret across "Hello" so mark commands have something to act on. */
function selectAll(instance: Editor) {
  instance.commands.selectAll();
  return instance;
}

describe("the composer's marks", () => {
  it.each(["bold", "italic", "underline", "strike"])(
    "toggles %s on the selection",
    (mark) => {
      const instance = selectAll(makeEditor());
      const command = `toggle${mark[0].toUpperCase()}${mark.slice(1)}` as
        | "toggleBold"
        | "toggleItalic"
        | "toggleUnderline"
        | "toggleStrike";

      expect(instance.chain().focus()[command]().run()).toBe(true);
      expect(instance.isActive(mark)).toBe(true);
    },
  );

  it("links the selection and unlinks it again", () => {
    const instance = selectAll(makeEditor());

    instance
      .chain()
      .focus()
      .extendMarkRange("link")
      .insertContent({
        type: "text",
        text: "See the range",
        marks: [{ type: "link", attrs: { href: "https://shop.example/range" } }],
      })
      .run();
    expect(instance.getHTML()).toContain('href="https://shop.example/range"');

    instance.commands.selectAll();
    instance.chain().focus().extendMarkRange("link").unsetLink().run();
    expect(instance.getHTML()).not.toContain("href=");
  });
});

describe("the composer's blocks", () => {
  it.each([...EMAIL_HEADING_LEVELS])("toggles heading %i", (level) => {
    const instance = makeEditor();

    expect(instance.chain().focus().toggleHeading({ level }).run()).toBe(true);
    expect(instance.isActive("heading", { level })).toBe(true);
  });

  it.each(["bulletList", "orderedList"] as const)("toggles %s", (list) => {
    const instance = makeEditor();
    const command = list === "bulletList" ? "toggleBulletList" : "toggleOrderedList";

    expect(instance.chain().focus()[command]().run()).toBe(true);
    expect(instance.isActive(list)).toBe(true);
  });

  it.each([...EMAIL_TEXT_ALIGNMENTS])("aligns %s", (alignment) => {
    const instance = makeEditor();

    expect(instance.chain().focus().setTextAlign(alignment).run()).toBe(true);
    expect(instance.isActive({ textAlign: alignment })).toBe(true);
  });

  it("inserts a divider", () => {
    const instance = makeEditor();

    expect(instance.chain().focus().setHorizontalRule().run()).toBe(true);
    expect(instance.getHTML()).toContain("<hr");
  });

  it("inserts an image with its alt text", () => {
    const instance = makeEditor();

    instance
      .chain()
      .focus()
      .setImage({ src: "https://shop.example/photo.jpg", alt: "Summer range" })
      .run();

    expect(instance.getHTML()).toContain('src="https://shop.example/photo.jpg"');
    expect(instance.getHTML()).toContain('alt="Summer range"');
  });
});

describe("the composer's button", () => {
  const ATTRS = { href: "https://shop.example/shop", label: "Shop now" };

  /** Where the button sits, so the test can select it the way a click would. */
  function buttonPosition(instance: Editor): number {
    let position = -1;
    instance.state.doc.descendants((node, at) => {
      if (node.type.name === EMAIL_BUTTON_NAME) position = at;
    });
    return position;
  }

  // The toolbar switches between "Add a button" and "Edit this button" on
  // `isActive`, and inserting leaves the caret AFTER the atom — so a fresh
  // insert is not yet selected, and it is the author clicking the button that
  // arms the edit path. Both halves of that are asserted here because the tool
  // inserting a second button instead of editing the first is the failure mode.
  it("edits the selected button in place rather than stacking a second", () => {
    const instance = makeEditor();

    instance.chain().focus().insertContent({ type: EMAIL_BUTTON_NAME, attrs: ATTRS }).run();
    expect(instance.isActive(EMAIL_BUTTON_NAME)).toBe(false);

    instance.commands.setNodeSelection(buttonPosition(instance));
    expect(instance.isActive(EMAIL_BUTTON_NAME)).toBe(true);

    instance
      .chain()
      .focus()
      .updateAttributes(EMAIL_BUTTON_NAME, { ...ATTRS, label: "Browse the sale" })
      .run();

    const buttons = instance.getJSON().content?.filter(
      (node) => node.type === EMAIL_BUTTON_NAME,
    );
    expect(buttons).toHaveLength(1);
    expect(buttons?.[0].attrs?.label).toBe("Browse the sale");
  });

  // The composer writes JSON; the pipeline reads HTML back off a paste. Both
  // directions have to agree or a copied button turns into a bare link.
  it("round-trips through its own HTML", () => {
    const instance = makeEditor();
    instance.chain().focus().insertContent({ type: EMAIL_BUTTON_NAME, attrs: ATTRS }).run();

    const reopened = new Editor({
      extensions: emailEditorExtensions(),
      content: instance.getHTML(),
    });
    const button = reopened
      .getJSON()
      .content?.find((node) => node.type === EMAIL_BUTTON_NAME);
    reopened.destroy();

    expect(button?.attrs).toMatchObject(ATTRS);
  });

  it("carries an alignment, because the wrapper is what gets aligned", () => {
    const instance = makeEditor();
    instance.chain().focus().insertContent({ type: EMAIL_BUTTON_NAME, attrs: ATTRS }).run();

    expect(instance.chain().focus().setTextAlign("center").run()).toBe(true);
    expect(instance.getHTML()).toContain("text-align: center");
  });

  it("labels itself when the author inserts one without typing", () => {
    const instance = makeEditor();
    instance.chain().focus().insertContent({ type: EMAIL_BUTTON_NAME }).run();

    expect(instance.getHTML()).toContain(EMAIL_BUTTON_DEFAULT_LABEL);
  });
});

describe("the composer's history", () => {
  it("undoes and redoes an edit", () => {
    const instance = makeEditor();
    instance.chain().focus().toggleHeading({ level: 1 }).run();
    expect(instance.isActive("heading", { level: 1 })).toBe(true);

    expect(instance.can().undo()).toBe(true);
    instance.chain().focus().undo().run();
    expect(instance.isActive("heading", { level: 1 })).toBe(false);

    expect(instance.can().redo()).toBe(true);
    instance.chain().focus().redo().run();
    expect(instance.isActive("heading", { level: 1 })).toBe(true);
  });
});
