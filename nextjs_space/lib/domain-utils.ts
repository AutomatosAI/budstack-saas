/**
 * Common multi-part public suffixes (country-code TLDs that take two labels).
 * Not a full Public Suffix List — just the ones we encounter in practice.
 * Add entries as needed.
 */
const MULTI_PART_TLDS = new Set([
  "co.uk",
  "org.uk",
  "ac.uk",
  "gov.uk",
  "net.uk",
  "co.za",
  "org.za",
  "co.nz",
  "co.jp",
  "co.kr",
  "co.in",
  "com.au",
  "net.au",
  "org.au",
  "com.br",
  "com.mx",
  "com.ar",
  "com.cn",
  "com.sg",
  "com.hk",
  "com.tr",
]);

/**
 * Returns true if `domain` is the apex (root) of its registrable name.
 * Handles common multi-part TLDs like .co.za, .co.uk, .com.au.
 *
 * Examples:
 *   isApexDomain("example.com")          → true
 *   isApexDomain("shop.example.com")     → false
 *   isApexDomain("healingbuds.co.za")    → true
 *   isApexDomain("www.healingbuds.co.za")→ false
 */
export function isApexDomain(domain: string): boolean {
  const parts = domain.toLowerCase().split(".");
  if (parts.length < 2) return false;
  if (parts.length === 2) return true;

  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_PART_TLDS.has(lastTwo)) {
    return parts.length === 3;
  }
  return false;
}
