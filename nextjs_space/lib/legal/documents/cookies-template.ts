/**
 * Operator cookie notice.
 *
 * Cookies are set on the operator's own domain, so the notice has to come from
 * the operator. PECR consent is theirs to obtain and theirs to answer for.
 */

export const COOKIES_TEMPLATE_VERSION = "1.0.0";

export const COOKIES_REQUIRED_TOKENS = [
  "controllerLegalName",
  "privacyContactEmail",
] as const;

export const COOKIES_TEMPLATE = `
## Cookies on this site

This site is operated by **{{controllerLegalName}}**. Cookies are small files stored on your device when you visit. Some are needed for the site to work; the rest are only set if you agree.

## What we use

**Strictly necessary.** These keep you signed in, remember what is in your basket, secure the checkout, and protect against fraud. The site cannot function without them, so they do not require your consent and cannot be turned off.

**Analytics.** These tell us which pages are used and where people run into difficulty, so we can improve the site. They are only set once you agree.

**Preferences.** These remember choices you have made, such as display settings. They are only set once you agree.

We do not use cookies to build advertising profiles, and we do not sell information collected through cookies.

## Your choice

When you first visit, you are asked what you are willing to accept. Nothing beyond the strictly necessary cookies is set until you decide.

You can change your mind at any time through the cookie settings link in the footer of every page. You can also block or delete cookies in your browser, though the site may not work properly if you block the necessary ones.

## Cookies set by others

Some functions rely on third parties — payment processing, and the platform this store runs on. Where those set cookies, they do so under their own notices, and only for the purposes described above.

## Questions

Ask us at **{{privacyContactEmail}}**. Our privacy policy explains more about how personal information is handled, including your rights over it.
`.trim();
