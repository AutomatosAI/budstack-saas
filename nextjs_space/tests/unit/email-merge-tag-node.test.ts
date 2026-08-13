// @vitest-environment happy-dom

import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import { emailEditorExtensions } from "@/lib/email/editor-extensions";
import type { EmailContentJson } from "@/lib/email/email-content-json";
import {
  EMAIL_MERGE_TAG_CLASS,
  EMAIL_MERGE_TAG_DATA_ATTRIBUTE,
  EMAIL_MERGE_TAG_INPUT_RULE,
  EMAIL_MERGE_TAG_NAME,
} from "@/lib/email/email-merge-tag-node";
import { renderEmailTemplateHtml } from "@/lib/email/email-render-pipeline";
import type { EmailShellTenant } from "@/lib/email/email-shell";
import { renderEmailTemplate } from "@/lib/email/handlebars-helpers";
import { sampleVariablesForEvent } from "@/lib/email/sample-variables";

// Email Phase 2 US-013 — the merge-tag chip.
//
// THE ONE THING THAT MATTERS is the round trip: a chip the author placed has to
// come out of the US-011 save pipeline as the literal text {{userName}}, because
// scripts/email-worker.ts compiles contentHtml with Handlebars and nothing about
// that contract changed. Four steps stand between the chip and the inbox —
// generateHTML, the shell, juice, and the sanitizer, which drops the data-*
// attribute the chip is recognised by — so the proof is running the real
// pipeline and then rendering its output the way the worker would.

const TENANT: EmailShellTenant = {
  id: "tenant-a",
  businessName: "Healing Buds",
  subdomain: "healingbuds",
  customDomain: "shop.example",
  logoUrl: null,
  primaryColor: "#7c3aed",
  businessAddress1: "1 Sample Street",
  businessCity: "Dublin",
};

let editor: Editor | null = null;

function makeEditor(): Editor {
  editor = new Editor({ extensions: emailEditorExtensions(), content: "<p>Hi </p>" });
  return editor;
}

afterEach(() => {
  editor?.destroy();
  editor = null;
});

/**
 * The `tag` on the first chip in the editor's document.
 *
 * The narrowing is the point: `getJSON()` types a node's children as "a node OR
 * a text node", and a text node has no attributes — so reaching for `.attrs`
 * without asking first does not compile.
 */
function firstChipTag(instance: Editor): unknown {
  const paragraph = instance.getJSON().content?.[0];
  const children =
    paragraph && "content" in paragraph ? paragraph.content : undefined;
  const chip = children?.find((node) => node.type === EMAIL_MERGE_TAG_NAME);

  return chip && "attrs" in chip ? chip.attrs?.tag : undefined;
}

/** One paragraph containing a chip — what the Personalize menu produces. */
function docWithTag(tag: unknown): EmailContentJson {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Hi " },
          { type: EMAIL_MERGE_TAG_NAME, attrs: { tag } as never },
        ],
      },
    ],
  };
}

describe("inserting a chip", () => {
  it("puts a merge-tag node in the document, not text", () => {
    const instance = makeEditor();

    instance
      .chain()
      .focus()
      .insertContent({ type: EMAIL_MERGE_TAG_NAME, attrs: { tag: "userName" } })
      .run();

    expect(firstChipTag(instance)).toBe("userName");
  });

  // An atom: one backspace takes the whole tag. Half a merge tag ({{userNam}})
  // is worse than none — it silently renders as nothing in the sent email.
  it("is an atom, so it cannot be half-deleted", () => {
    const instance = makeEditor();
    instance.chain().focus().insertContent({
      type: EMAIL_MERGE_TAG_NAME,
      attrs: { tag: "userName" },
    }).run();

    const chipType = instance.schema.nodes[EMAIL_MERGE_TAG_NAME];
    expect(chipType.isAtom).toBe(true);
    expect(chipType.isInline).toBe(true);
  });

  // Copying a paragraph inside the editor serialises to HTML and parses it back.
  // Without the data attribute surviving that trip, a pasted chip is plain text.
  it("round-trips through its own HTML", () => {
    const instance = makeEditor();
    instance.chain().focus().insertContent({
      type: EMAIL_MERGE_TAG_NAME,
      attrs: { tag: "orderNumber" },
    }).run();
    expect(instance.getHTML()).toContain(
      `${EMAIL_MERGE_TAG_DATA_ATTRIBUTE}="orderNumber"`,
    );

    const reopened = new Editor({
      extensions: emailEditorExtensions(),
      content: instance.getHTML(),
    });
    const reopenedTag = firstChipTag(reopened);
    reopened.destroy();

    expect(reopenedTag).toBe("orderNumber");
  });

  // What the author sees. The editor's DOM comes from the node view, which is a
  // different rendering from the one that reaches the inbox — the whole point of
  // the story is that the author reads "Customer name" and the recipient's mail
  // carries {{userName}}. Asserted off the live EditorView because the admin
  // screens are behind a Clerk session and cannot be walked here.
  it("shows the friendly label on screen, with the tag one hover away", () => {
    const instance = makeEditor();
    instance.chain().focus().insertContent({
      type: EMAIL_MERGE_TAG_NAME,
      attrs: { tag: "userName" },
    }).run();

    const chip = instance.view.dom.querySelector(`.${EMAIL_MERGE_TAG_CLASS}`);

    expect(chip?.textContent).toBe("Customer name");
    expect(chip?.getAttribute("title")).toBe("{{userName}}");
    expect(chip?.getAttribute(EMAIL_MERGE_TAG_DATA_ATTRIBUTE)).toBe("userName");
    // An atom with no contentDOM: ProseMirror makes it uneditable, which is what
    // stops a caret landing inside and breaking the braces.
    expect(chip?.getAttribute("contenteditable")).toBe("false");
  });

  it("carries the tag, not the label, into plain text", () => {
    const instance = makeEditor();
    instance.chain().focus().insertContent({
      type: EMAIL_MERGE_TAG_NAME,
      attrs: { tag: "userName" },
    }).run();

    expect(instance.getText()).toContain("{{userName}}");
    expect(instance.getText()).not.toContain("Customer name");
  });
});

