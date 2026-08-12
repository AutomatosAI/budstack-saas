/**
 * US-014 — the shell's geometry, in ONE place.
 *
 * An image inserted into the composer is sized against the width of the region
 * it will land in, which is decided by `emails/email-shell.tsx`: a 600px card
 * with 32px of padding on each side. That arithmetic used to exist only as two
 * literals inside the shell's style objects, so anything sizing content to fit
 * it had to restate the answer and hope the shell never moved.
 *
 * Numbers, not CSS strings, because both consumers need them in different
 * forms: the shell writes `${n}px` into a style object, and the composer does
 * arithmetic with them (`Math.min(naturalWidth, contentWidth)`).
 *
 * Isomorphic on purpose — the composer imports this in the browser, so nothing
 * here may pull in react-email or any server-only module.
 */

/** Outer width of the message card. The email industry's de facto standard. */
export const EMAIL_CARD_WIDTH_PX = 600;

/** Horizontal padding either side of the authored region, inside the card. */
export const EMAIL_CONTENT_PADDING_PX = 32;

/**
 * The widest an image can be drawn without spilling past the card's padding.
 *
 * This is the ceiling `constrainEmailImageWidth` clamps to
 * (`lib/email/email-image-node.ts`), so a 4000px photo arrives sized to the
 * column instead of stretching the message in clients that honour the `width`
 * attribute but not `max-width` — which is most of Outlook.
 */
export const EMAIL_CONTENT_WIDTH_PX =
  EMAIL_CARD_WIDTH_PX - EMAIL_CONTENT_PADDING_PX * 2;
