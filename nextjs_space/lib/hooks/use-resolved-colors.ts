'use client';

import { useRef, useState, useEffect } from 'react';
import { hslToHex } from '@/lib/color-utils';

/**
 * Resolve tenant theme colors for use in WebGL shaders and other non-CSS contexts.
 *
 * CSS `var()` references don't work in JavaScript (shaders, canvas, etc.), so this
 * hook reads the computed CSS custom properties from the section's DOM element and
 * returns real hex colour values.
 *
 * Priority: section CSS override > global theme > designSystem prop > fallback.
 */

const COLOR_KEYS = ['primary', 'secondary', 'accent', 'background', 'surface', 'text', 'heading'] as const;

type ColorKey = (typeof COLOR_KEYS)[number];
type ResolvedColors = Record<ColorKey, string>;

const FALLBACKS: ResolvedColors = {
  primary: '#059669',
  secondary: '#34d399',
  accent: '#10b981',
  background: '#ffffff',
  surface: '#f9fafb',
  text: '#1f2937',
  heading: '#111827',
};

export function useResolvedColors(designSystem?: any): {
  ref: React.RefObject<HTMLElement | null>;
  colors: ResolvedColors;
} {
  const ref = useRef<HTMLElement | null>(null);
  const [colors, setColors] = useState<ResolvedColors>(() => {
    // Initial pass: use designSystem HSL values converted to hex, or fallbacks
    const ds = designSystem?.colors || {};
    const result = { ...FALLBACKS };
    for (const key of COLOR_KEYS) {
      if (ds[key] && typeof ds[key] === 'string') {
        result[key] = hslToHex(ds[key], FALLBACKS[key]);
      }
    }
    return result;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const resolve = () => {
      const computed = getComputedStyle(el);
      const result = { ...FALLBACKS };
      const ds = designSystem?.colors || {};

      for (const key of COLOR_KEYS) {
        const cssVal = computed.getPropertyValue(`--tenant-color-${key}`).trim();
        if (cssVal) {
          // CSS var resolved — convert HSL channels to hex
          result[key] = hslToHex(cssVal, FALLBACKS[key]);
        } else if (ds[key] && typeof ds[key] === 'string') {
          result[key] = hslToHex(ds[key], FALLBACKS[key]);
        }
      }

      setColors((prev) => {
        // Only update if any value changed to avoid re-renders
        const changed = COLOR_KEYS.some((k) => prev[k] !== result[k]);
        return changed ? result : prev;
      });
    };

    // Small delay to let CSS cascade settle after mount
    const raf = requestAnimationFrame(resolve);

    // Also observe style changes (e.g. live editor toggling overrides)
    const observer = new MutationObserver(resolve);
    observer.observe(el, { attributes: true, attributeFilter: ['style', 'class'] });

    // Listen for style element changes on the document (section color override <style> tags)
    const headObserver = new MutationObserver(resolve);
    headObserver.observe(document.head, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      headObserver.disconnect();
    };
  }, [designSystem]);

  return { ref, colors };
}
