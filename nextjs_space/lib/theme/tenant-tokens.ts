import { hexToHsl } from "@/lib/color-utils";

/**
 * Tenant colour → CSS token derivation: the storefront theming contract.
 *
 * A tenant sets up to eight colours in the branding form (primary, secondary,
 * accent, background, surface, text, heading, border). Storefront code consumes
 * them two ways: the `--tenant-color-*` variables (inline styles in store pages
 * and section components) and the shadcn tokens (`bg-card`, `text-foreground`,
 * `text-muted-foreground`, …) that every `components/ui` primitive is built on.
 *
 * Before this module only five shadcn tokens were remapped per tenant
 * (primary, secondary, accent, background, foreground). Card, popover, muted,
 * border, input, ring and every `*-foreground` stayed at the light `:root`
 * defaults, so a dark palette rendered white cards with white text (LekkerWeed
 * dashboard and orders pages, September 2026). This module derives the COMPLETE
 * set from the tenant palette, fills in the colours a tenant did not set, and
 * applies a legibility floor: a foreground that falls below MIN_CONTRAST against
 * the surface it sits on is replaced by black or white, whichever reads.
 *
 * Pure and framework-free so the same numbers are produced on the server (the
 * container's inline style, hence no first-paint flash), in the browser, and in
 * the branding editor preview.
 */

/** Below this ratio the storefront substitutes black or white (WCAG large-text AA). */
export const MIN_CONTRAST = 3;
/** Below this ratio the branding form warns the operator (WCAG body-text AA). */
export const WARN_CONTRAST = 4.5;

/** The `:root` values in app/globals.css — the partner of a colour the tenant left unset. */
const ROOT_BACKGROUND = "216 20% 95%";
const ROOT_FOREGROUND = "222 47% 11%";
const WHITE = "0 0% 100%";
const BLACK = "0 0% 0%";

/** Luminance at which black-on-colour and white-on-colour contrast equally. */
const LUMINANCE_SWITCH = 0.179;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const CHANNELS = /^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/;

/**
 * Normalise anything an operator or a template may have stored — `#abc`,
 * `#aabbcc`, `hsl(280, 45%, 8%)`, `280 45% 8%` — to raw HSL channels, the only
 * form `hsl(var(--x))` accepts. Anything else (named colours, nested colour
 * scales, blanks) is `null` and the caller skips it.
 */
export function toHslChannels(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let v = value.trim();
  if (!v) return null;
  if (/^hsla?\(/i.test(v) && v.endsWith(")")) {
    // Drop the alpha channel in either syntax: "h s% l% / a" or "h, s%, l%, a".
    v = v
      .slice(v.indexOf("(") + 1, -1)
      .split("/")[0]
      .replace(/,/g, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 3)
      .join(" ");
  }
  if (HEX.test(v)) return hexToHsl(v);
  const m = v.replace(/\s+/g, " ").match(CHANNELS);
  return m ? `${m[1]} ${m[2]}% ${m[3]}%` : null;
}

function parseChannels(channels: string): [number, number, number] {
  const m = channels.match(CHANNELS);
  if (!m) return [0, 0, 0];
  return [parseFloat(m[1]), parseFloat(m[2]) / 100, parseFloat(m[3]) / 100];
}

function toRgb(channels: string): [number, number, number] {
  const [h, s, l] = parseChannels(channels);
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return 255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1));
  };
  return [f(0), f(8), f(4)];
}

function rgbToChannels(r: number, g: number, b: number): string {
  const rr = r / 255;
  const gg = g / 255;
  const bb = b / 255;
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rr) h = (gg - bb) / d + (gg < bb ? 6 : 0);
    else if (max === gg) h = (bb - rr) / d + 2;
    else h = (rr - gg) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function linearChannel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an HSL channel string. */
export function relativeLuminance(channels: string): number {
  const [r, g, b] = toRgb(channels);
  return 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b);
}

/** WCAG contrast ratio between two HSL channel strings, 1 (identical) to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever a reader can see on `background`. */
export function readableOn(background: string): string {
  return relativeLuminance(background) > LUMINANCE_SWITCH ? BLACK : WHITE;
}

/** Mix two colours in RGB space; `weight` is the share of `b` (0..1). */
export function mixChannels(a: string, b: string, weight: number): string {
  const w = Math.min(1, Math.max(0, weight));
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  return rgbToChannels(
    ar + (br - ar) * w,
    ag + (bg - ag) * w,
    ab + (bb - ab) * w,
  );
}

function isDark(channels: string): boolean {
  return relativeLuminance(channels) <= LUMINANCE_SWITCH;
}

function ensureContrast(foreground: string, background: string): string {
  return contrastRatio(foreground, background) >= MIN_CONTRAST
    ? foreground
    : readableOn(background);
}

