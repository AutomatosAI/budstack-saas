/**
 * Convert HSL channel string (e.g. "275 70% 55%") to hex (e.g. "#A333E6").
 * Passes through hex values unchanged.
 * Returns fallback if input is empty/null.
 */
export function hslToHex(value: string | null | undefined, fallback = "#000000"): string {
  if (!value) return fallback;

  // Already hex — pass through
  if (value.startsWith("#")) return value;

  // Parse HSL channels: "275 70% 55%"
  const match = value.match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) return fallback;

  const h = parseFloat(match[1]);
  const s = parseFloat(match[2]) / 100;
  const l = parseFloat(match[3]) / 100;

  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };

  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Convert hex to HSL channel string (e.g. "#A333E6" -> "275 70% 55%").
 */
export function hexToHsl(hex: string): string {
  // Remove hash if present
  hex = hex.replace(/^#/, '');

  // Parse r, g, b values
  let r = 0, g = 0, b = 0;
  if (hex.length === 3) {
    r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
    g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
    b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  }

  // Convert to fractions
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  // Convert to specific format (H S% L%)
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);

  return `${h} ${s}% ${l}%`;
}
