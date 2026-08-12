/**
 * US-012 — the call-to-action button, as a TipTap node.
 *
 * A button in an email is a styled `<a>`. `<button>` is not on
 * `lib/security/email-sanitize.ts`'s allow-list and does not work in most
 * clients regardless, so this node never produces one — the rule from US-010's
 * shell holds here too: when something does not survive the sanitizer, the
 * output changes, never the allow-list.
 *
 * SHAPE:
 *
 *   <div data-email-button style="text-align: center">   <- alignment lives here
 *     <a href="..." style="display:inline-block; ...">Label</a>
 *   </div>
 *
 * The wrapper exists so `@tiptap/extension-text-align` has something to align.
 * `text-align` on the `<a>` itself would centre the label INSIDE the button
 * rather than the button inside the email, which is never what the author
 * meant. `data-email-button` is what `parseHTML` matches on when a button is
 * copied and pasted inside the editor; the sanitizer drops it from the sent
 * message (no `data-*` on the allow-list) and nothing downstream needs it.
 *
 * An ATOM with a `label` attribute rather than an editable text node: the label
 * and the URL are then edited together in one dialog, and no mark (bold, a
 * second link) can be applied to the inside of a button and quietly break it.
 *
 * Isomorphic — the composer loads this in the browser and
 * `lib/email/email-render-pipeline.ts` loads it in a route handler, so no
 * server-only imports and no React.
 */

import { mergeAttributes, Node } from "@tiptap/core";

export const EMAIL_BUTTON_NAME = "emailButton";

/** Marks the wrapper for `parseHTML`. Stripped by the sanitizer on the way out. */
export const EMAIL_BUTTON_DATA_ATTRIBUTE = "data-email-button";

/**
 * The platform's default accent.
 *
 * Must stay equal to `DEFAULT_EMAIL_PRIMARY_COLOR` in `emails/email-shell.tsx`
 * so a button matches the shell's accent bar — asserted in
 * `tests/unit/email-composer.test.ts`. Declared here rather than imported
 * because that module pulls in react-email, and this one is bundled for the
 * browser.
 */
export const EMAIL_BUTTON_BACKGROUND_COLOR = "#10b981";
export const EMAIL_BUTTON_TEXT_COLOR = "#ffffff";

/** Shown when a button is inserted before the author has typed a label. */
export const EMAIL_BUTTON_DEFAULT_LABEL = "Shop now";

/**
 * The button's height, expressed as `line-height` rather than vertical padding.
 * See BUTTON_STYLE — vertical padding cannot survive the trip to an inbox.
 */
const BUTTON_HEIGHT_PX = 44;

/**
 * Every declaration below is written in a shape the sanitizer's allow-list
 * accepts: a single-value `border-radius`, `font-weight: bold` rather than
 * `600`, and NEVER a shorthand — `padding: 12px 24px` is rejected wholesale.
 *
 * NEVER WRITE ALL FOUR LONGHANDS OF ONE SHORTHAND HERE. Writing longhands is not
 * on its own enough to avoid a shorthand: this style string is serialised by
 * `@tiptap/html` on the way to `contentHtml`, and that serialisation follows the
 * CSSOM rule of collapsing a complete set of longhands back into its shorthand.
 * So `padding-top/bottom/left/right` came back out as `padding: 12px 24px`, the
 * sanitizer's `padding` pattern (one unit, not two) dropped it, and the button
 * reached the inbox with no padding at all — a coloured run of text.
 *
 * Two longhands cannot form a shorthand, so horizontal padding is kept and the
 * height comes from `line-height` instead. That is the standard email button
 * technique anyway: clients disagree about vertical padding on an inline-block
 * far more than they disagree about line-height.
 *
 * `tests/unit/email-composer.test.ts` renders this through the real pipeline and
 * asserts the surviving declarations, so a regression fails a test rather than
 * shipping.
 */
const BUTTON_STYLE = [
  "display:inline-block",
  `background-color:${EMAIL_BUTTON_BACKGROUND_COLOR}`,
  `color:${EMAIL_BUTTON_TEXT_COLOR}`,
  "font-family:Helvetica, Arial, sans-serif",
  "font-size:16px",
  "font-weight:bold",
  `line-height:${BUTTON_HEIGHT_PX}px`,
  "text-decoration:none",
  "padding-left:24px",
  "padding-right:24px",
  "border-radius:6px",
].join(";");

/**
 * Breathing room around the call to action, merged with any alignment.
 *
 * Two margin longhands, for the reason spelled out above: adding the other two
 * would collapse them into a `margin` shorthand the sanitizer then drops.
 */
const WRAPPER_STYLE = ["margin-top:8px", "margin-bottom:16px"].join(";");

export interface EmailButtonAttributes {
  readonly href: string | null;
  readonly label: string;
}

/** Read an attribute the composer wrote, falling back to the default. */
function textAttribute(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export const EmailButton = Node.create({
  name: EMAIL_BUTTON_NAME,
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      // Both render onto the inner <a>, not the wrapper, so each declares an
      // empty renderHTML rather than letting TipTap mirror it onto the div.
      href: {
        default: null,
        parseHTML: (element) =>
          element.querySelector("a")?.getAttribute("href") ?? null,
        renderHTML: () => ({}),
      },
      label: {
        default: EMAIL_BUTTON_DEFAULT_LABEL,
        parseHTML: (element) =>
          element.querySelector("a")?.textContent?.trim() || null,
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: `div[${EMAIL_BUTTON_DATA_ATTRIBUTE}]` }];
  },

  renderHTML({ HTMLAttributes, node }) {
    const href = textAttribute(node.attrs.href, "");
    const label = textAttribute(node.attrs.label, EMAIL_BUTTON_DEFAULT_LABEL);

    // No href attribute at all when there is no URL: `href=""` links to the
    // message itself in most clients, which is worse than plain text.
    const anchor = href
      ? { href, target: "_blank", rel: "noopener noreferrer", style: BUTTON_STYLE }
      : { style: BUTTON_STYLE };

    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        [EMAIL_BUTTON_DATA_ATTRIBUTE]: "",
        style: WRAPPER_STYLE,
      }),
      ["a", anchor, label],
    ];
  },
});

export default EmailButton;
