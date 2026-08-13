// @vitest-environment happy-dom

import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), message: vi.fn() },
}));

import {
  droppedImageFiles,
  handleEmailImageDrop,
  insertEmailImage,
} from "@/components/admin/email/email-image-upload";
import { emailEditorExtensions } from "@/lib/email/editor-extensions";
import { EMAIL_IMAGE_NAME } from "@/lib/email/email-image-node";
import { EMAIL_CONTENT_WIDTH_PX } from "@/lib/email/email-layout";

// Email Phase 2 US-014 — the image node, driven through a real editor.
//
// The typecheck cannot cover any of this. TipTap resolves attributes at runtime
// against whichever extensions an editor was built from, so an attribute the
// node never registered is silently dropped on insert and the image reaches the
// inbox unsized — compiling perfectly the whole way. The only proof is putting
// an image in and reading it back out.
//
// `emailEditorExtensions()` is the shared list `lib/email/email-render-pipeline.ts`
// re-renders stored documents with, so what survives here is what the server
// will be able to render.

const SRC = "/api/public/images/development/tenants/tenant-a/uploads/photo.png";

let editor: Editor | null = null;

function makeEditor(content = "<p>Hello</p>"): Editor {
  editor = new Editor({ extensions: emailEditorExtensions(), content });
  return editor;
}

/** The first image node in the document, or null. */
function imageAttrs(instance: Editor): Record<string, unknown> | null {
  let found: Record<string, unknown> | null = null;
  instance.state.doc.descendants((node) => {
    if (found === null && node.type.name === EMAIL_IMAGE_NAME) {
      found = node.attrs;
    }
    return found === null;
  });
  return found;
}

function fileOfType(type: string, name = "photo.png"): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

describe("US-014 — inserting an image", () => {
  it("clamps a wide photo to the shell's content column", () => {
    const instance = makeEditor();

    insertEmailImage(instance, { src: SRC, alt: "Summer range", width: 4000 });

    expect(imageAttrs(instance)).toMatchObject({
      src: SRC,
      alt: "Summer range",
      width: EMAIL_CONTENT_WIDTH_PX,
    });
  });

  it("writes the width as an HTML attribute, which is what Outlook honours", () => {
    const instance = makeEditor();

    insertEmailImage(instance, { src: SRC, width: 4000 });

    expect(instance.getHTML()).toContain(`width="${EMAIL_CONTENT_WIDTH_PX}"`);
  });

  it("leaves an image unsized when it could not be measured", () => {
    const instance = makeEditor();

    insertEmailImage(instance, { src: SRC, width: null });

    expect(imageAttrs(instance)).toMatchObject({ width: null });
    expect(instance.getHTML()).not.toContain("width=");
  });

  it("keeps a narrower image at its own size", () => {
    const instance = makeEditor();

    insertEmailImage(instance, { src: SRC, width: 120 });

    expect(imageAttrs(instance)).toMatchObject({ width: 120 });
  });

  it("stores no alt rather than an empty one", () => {
    const instance = makeEditor();

    insertEmailImage(instance, { src: SRC, alt: "   ", width: 200 });

    expect(imageAttrs(instance)).toMatchObject({ alt: null });
  });

  it("clamps a width that arrived from outside the composer", () => {
    // Pasted HTML, or a hand-crafted contentJson posted straight at the save
    // endpoint. The composer is not the only way an image gets into a document,
    // so the node clamps on the way in as well as on the way out.
    const instance = makeEditor(`<p>x</p><img src="${SRC}" width="9999">`);

    expect(imageAttrs(instance)).toMatchObject({ width: EMAIL_CONTENT_WIDTH_PX });
  });

  it("reads the width back off pasted HTML, so a copied image stays sized", () => {
    const instance = makeEditor(
      `<p>x</p><img src="${SRC}" alt="Summer range" width="${EMAIL_CONTENT_WIDTH_PX}">`,
    );

    expect(imageAttrs(instance)).toMatchObject({
      src: SRC,
      width: EMAIL_CONTENT_WIDTH_PX,
    });
  });
});

describe("US-014 — what a drop claims", () => {
  it("takes the images out of a mixed payload", () => {
    const transfer = {
      files: [fileOfType("image/png"), fileOfType("application/pdf", "menu.pdf")],
    } as unknown as DataTransfer;

    expect(droppedImageFiles(transfer)).toHaveLength(1);
  });

  it("claims an image type the composer does not offer, so it can say why", () => {
    const transfer = {
      files: [fileOfType("image/svg+xml", "logo.svg")],
    } as unknown as DataTransfer;

    // Declining would let the browser open the file and lose the draft.
    expect(droppedImageFiles(transfer)).toHaveLength(1);
  });

  it("claims nothing from a drag that carries no files", () => {
    expect(droppedImageFiles(null)).toEqual([]);
    expect(droppedImageFiles({ files: [] } as unknown as DataTransfer)).toEqual([]);
  });
});

describe("US-014 — the ProseMirror drop handler", () => {
  const dropEvent = () => ({
    dataTransfer: null,
    preventDefault: vi.fn(),
  });

  it("suppresses the browser default only when it took the drop", () => {
    const instance = makeEditor();
    const event = dropEvent();

    const handled = handleEmailImageDrop(
      { acceptDrop: () => true },
      instance,
      event,
    );

    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it("declines a drop it did not take, leaving ProseMirror's handling alone", () => {
    const instance = makeEditor();
    const event = dropEvent();

    const handled = handleEmailImageDrop(
      { acceptDrop: () => false },
      instance,
      event,
    );

    expect(handled).toBe(false);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("declines before the editor exists", () => {
    const event = dropEvent();
    const acceptDrop = vi.fn(() => true);

    expect(handleEmailImageDrop({ acceptDrop }, null, event)).toBe(false);
    expect(acceptDrop).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
