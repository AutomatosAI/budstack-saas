/**
 * US-011/US-012 — the ONE stylesheet for the authored region of an email.
 *
 * The save pipeline hands it to juice, which inlines every declaration onto the
 * elements; the composer loads the same string into a `<style>` tag so what an
 * author sees while writing is styled by the rules that will be inlined into
 * what they send. Two consumers, one sheet — the same arrangement, and for the
 * same reason, as `lib/email/editor-extensions.ts`.
 *
 * Isomorphic (a string and a class name, nothing else) because one of those
 * consumers runs in the browser.
 *
 * EVERY DECLARATION IS WRITTEN TO THE SANITIZER. `lib/security/email-sanitize.ts`
 * re-checks all of them after juice has inlined them, so this sheet uses
 * longhand margins, no `border-left`, and no shorthand `padding` — the shapes
 * its allow-list accepts. When something does not survive, this file changes;
 * the allow-list does not.
 */

/** Marks the authored region inside the shell so these rules can be scoped. */
export const EMAIL_BODY_CLASS = "bs-email-body";

/**
 * Colour is deliberately absent: the shell's content wrapper already sets it,
 * and re-declaring it on every block would drag links into body colour too.
 */
export const EMAIL_BODY_CSS = `
.${EMAIL_BODY_CLASS} p { margin-top: 0; margin-bottom: 16px; font-size: 16px; line-height: 24px; }
.${EMAIL_BODY_CLASS} h1 { margin-top: 0; margin-bottom: 16px; font-size: 28px; line-height: 34px; font-weight: bold; }
.${EMAIL_BODY_CLASS} h2 { margin-top: 0; margin-bottom: 12px; font-size: 22px; line-height: 28px; font-weight: bold; }
.${EMAIL_BODY_CLASS} h3 { margin-top: 0; margin-bottom: 12px; font-size: 18px; line-height: 24px; font-weight: bold; }
.${EMAIL_BODY_CLASS} ul { margin-top: 0; margin-bottom: 16px; padding-left: 24px; }
.${EMAIL_BODY_CLASS} ol { margin-top: 0; margin-bottom: 16px; padding-left: 24px; }
.${EMAIL_BODY_CLASS} li { margin-bottom: 8px; font-size: 16px; line-height: 24px; }
.${EMAIL_BODY_CLASS} li p { margin-top: 0; margin-bottom: 0; }
.${EMAIL_BODY_CLASS} a { text-decoration: underline; }
.${EMAIL_BODY_CLASS} img { max-width: 100%; height: auto; display: block; }
.${EMAIL_BODY_CLASS} blockquote { margin-top: 0; margin-bottom: 16px; margin-left: 0; padding-left: 16px; }
.${EMAIL_BODY_CLASS} hr { border-width: 1px; border-style: solid; border-color: #e5e7eb; margin-top: 24px; margin-bottom: 24px; }
`;
