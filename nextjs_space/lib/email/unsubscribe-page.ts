/**
 * The standalone HTML the unsubscribe route serves (US-004).
 *
 * A hand-built document rather than a React page because the same URL has to
 * answer POST for RFC 8058 one-click, which only an API route can do. Kept
 * deliberately plain: no scripts, no fonts, no external requests, so it renders
 * identically inside an in-app mail browser and cannot be broken by the CSP
 * (`script-src` carries no 'unsafe-inline'; `style-src` does, which is why the
 * styling is a single inline <style> block).
 *
 * Escape-first: every interpolated value — the store name, which is tenant
 * controlled, and the token — goes through escapeHtml before it reaches the
 * markup, so the only tags in the output are the ones this module emits.
 */

import { escapeHtml } from "@/lib/legal/markdown";
import {
  NEWSLETTER_UNSUBSCRIBE_PATH,
  type UnsubscribeCopy,
} from "@/lib/email/newsletter-unsubscribe";

const STYLES = `
  :root { color-scheme: light dark; }
  body {
    margin: 0; padding: 2.5rem 1.25rem;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #f6f7f9; color: #16181d; line-height: 1.55;
  }
  main {
    max-width: 30rem; margin: 0 auto; padding: 2rem;
    background: #ffffff; border: 1px solid #e4e6eb; border-radius: 0.75rem;
  }
  h1 { margin: 0 0 0.75rem; font-size: 1.25rem; line-height: 1.3; }
  p { margin: 0 0 1.5rem; color: #4a4f57; }
  p:last-child { margin-bottom: 0; }
  button {
    font: inherit; font-weight: 600; cursor: pointer;
    padding: 0.7rem 1.4rem; border: 0; border-radius: 0.5rem;
    background: #16181d; color: #ffffff;
  }
  .store { margin: 1.5rem 0 0; font-size: 0.8125rem; color: #767b84; }
`;

function document(storeName: string, copy: UnsubscribeCopy, action: string) {
  const store = escapeHtml(storeName);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtml(copy.title)}</title>
<style>${STYLES}</style>
</head>
<body>
<main>
<h1>${escapeHtml(copy.title)}</h1>
<p>${escapeHtml(copy.body)}</p>
${action}
<p class="store">${store}</p>
</main>
</body>
</html>
`;
}

/**
 * The GET page: a confirmation step, never a one-click GET. Mail scanners and
 * link prefetchers follow every URL in a message, so unsubscribing on GET would
 * quietly remove people who never clicked anything.
 */
export function renderUnsubscribePrompt(
  storeName: string,
  copy: UnsubscribeCopy,
  token: string,
): string {
  const action = `${NEWSLETTER_UNSUBSCRIBE_PATH}?token=${escapeHtml(encodeURIComponent(token))}`;
  return document(
    storeName,
    copy,
    `<form method="post" action="${action}"><button type="submit">Unsubscribe</button></form>`,
  );
}

/** The page shown after a POST — outcome only, nothing left to click. */
export function renderUnsubscribeResult(
  storeName: string,
  copy: UnsubscribeCopy,
): string {
  return document(storeName, copy, "");
}

/**
 * Headers every response from this route carries. `no-store` because a shared
 * cache holding an unsubscribe page keyed on a token would serve one person's
 * link to another; `noindex` because these URLs end up pasted into forums.
 */
export const UNSUBSCRIBE_PAGE_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};
