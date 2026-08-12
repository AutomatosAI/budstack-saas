/**
 * US-011/US-012 — the ONE TipTap extension set the email editor and the
 * save-path renderer share.
 *
 * The composer (US-012) and `lib/email/email-render-pipeline.ts` MUST build
 * their ProseMirror schema from the same list. If they drift, the server
 * re-renders a stored document against a schema that no longer describes it and
 * `Node.fromJSON` either throws or silently drops the nodes the author placed —
 * a class of bug that only shows up after the mail has gone out. One module, two
 * consumers, no second list anywhere.
 *
 * A FACTORY, not a shared array: a TipTap `Editor` binds to the extension
 * instances it is given, so handing the same instances to a second editor (or to
 * a server render running concurrently with one) shares mutable state between
 * them. Each caller gets its own instances.
 *
 * This module and everything it pulls in stay isomorphic — no server-only
 * imports, no node builtins — because the composer imports it in the browser and
 * the pipeline imports it in a route handler.
 *
 * NOT the same list as `components/editor/tiptap.tsx` (The Wire's post editor).
 * That editor targets a web page, this one targets an inbox; they answer to
 * different constraints and are deliberately not merged.
 */

import type { Extensions } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import StarterKit from "@tiptap/starter-kit";

import { EmailButton, EMAIL_BUTTON_NAME } from "@/lib/email/email-button-node";
import { EmailMergeTag } from "@/lib/email/email-merge-tag-node";

/**
 * h4–h6 render at or below body size in most clients, so they read as
 * emphasis rather than structure. Three levels is what a 600px-wide email can
 * actually express.
 */
export const EMAIL_HEADING_LEVELS = [1, 2, 3] as const;

/**
 * The alignments offered, and the node types they may be applied to.
 *
 * The button is in the list because a centred call to action is the single most
 * common thing an author asks for; `lib/email/email-button-node.ts` renders a
 * wrapper element for exactly this attribute to land on. `justify` is left out
 * — it renders unevenly at 600px and no email client hyphenates.
 */
export const EMAIL_TEXT_ALIGNMENTS = ["left", "center", "right"] as const;
const ALIGNABLE_TYPES = ["heading", "paragraph", EMAIL_BUTTON_NAME];

/**
 * The link protocols an author may point at, matching the `allowedSchemes` in
 * `lib/security/email-sanitize.ts`. Anything else is stripped from the stored
 * HTML anyway; refusing it in the editor means the author finds out while they
 * can still fix it.
 */
const LINK_PROTOCOLS = ["http", "https", "mailto", "tel"];

/**
 * Build the extension set for an email body.
 *
 * `allowBase64` is on so a PASTED image becomes a real image node instead of
 * being dropped on the floor: the pipeline is what decides whether that node is
 * acceptable (`EMAIL_MAX_INLINE_IMAGE_BYTES`), and it can only decide about
 * nodes that exist. Rejecting a 4MB screenshot with a message that names the fix
 * beats it vanishing silently on paste.
 *
 * `openOnClick` is off because this editor lives inside the admin: a stray click
 * on a link should put the caret in it, not navigate the author away from work
 * they have not saved.
 */
export function emailEditorExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [...EMAIL_HEADING_LEVELS] },
      link: {
        openOnClick: false,
        defaultProtocol: "https",
        protocols: LINK_PROTOCOLS,
      },
    }),
    Image.configure({
      inline: false,
      allowBase64: true,
    }),
    TextAlign.configure({
      types: ALIGNABLE_TYPES,
      alignments: [...EMAIL_TEXT_ALIGNMENTS],
      defaultAlignment: "left",
    }),
    EmailButton,
    // US-013. In the list for the same reason as the button: the composer
    // creates the node and the save pipeline must be able to render it, and a
    // stored document containing a chip is unreadable to a schema without it.
    EmailMergeTag,
  ];
}
