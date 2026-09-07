"use client";

import { AlertTriangle } from "lucide-react";
import {
  MIN_CONTRAST,
  WARN_CONTRAST,
  contrastRatio,
  toHslChannels,
} from "@/lib/theme/tenant-tokens";

export interface ContrastPair {
  label: string;
  foreground?: string | null;
  background?: string | null;
}

interface ContrastWarning {
  label: string;
  ratio: number;
  substituted: boolean;
}

/**
 * The pairs that fall below the readability guideline, and whether the
 * storefront will substitute black or white for them (the legibility floor in
 * lib/theme/tenant-tokens). Pairs with an unparseable colour are skipped.
 */
export function contrastWarnings(pairs: ContrastPair[]): ContrastWarning[] {
  return pairs.flatMap(({ label, foreground, background }) => {
    const fg = toHslChannels(foreground);
    const bg = toHslChannels(background);
    if (!fg || !bg) return [];
    const ratio = contrastRatio(fg, bg);
    return ratio < WARN_CONTRAST
      ? [{ label, ratio, substituted: ratio < MIN_CONTRAST }]
      : [];
  });
}

/**
 * The text-on-background pairs a nav, footer or section override changes.
 * Colours the override leaves unset inherit from the brand palette, exactly as
 * the storefront resolves them. Overrides that touch none of the three colours
 * produce no pairs, so the brand-level warning is not repeated.
 */
export function overridePairs(
  overrides: Record<string, string> | undefined,
  base: { textColor: string; headingColor: string; backgroundColor: string },
  scope: string,
): ContrastPair[] {
  if (!overrides) return [];
  const touched = ["background", "text", "heading"].some((key) => overrides[key]);
  if (!touched) return [];
  const background = overrides.background || base.backgroundColor;
  return [
    {
      label: `${scope} body text on its background`,
      foreground: overrides.text || base.textColor,
      background,
    },
    {
      label: `${scope} heading text on its background`,
      foreground: overrides.heading || base.headingColor,
      background,
    },
  ];
}

export function ContrastHint({ pairs }: { pairs: ContrastPair[] }) {
  const warnings = contrastWarnings(pairs);
  if (warnings.length === 0) return null;
  return (
    <ul className="space-y-1.5 text-xs text-bs-warn" role="status">
      {warnings.map((warning) => (
        <li key={warning.label} className="flex items-start gap-1.5">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            {warning.label}: {warning.ratio.toFixed(1)}:1, below the {WARN_CONTRAST}:1
            readability guideline.
            {warning.substituted &&
              " The storefront will show this text in black or white until it is fixed."}
          </span>
        </li>
      ))}
    </ul>
  );
}
