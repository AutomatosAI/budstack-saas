/**
 * US-014 — the image node, with the one attribute an email actually needs.
 *
 * `@tiptap/extension-image` ships `src`, `alt` and `title`. An email needs a
 * fourth: the `width` ATTRIBUTE.
 *
 * WHY THE ATTRIBUTE AND NOT CSS. `lib/email/email-body-css.ts` already sets
 * `max-width: 100%` on images and juice inlines it, which is enough for every
 * client that implements CSS. Outlook on Windows renders through Word, which
 * ignores `max-width` and draws the image at its intrinsic size — so a 4000px
 * photo blows the 600px card apart in exactly the client most likely to be
 * reading it. The `width` attribute is the one sizing instruction Word does
 * honour, which is also why `lib/email/email-render-pipeline.ts` leaves juice's
 * width mirroring switched on while disabling its height mirroring.
 *
 * `height` is deliberately never set: with a width and no height, every client
 * scales proportionally. Writing both would distort any image whose stored
 * dimensions drift from the file.
 *
 * The attribute survives the sanitizer — `img` already allows `width` in
 * `lib/security/email-sanitize.ts`. No allow-list change was needed and none
 * would have been made.
 *
 * Isomorphic: the composer builds an editor from this in the browser and
 * `email-render-pipeline.ts` renders stored documents with it in a route
 * handler, so no React and no server-only imports.
 */

import Image from "@tiptap/extension-image";

import { EMAIL_CONTENT_WIDTH_PX } from "@/lib/email/email-layout";

/** The node name, fixed by the upstream extension. */
export const EMAIL_IMAGE_NAME = "image";

/**
 * The width to store for an image whose intrinsic width is `naturalWidth`.
 *
 * Clamped, never stretched: an image narrower than the column keeps its own
 * size, because upscaling a 120px logo to fill the card is a worse default than
 * leaving it alone. Null for anything unmeasurable — a missing attribute means
 * "let the client decide", which is the pre-US-014 behaviour.
 */
export function constrainEmailImageWidth(
  naturalWidth: number | null | undefined,
): number | null {
  if (typeof naturalWidth !== "number") return null;
  if (!Number.isFinite(naturalWidth) || naturalWidth <= 0) return null;
  return Math.min(Math.round(naturalWidth), EMAIL_CONTENT_WIDTH_PX);
}

/**
 * Read a `width` back as a column-constrained integer, or null.
 *
 * Clamped here as well as at insert time because `contentJson` arrives in a
 * request body: the composer is not the only way a document can be written, and
 * a stored `width: 999999` would otherwise render straight into the message.
 * Parsing to a NUMBER is also what makes the attribute uninjectable — anything
 * that is not a number at the front becomes NaN and then no attribute at all.
 */
function widthAttributeValue(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  return constrainEmailImageWidth(parsed);
}

export const EmailImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        // Matched on paste and on the server's `Node.fromJSON` round trip, so a
        // sized image copied inside the editor stays sized.
        parseHTML: (element) => widthAttributeValue(element.getAttribute("width")),
        renderHTML: (attributes) => {
          const width = widthAttributeValue(attributes.width);
          return width === null ? {} : { width: String(width) };
        },
      },
    };
  },
});

export default EmailImage;
