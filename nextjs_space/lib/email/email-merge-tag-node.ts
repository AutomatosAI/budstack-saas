/**
 * US-013 — a merge tag as a TipTap node: a labelled chip on screen, literal
 * `{{tag}}` text in the message.
 *
 * WHY A NODE AND NOT TEXT. An author who is asked to type `{{userName}}` has to
 * know the variable's name, the brace count, and that a typo produces an email
 * reading "Hi ," rather than an error. A chip is picked from a menu, cannot be
 * half-deleted (it is an atom — one backspace takes the whole thing), and says
 * "Customer name" instead of `{{userName}}`.
 *
 * THE TWO RENDERINGS ARE DIFFERENT ON PURPOSE:
 *
 *   addNodeView  -> <span class="email-merge-tag">Customer name</span>   (editor)
 *   renderHTML   -> <span data-merge-tag="userName">{{userName}}</span>  (saved)
 *
 * The saved shape is what matters downstream. `lib/security/email-sanitize.ts`
 * drops `data-merge-tag` (no `data-*` on the allow-list) leaving a bare `<span>`
 * around the literal text, and `scripts/email-worker.ts` compiles that text with
 * Handlebars exactly as it always has. Nothing about the worker's contract
 * changes: the pipeline just produces the tag more reliably than a human typing
 * it. The data attribute earns its keep before that — it is what `parseHTML`
 * matches, so copying and pasting a chip inside the editor yields a chip.
 *
 * Isomorphic. The composer loads this in the browser and
 * `lib/email/email-render-pipeline.ts` loads it in a route handler, so no
 * server-only imports and no React. `addNodeView` touches `document`, but only
 * when an `EditorView` invokes it — `generateHTML` never does.
 */

import { InputRule, mergeAttributes, Node } from "@tiptap/core";

import {
  EMAIL_MERGE_TAG_NAME_PATTERN,
  mergeTagLabel,
  mergeTagText,
  normaliseMergeTagName,
} from "@/lib/email/email-merge-tags";

export const EMAIL_MERGE_TAG_NAME = "emailMergeTag";

/** Matched by `parseHTML`; stripped by the sanitizer on the way to an inbox. */
export const EMAIL_MERGE_TAG_DATA_ATTRIBUTE = "data-merge-tag";

/** Styled by the composer (`EMAIL_MERGE_TAG_CSS`), never present in an email. */
export const EMAIL_MERGE_TAG_CLASS = "email-merge-tag";

/**
 * Typing the closing braces turns what was typed into a chip.
 *
 * This is the `{{` trigger, without a suggestion popup: the menu already answers
 * "which tags exist?", so what is left for typing to do is stop an author who
 * knows a tag's name from ending up with text the editor does not recognise as
 * one. Built from `EMAIL_MERGE_TAG_NAME_PATTERN` so the shape a chip can be
 * typed in is the same shape `normaliseMergeTagName` accepts — and the handler
 * re-checks the capture regardless, because that function is the authority.
 */
export const EMAIL_MERGE_TAG_INPUT_RULE = new RegExp(
  `\\{\\{\\s*(${EMAIL_MERGE_TAG_NAME_PATTERN})\\s*\\}\\}$`,
);

/** Editor-only chip styling. Lives here so the node and its look travel together. */
export const EMAIL_MERGE_TAG_CSS = `
.${EMAIL_MERGE_TAG_CLASS} {
  display: inline-block;
  border-radius: 4px;
  border: 1px solid #cbd5e1;
  background-color: #eef2f7;
  color: #1f2937;
  padding-left: 6px;
  padding-right: 6px;
  font-size: 0.9em;
  white-space: nowrap;
  cursor: default;
}
`;

/** The tag on a node, or null when the attribute is missing or unusable. */
function nodeTagName(attrs: Record<string, unknown>): string | null {
  return normaliseMergeTagName(attrs.tag);
}

export const EmailMergeTag = Node.create({
  name: EMAIL_MERGE_TAG_NAME,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      tag: {
        default: null,
        parseHTML: (element) =>
          element.getAttribute(EMAIL_MERGE_TAG_DATA_ATTRIBUTE),
        renderHTML: (attributes) => {
          const tag = nodeTagName(attributes);
          return tag ? { [EMAIL_MERGE_TAG_DATA_ATTRIBUTE]: tag } : {};
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: `span[${EMAIL_MERGE_TAG_DATA_ATTRIBUTE}]` }];
  },

  /**
   * A node with no usable tag renders as an empty span rather than `{{}}`.
   * The document is untrusted on the save path — it arrives in a request body —
   * and `{{}}` would reach Handlebars, so an unreadable node contributes nothing
   * instead of contributing something malformed.
   */
  renderHTML({ HTMLAttributes, node }) {
    const tag = nodeTagName(node.attrs);
    return ["span", mergeAttributes(HTMLAttributes), tag ? mergeTagText(tag) : ""];
  },

  /** Plain-text copies (and `editor.getText()`) carry the tag, not the label. */
  renderText({ node }) {
    const tag = nodeTagName(node.attrs);
    return tag ? mergeTagText(tag) : "";
  },

  addNodeView() {
    return ({ node }) => {
      const tag = nodeTagName(node.attrs);
      const dom = document.createElement("span");

      dom.className = EMAIL_MERGE_TAG_CLASS;
      if (tag) {
        dom.setAttribute(EMAIL_MERGE_TAG_DATA_ATTRIBUTE, tag);
        // The chip shows the label; the literal tag stays one hover away, which
        // is how an author checks what a chip will actually be replaced with.
        dom.setAttribute("title", mergeTagText(tag));
        dom.textContent = mergeTagLabel(tag);
      }
      return { dom };
    };
  },

  /**
   * Hand-written rather than `nodeInputRule`, which drops a `false` from
   * `getAttributes` on the floor (`callOrReturn(...) || {}`) and would insert a
   * chip with no tag for a name this module refuses. Returning null from a
   * handler is the documented way to decline a match, so an unusable name is
   * left on screen as the text the author typed.
   */
  addInputRules() {
    const type = this.type;

    return [
      new InputRule({
        find: EMAIL_MERGE_TAG_INPUT_RULE,
        handler: ({ state, range, match }) => {
          const tag = normaliseMergeTagName(match[1]);
          if (!tag) return null;
          state.tr.replaceWith(range.from, range.to, type.create({ tag }));
        },
      }),
    ];
  },
});

export default EmailMergeTag;
