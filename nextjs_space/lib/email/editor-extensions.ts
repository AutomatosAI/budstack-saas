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
 * This module stays isomorphic — no `@/lib/...` server imports, no node
 * builtins — because the composer imports it in the browser and the pipeline
 * imports it in a route handler.
 *
 * NOT the same list as `components/editor/tiptap.tsx` (The Wire's post editor).
 * That editor targets a web page, this one targets an inbox; they answer to
 * different constraints and are deliberately not merged.
 */

import type { Extensions } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";

/**
 * h4–h6 render at or below body size in most clients, so they read as
 * emphasis rather than structure. Three levels is what a 600px-wide email can
 * actually express.
 */
export const EMAIL_HEADING_LEVELS = [1, 2, 3] as const;

/**
 * Build the extension set for an email body.
 *
 * `allowBase64` is on so a PASTED image becomes a real image node instead of
 * being dropped on the floor: the pipeline is what decides whether that node is
 * acceptable (`EMAIL_MAX_INLINE_IMAGE_BYTES`), and it can only decide about
 * nodes that exist. Rejecting a 4MB screenshot with a message that names the fix
 * beats it vanishing silently on paste.
 */
export function emailEditorExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [...EMAIL_HEADING_LEVELS] },
    }),
    Image.configure({
      inline: false,
      allowBase64: true,
    }),
  ];
}