// The input rule is what makes typing '{{' a trigger. ProseMirror runs it from
// handleTextInput on the view, which a headless editor never fires, so the
// regex is asserted directly — the handler behind it re-checks every capture
// with normaliseMergeTagName, which has its own tests.
describe("the '{{' trigger", () => {
  it.each([
    ["Hi {{userName}}", "userName"],
    ["{{ total }}", "total"],
    ["{{order.number}}", "order.number"],
  ])("captures the tag from %s", (typed, expected) => {
    expect(typed.match(EMAIL_MERGE_TAG_INPUT_RULE)?.[1]).toBe(expected);
  });

  it.each([
    ["an unclosed tag", "{{userName"],
    ["a block opener", "{{#each items}}"],
    ["a helper invocation", "{{toFixed price}}"],
    ["text after the braces", "{{userName}} and more"],
  ])("does not fire on %s", (_label, typed) => {
    expect(EMAIL_MERGE_TAG_INPUT_RULE.test(typed)).toBe(false);
  });
});

describe("a chip survives the save pipeline as a merge tag", () => {
  it("comes out as literal {{tag}} text the worker can compile", async () => {
    const html = await renderEmailTemplateHtml({
      contentJson: docWithTag("userName"),
      tenant: TENANT,
    });

    expect(html).toContain("{{userName}}");
    // The chip's own markup is editor scaffolding: the sanitizer drops data-*,
    // and nothing about the chip may reach the inbox except its text.
    expect(html).not.toContain(EMAIL_MERGE_TAG_DATA_ATTRIBUTE);
    expect(html).not.toContain("email-merge-tag");
  });

  // The whole point, end to end: what the author placed is what the recipient's
  // name lands in. Rendered with the same helper set the worker registers.
  it("is replaced by the recipient's value when the worker renders it", async () => {
    const html = await renderEmailTemplateHtml({
      contentJson: docWithTag("userName"),
      tenant: TENANT,
    });

    const sent = renderEmailTemplate(html, sampleVariablesForEvent(null));

    expect(sent).toContain("Sample Customer");
    expect(sent).not.toContain("{{userName}}");
  });

  it("works the same for a custom tag the platform does not list", async () => {
    const html = await renderEmailTemplateHtml({
      contentJson: docWithTag("order_reference"),
      tenant: TENANT,
    });

    expect(html).toContain("{{order_reference}}");
    expect(renderEmailTemplate(html, { order_reference: "REF-77" })).toContain(
      "REF-77",
    );
  });

  // contentJson arrives in a request body, so a node can carry anything. A name
  // that would reach Handlebars as syntax rather than a variable contributes
  // nothing to the output — it never becomes {{...}} at all.
  it.each([
    ["a missing tag", null],
    ["an empty tag", "  "],
    ["a helper invocation", "toFixed price"],
    ["an escape into a triple-stache", "userName}}{{{evil"],
  ])("renders nothing for %s", async (_label, tag) => {
    const html = await renderEmailTemplateHtml({
      contentJson: docWithTag(tag),
      tenant: TENANT,
    });

    expect(html).not.toContain("{{");
    expect(html).toContain("Hi ");
  });
});
