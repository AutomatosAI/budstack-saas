/**
 * SEO Supercharge US-018 — the branded social preview, and the URL that asks
 * for one.
 *
 * THE DEFECT THIS CLOSES: a store's `og:image` was whatever the owner had
 * pasted or uploaded, and for most pages that is nothing at all. A link with no
 * `og:image` renders in Slack, WhatsApp, LinkedIn and X as a bare grey row —
 * the least clickable thing a storefront can put in front of a shopper. This is
 * the fallback that gives every Pro page a 1200x630 card carrying the tenant's
 * own logo, brand colour and the page's title.
 *
 * WHAT GOES IN THE URL, AND WHY SO LITTLE. Exactly two parameters — `kind` (a
 * closed enum) and `title` (a capped string). Everything that makes the card the
 * TENANT's — logo, brand colour, business name, host — is resolved by the route
 * from the request HOST, never from the query, so a crafted URL cannot dress one
 * store's card in another store's branding. `title` is the one caller-controlled
 * pixel and it is bounded on both ends: this builder truncates before it emits,
 * and {@link parseOgImageRequest} refuses anything longer on the way back in.
 *
 * PRO ONLY, BY DEGRADING (the `lib/entitlements/require-feature.ts` storefront
 * contract). `brandedOgImage` returns null for a tenant without `seo.pro`, and
 * every caller spreads it conditionally — a Basic tenant emits the same tags it
 * emitted before this story, never a broken image and never a 404 in its head.
 *
 * PURE MODULE — no next, no prisma, no request. It runs inside
 * `generateMetadata`, which has no `error.tsx` boundary above it, so a malformed
 * plan value or title must degrade to omission rather than throw a blank page.
 */

import { z } from "zod";

import { isSeoProUnlocked } from "@/lib/seo/pro-features";
import { seoText, truncateSeoText } from "@/lib/seo/store-identity";

/** The public route that renders the card. Registered in both auth gates. */
export const OG_IMAGE_ROUTE = "/api/public/og";

/**
 * The one size every scraper crops from. 1200x630 is the 1.91:1 Facebook/X/
 * LinkedIn large-card ratio; declaring it in the tag (which the builders do,
 * and never do for an image an owner supplied) is what stops a scraper
 * re-measuring or letter-boxing it.
 */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/**
 * How much title the card can hold. Two lines at the headline size, measured
 * against the widest characters — past this the text would either overflow the
 * canvas or shrink to unreadable. Also the cap the route enforces, so the
 * longest possible render is a known quantity.
 */
export const OG_IMAGE_TITLE_MAX_LENGTH = 90;

/**
 * Which page family the card is for. Drives the small label above the headline
 * only — never the branding, which comes from the host-resolved tenant.
 */
export const OG_IMAGE_KINDS = [
  "store",
  "page",
  "product",
  "article",
  "condition",
] as const;

export type OgImageKind = (typeof OG_IMAGE_KINDS)[number];

export const OG_IMAGE_KIND_PARAM = "kind";
export const OG_IMAGE_TITLE_PARAM = "title";

export interface BrandedOgImageSource {
  /** `tenants.id` — the plan gate's subject. */
  readonly tenantId?: string;
  /** Raw `tenants.plan`; parsed fail-closed, so an absent value means Basic. */
  readonly plan?: unknown;
  readonly kind: OgImageKind;
  /** The page's own headline. Omitted from the URL when there is nothing to say. */
  readonly title?: unknown;
}

/** An `openGraph.images` entry Next renders as og:image + its dimensions. */
export interface OgImageDescriptor {
  readonly url: string;
  readonly width: number;
  readonly height: number;
}

/**
 * The origin-relative URL of this page's branded card, or null when the tenant
 * is not on Pro.
 *
 * ORIGIN-RELATIVE for the reason `storedPublicImagePath` is: Next absolutises it
 * against the store layout's `metadataBase` (US-001), which is the tenant's own
 * primary host — so the rendered `og:image` is absolute, as every scraper
 * requires, and it points at the host that owns the content rather than the
 * platform apex.
 */
export function brandedOgImageUrl(source: BrandedOgImageSource): string | null {
  if (!isSeoProUnlocked({ id: source.tenantId ?? "", plan: source.plan })) {
    return null;
  }

  const params = new URLSearchParams();
  params.set(OG_IMAGE_KIND_PARAM, source.kind);

  // Truncated here rather than at render time so the URL a crawler caches and
  // the image it gets back cannot disagree, and so the parser's cap is only
  // ever tripped by a hand-crafted request.
  const title = truncateSeoText(source.title, OG_IMAGE_TITLE_MAX_LENGTH);
  if (title) params.set(OG_IMAGE_TITLE_PARAM, title);

  return `${OG_IMAGE_ROUTE}?${params.toString()}`;
}

/**
 * The same URL as an `openGraph.images` entry with its dimensions declared, or
 * null for a Basic tenant.
 *
 * Width and height are stated because — unlike an owner-pasted URL or an
 * upstream product photo — this image is a size we control exactly. The other
 * builders deliberately declare nothing for those.
 */
export function brandedOgImage(
  source: BrandedOgImageSource,
): OgImageDescriptor | null {
  const url = brandedOgImageUrl(source);
  return url
    ? { url, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT }
    : null;
}

export interface OgImageRequest {
  readonly kind: OgImageKind;
  /** "" when none was supplied, or when what was supplied failed validation. */
  readonly title: string;
}

/**
 * The Zod boundary for the route's query string. Both fields are optional and
 * validated independently of each other, so one bad parameter cannot smuggle
 * the other past its own rule.
 */
const ogImageQuerySchema = z.object({
  kind: z.enum(OG_IMAGE_KINDS).optional(),
  title: z.string().max(OG_IMAGE_TITLE_MAX_LENGTH).optional(),
});

/**
 * Parse the route's query string, fail-closed: an unknown `kind`, an over-long
 * `title`, or anything else unexpected collapses to the plain store card rather
 * than to an error. The route must always be able to answer with an image —
 * a 500 in an `og:image` is a broken preview on a page that is otherwise fine.
 */
export function parseOgImageRequest(params: URLSearchParams): OgImageRequest {
  const parsed = ogImageQuerySchema.safeParse({
    kind: params.get(OG_IMAGE_KIND_PARAM) ?? undefined,
    title: params.get(OG_IMAGE_TITLE_PARAM) ?? undefined,
  });

  if (!parsed.success) return { kind: "store", title: "" };

  return {
    kind: parsed.data.kind ?? "store",
    title: seoText(parsed.data.title),
  };
}
