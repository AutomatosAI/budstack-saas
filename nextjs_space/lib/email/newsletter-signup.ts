/**
 * The storefront ↔ API contract for newsletter signup, shared by the browser
 * call sites and the route that serves them so the two cannot drift.
 *
 * Client-safe by construction: no prisma, no node builtins, no server-only
 * imports — the storefront section components bundle this module.
 * Server-side persistence lives in `lib/email/newsletter-subscriptions.ts`.
 */

export const NEWSLETTER_SUBSCRIBE_PATH = "/api/storefront/newsletter/subscribe";

/**
 * Where a signup came from. A closed set, not free text: `source` is attacker-
 * controlled input that lands in the database and is later shown to tenant
 * admins, so the route validates against exactly these values.
 */
export const NEWSLETTER_SOURCES = [
  "storefront-cta",
  "storefront-education",
  "checkout",
] as const;

export type NewsletterSource = (typeof NEWSLETTER_SOURCES)[number];

/** Fallback copy when the request fails without a server-vetted message. */
export const NEWSLETTER_SUBSCRIBE_ERROR =
  "We couldn't sign you up just now. Please try again.";

export interface NewsletterSubscribeResult {
  readonly ok: boolean;
  /** Only set when `ok` is false — safe to render to the visitor. */
  readonly message?: string;
}

export interface NewsletterSubscribeInput {
  readonly email: string;
  readonly source: NewsletterSource;
  /**
   * Dev/localhost fallback only. On a tenant host the server resolves the
   * tenant from the request host and ignores this; path-based local routing
   * (`/store/<slug>`) gives the API no host hint, so the slug is passed
   * through. A slug is never a tenant id — the server re-resolves it and
   * rejects a mismatch against the host it did resolve.
   */
  readonly tenantSlug?: string;
}

/**
 * POST a signup and normalise every failure — network, non-2xx, malformed
 * body — into a renderable message. Never throws: the caller renders an error
 * state instead of the success copy.
 */
export async function subscribeToNewsletter(
  input: NewsletterSubscribeInput,
): Promise<NewsletterSubscribeResult> {
  try {
    const response = await fetch(NEWSLETTER_SUBSCRIBE_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (response.ok) return { ok: true };

    const body = await response.json().catch(() => null);
    const message =
      body && typeof body.error === "string" && body.error.length > 0
        ? body.error
        : NEWSLETTER_SUBSCRIBE_ERROR;
    return { ok: false, message };
  } catch {
    return { ok: false, message: NEWSLETTER_SUBSCRIBE_ERROR };
  }
}
