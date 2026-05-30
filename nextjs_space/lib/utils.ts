import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Keys that, if copied onto an object, can poison Object.prototype. A
 * JSON.parse'd payload carries "__proto__" as an OWN enumerable key (unlike an
 * object literal), so Object.keys() yields it and a naive assignment hits the
 * prototype setter. Skip these at every recursion level (PRD-204 AC-2).
 */
const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Deep merge two objects. Override values win unless undefined/null/empty string.
 * Arrays are NOT merged — overrides replace entirely.
 */
export function deepMerge(base: any, overrides: any): any {
  if (!base) return overrides;
  if (!overrides) return base;
  const result = { ...base };
  for (const key of Object.keys(overrides)) {
    if (DANGEROUS_KEYS.has(key)) continue;
    const val = overrides[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = deepMerge(base[key], val);
    } else if (val !== undefined && val !== null && val !== '') {
      result[key] = val;
    }
  }
  return result;
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
}
