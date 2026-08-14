/**
 * SEO Supercharge US-018 — everything the branded OG card shows, decided
 * without touching a canvas.
 *
 * WHY IT IS SEPARATE FROM THE ROUTE. `app/api/public/og/route.tsx` does I/O:
 * resolve the tenant, gate on the plan, read the logo bytes, hand a React tree
 * to `ImageResponse`. What the card SAYS — which colour, which text on top of
 * it, what the headline is when the title is empty, which host to print — is
 * decision-making that should be assertable without rendering a PNG. So it
 * lives here, pure, and the route is left with the parts a unit test cannot
 * reach anyway.
 *
 * EVERY FIELD COMES FROM THE TENANT ROW, none from the query string. That is
 * the property that makes the public route safe to expose: the only thing a
 * caller controls is the headline text (capped in `og-image.ts`), and the
 * branding around it is whatever the host resolves to.
 *
 * Total, like every builder in `lib/seo/`: a malformed colour, a missing name
 * or a custom domain that `new URL` rejects each degrade to a stated default.
 */

import { hslToHex } from "@/lib/color-utils";
import { storeCanonical } from "@/lib/seo/canonical";
import type { OgImageKind } from "@/lib/seo/og-image";
import { OG_IMAGE_TITLE_MAX_LENGTH } from "@/lib/seo/og-image";
import {
  seoText,
  storeDisplayName,
  truncateSeoText,
} from "@/lib/seo/store-identity";

/**
 * The card's colour when the tenant has no usable brand colour. Deliberately
 * the same value as `tenant_branding.primaryColor`'s DB-level default
 * (prisma/schema.prisma) — a tenant that has never opened the branding form
 * gets the identical card either way.
 */
export const OG_CARD_FALLBACK_BRAND = "#10b981";

/** The two text colours the card picks between, by contrast against the brand. */
export const OG_CARD_LIGHT_TEXT = "#ffffff";
export const OG_CARD_DARK_TEXT = "#0b1220";

/** A colour string we are willing to hand to a renderer. */
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * The label above the headline. Empty for the two kinds where it would state
 * the obvious: a store card already says the store's name, and "Page" is not
 * information.
 */
const OG_CARD_LABELS: Readonly<Record<OgImageKind, string>> = {
  store: "",
  page: "",
  product: "PRODUCT",
  article: "ARTICLE",
  condition: "CONDITION",
};

/**
 * A brand colour safe to render, normalising the two shapes the platform
 * stores: `tenant_branding.primaryColor` is hex, while a template's
 * `designSystem` colour can be raw HSL channels ("275 70% 55%" — the
 * `:root` var convention). `hslToHex` converts the second and passes the first
 * through UNCHECKED, which is why the result is re-validated here: an
 * unparseable value reaching the renderer is an exception inside an image
 * route, and this route must always be able to answer with an image.
 */
export function ogCardBrandColor(value: unknown): string {
  const raw = seoText(value);
  if (!raw) return OG_CARD_FALLBACK_BRAND;

  const hex = hslToHex(raw, OG_CARD_FALLBACK_BRAND);
  return HEX_COLOR.test(hex) ? hex : OG_CARD_FALLBACK_BRAND;
}

/** One sRGB channel, linearised for the luminance sum below. */
function linearChannel(value: number): number {
  const channel = value / 255;
  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

/**
 * Black or white text, whichever a reader can actually see on `hex`.
 *
 * WCAG relative luminance with the standard 0.179 switch point — the value at
 * which white-on-colour and black-on-colour give the same contrast ratio. A
 * brand colour is whatever the owner typed, and half the palettes in use are
 * pale; hardcoding white text would make those cards illegible.
 */
export function readableTextColor(hex: string): string {
  const digits = hex.replace(/^#/, "");
  const full =
    digits.length === 3
      ? digits
          .split("")
          .map((char) => char + char)
          .join("")
      : digits;

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return OG_CARD_LIGHT_TEXT;

  const luminance =
    0.2126 * linearChannel(r) +
    0.7152 * linearChannel(g) +
    0.0722 * linearChannel(b);

  return luminance > 0.179 ? OG_CARD_DARK_TEXT : OG_CARD_LIGHT_TEXT;
}

/**
 * Up to two initials for a store with no logo — a monogram chip is a deliberate
 * mark, where an empty square reads as a failed image.
 */
export function storeInitials(businessName: string): string {
  const words = businessName.split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export interface OgCardSource {
  readonly businessName: unknown;
  readonly subdomain: unknown;
  readonly customDomain: string | null;
  /** `tenant_branding.primaryColor`, or a template design-system primary. */
  readonly brandColor: unknown;
  readonly kind: OgImageKind;
  /** Already capped by `parseOgImageRequest`; "" for the plain store card. */
  readonly title: string;
}

export interface OgCardModel {
  readonly label: string;
  readonly headline: string;
  /** "" when it would merely repeat the headline (the store card). */
  readonly footerName: string;
  /** The tenant's primary host, no scheme — the domain a shopper will land on. */
  readonly host: string;
  readonly background: string;
  readonly foreground: string;
  readonly initials: string;
}

/**
 * Everything the card renders, resolved from one tenant row plus the request's
 * `kind`/`title`.
 *
 * The host is derived from `storeCanonical(tenant, "")` rather than re-derived
 * here, so the domain printed on the card is by construction the same primary
 * host US-007 puts in the canonical tag — a card advertising the subdomain
 * while the page canonicalises to the custom domain would be its own small lie.
 */
export function buildOgCardModel(source: OgCardSource): OgCardModel {
  const businessName = storeDisplayName(source.businessName, source.subdomain);
  const headline =
    truncateSeoText(source.title, OG_IMAGE_TITLE_MAX_LENGTH) || businessName;

  const background = ogCardBrandColor(source.brandColor);

  return {
    label: OG_CARD_LABELS[source.kind] ?? "",
    headline,
    footerName: headline === businessName ? "" : businessName,
    host: storeCanonical(
      {
        subdomain: seoText(source.subdomain),
        customDomain: source.customDomain,
      },
      "",
    ).replace(/^https?:\/\//i, ""),
    background,
    foreground: readableTextColor(background),
    initials: storeInitials(businessName),
  };
}
