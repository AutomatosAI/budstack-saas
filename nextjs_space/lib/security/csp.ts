// Per-request Content-Security-Policy construction for PRD-218 (AC-2).
//
// The policy here mirrors the previous static next.config.js headers() policy
// directive-for-directive, with ONE security change: script-src no longer
// carries 'unsafe-inline'. Instead each request gets a fresh nonce plus
// 'strict-dynamic', so a missed XSS sink cannot execute an injected <script>.
//
// Generated per request in middleware.ts (Edge runtime) — uses Web Crypto
// (global `crypto`) which exists in both the Edge runtime and Node, never
// node:crypto (absent on Edge).

export type CspVariant = "base" | "admin" | "store";

/**
 * SEO US-026 — the Google Analytics 4 hosts, added to the STORE variant only so
 * the admin app and the platform pages keep the narrower policy. `region1.` …
 * `region14.google-analytics.com` is why the collect host is a wildcard.
 */
const GA4_SCRIPT_HOSTS = ["https://www.googletagmanager.com"] as const;
const GA4_CONNECT_HOSTS = [
  "https://www.google-analytics.com",
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
  "https://www.googletagmanager.com",
] as const;
const GA4_IMG_HOSTS = [
  "https://www.google-analytics.com",
  "https://www.googletagmanager.com",
] as const;

/**
 * Fresh per-request nonce: 16 random bytes (128-bit) base64-encoded. Never
 * reused across requests; generated once per request in middleware.
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

/**
 * Build the CSP header string for a given request scope.
 *
 * - base  — every route: frame-ancestors 'none'
 * - admin — analytics pages: adds 'unsafe-eval' for plotly.js; frame-ancestors 'none'
 * - store — storefront: frame-ancestors 'self' for the editor iframe viewport switcher
 *
 * script-src keeps the Clerk + Cloudflare host allowlist for CSP2-only browsers;
 * CSP3 browsers ignore the allowlist under 'strict-dynamic' and trust scripts
 * transitively via the nonce.
 */
export function buildCsp({
  nonce,
  variant = "base",
}: {
  nonce: string;
  variant?: CspVariant;
}): string {
  const store = variant === "store";

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    ...(variant === "admin" ? ["'unsafe-eval'"] : []),
    "https://*.clerk.accounts.dev",
    "https://challenges.cloudflare.com",
    // SEO US-026: gtag.js, on the storefront only (nothing in the admin app
    // loads GA4). CSP3 browsers ignore this under 'strict-dynamic' — the tag is
    // injected client-side by next/script and inherits trust that way, and it
    // carries the per-request nonce besides — so this entry is the CSP2
    // fallback. The three directives below are the ones that actually decide
    // whether GA4 can report: 'strict-dynamic' does not apply to them.
    ...(store ? GA4_SCRIPT_HOSTS : []),
  ].join(" ");

  const frameAncestors = store ? "'self'" : "'none'";

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // style-src keeps 'unsafe-inline' — AC-2 only requires script-src to drop
    // it; nonce-ing every Tailwind/inline style is impractical and low-value.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    // GA4 falls back to an image beacon when fetch/sendBeacon is unavailable.
    `img-src 'self' data: blob: https://*.amazonaws.com https://img.clerk.com https://stage-api.drgreennft.com https://api.drgreennft.com https://cdn.abacus.ai${store ? ` ${GA4_IMG_HOSTS.join(" ")}` : ""}`,
    "media-src 'self' blob: https://*.amazonaws.com",
    // Where the measurement protocol actually posts. Without these the tag loads
    // and every hit is blocked, which looks exactly like "analytics is broken".
    `connect-src 'self' https://*.clerk.accounts.dev https://api.clerk.com https://*.drgreennft.com https://*.amazonaws.com wss://*.clerk.accounts.dev${store ? ` ${GA4_CONNECT_HOSTS.join(" ")}` : ""}`,
    "frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev",
    `frame-ancestors ${frameAncestors}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://*.clerk.accounts.dev",
    "upgrade-insecure-requests",
  ];

  return directives.join("; ");
}

/**
 * Pick the CSP variant for the path actually being served (after middleware
 * rewrites). Analytics pages need 'unsafe-eval' (plotly); store pages need
 * frame-ancestors 'self' for the editor iframe viewport switcher.
 */
export function variantForServedPath(servedPath: string): CspVariant {
  if (servedPath.startsWith("/store")) return "store";
  if (
    servedPath === "/tenant-admin/analytics" ||
    servedPath === "/super-admin/analytics"
  ) {
    return "admin";
  }
  return "base";
}

/**
 * Attach the per-request nonce CSP to a response. Replaces the static
 * next.config.js CSP — a config header cannot carry a per-request nonce, so the
 * policy is emitted in the per-request edge (middleware) instead.
 */
export function applyCsp<T extends { headers: Headers }>(
  res: T,
  nonce: string,
  variant: CspVariant,
): T {
  res.headers.set("Content-Security-Policy", buildCsp({ nonce, variant }));
  return res;
}
