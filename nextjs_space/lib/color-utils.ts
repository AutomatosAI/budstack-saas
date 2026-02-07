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