function camelToKebab(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * The full set of CSS custom properties for a tenant's `designSystem.colors`.
 *
 * Returned keys:
 * - `--tenant-color-<key>` for every colour the tenant stored (verbatim, as
 *   before), plus derived `surface`, `border`, `muted`, `muted-foreground`
 *   when they were not stored, so section fallbacks always resolve;
 * - the shadcn tokens: background/foreground, card, popover, muted, border,
 *   input, ring, and primary/secondary/accent with a computed foreground.
 *
 * Guarantees: `--foreground` and `--tenant-color-text` read against
 * `--background`; `--card-foreground` and `--muted-foreground` read against
 * `--card`; `--primary-foreground` (and secondary/accent) read against their
 * colour. Everything else is the tenant's choice untouched.
 */
export function deriveTenantTokens(
  colors: object | null | undefined,
): Record<string, string> {
  if (!colors || typeof colors !== "object") return {};
  const source = colors as Record<string, unknown>;
  const tokens: Record<string, string> = {};

  for (const [key, value] of Object.entries(source)) {
    const channels = toHslChannels(value);
    if (channels) tokens[`--tenant-color-${camelToKebab(key)}`] = channels;
  }
  if (Object.keys(tokens).length === 0) return {};

  const pick = (key: string) => toHslChannels(source[key]);

  const background = pick("background") ?? ROOT_BACKGROUND;
  const chosenText = pick("text") ?? ROOT_FOREGROUND;
  const text = ensureContrast(chosenText, background);
  const heading = ensureContrast(pick("heading") ?? chosenText, background);
  // An unset surface is white on a light page (today's default) and a slightly
  // lifted shade of the page on a dark one — the usual "elevated" dark surface.
  const surface = pick("surface") ?? (isDark(background) ? mixChannels(background, WHITE, 0.07) : WHITE);
  const cardForeground = ensureContrast(chosenText, surface);
  const border = pick("border") ?? mixChannels(surface, cardForeground, 0.12);
  const muted = mixChannels(surface, cardForeground, 0.06);
  // Checked against `muted`, the surface `text-muted-foreground` actually sits on.
  const mutedForeground = ensureContrast(mixChannels(cardForeground, surface, 0.4), muted);

  Object.assign(tokens, {
    "--tenant-color-background": background,
    "--tenant-color-text": text,
    "--tenant-color-heading": heading,
    "--tenant-color-surface": surface,
    "--tenant-color-border": border,
    "--tenant-color-muted": muted,
    "--tenant-color-muted-foreground": mutedForeground,
    "--background": background,
    "--foreground": text,
    "--card": surface,
    "--card-foreground": cardForeground,
    "--popover": surface,
    "--popover-foreground": cardForeground,
    "--muted": muted,
    "--muted-foreground": mutedForeground,
    "--border": border,
    "--input": border,
  });

  const primary = pick("primary");
  if (primary) {
    tokens["--primary"] = primary;
    tokens["--primary-foreground"] = readableOn(primary);
    tokens["--ring"] = primary;
  }
  const secondary = pick("secondary");
  if (secondary) {
    tokens["--secondary"] = secondary;
    tokens["--secondary-foreground"] = readableOn(secondary);
  }
  const accent = pick("accent");
  if (accent) {
    tokens["--accent"] = accent;
    tokens["--accent-foreground"] = readableOn(accent);
  }

  return tokens;
}

/**
 * Inline `--tenant-color-*` variables for a nav, footer or section colour
 * override, with the same legibility floor as the page palette.
 *
 * `defaults` are applied first (the dark footer presets), `overrides` on top.
 * `base` is the tenant's page palette: when an override changes the background
 * but inherits the text or heading, the inherited colour is checked against
 * the NEW background and replaced if it no longer reads — the case where a
 * dark-theme tenant gives one section a white background.
 */
export function buildColorOverrideVars(
  overrides: object | null | undefined,
  options: {
    defaults?: object | null;
    base?: object | null;
  } = {},
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const source of [options.defaults, overrides]) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source as Record<string, unknown>)) {
      const channels = toHslChannels(value);
      if (channels) merged[key] = channels;
    }
  }
  if (Object.keys(merged).length === 0) return {};

  const base = (options.base ?? {}) as Record<string, unknown>;
  const baseColor = (key: string) => toHslChannels(base[key]);
  const background = merged.background ?? baseColor("background");
  if (background) {
    const text = merged.text ?? baseColor("text");
    if (text && contrastRatio(text, background) < MIN_CONTRAST) {
      merged.text = readableOn(background);
    }
    const heading = merged.heading ?? baseColor("heading");
    if (heading && contrastRatio(heading, background) < MIN_CONTRAST) {
      merged.heading = readableOn(background);
    }
  }

  return Object.fromEntries(
    Object.entries(merged).map(([key, value]) => [`--tenant-color-${key}`, value]),
  );
}
