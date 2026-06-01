/**
 * Reserved subdomains that cannot be registered (onboarding) or renamed onto
 * (super-admin tenant rename) — PRD-201 AC-6/AC-7.
 *
 * Includes routing-structural placeholders from middleware.ts. `_cd` was the
 * historic custom-domain rewrite placeholder (example.com -> /store/_cd/...);
 * PRD-212 replaced it with host-scoped /store/cd-<hash> segments, but `_cd`
 * stays reserved as defense-in-depth so no tenant can claim the legacy literal
 * (it also can never be registered: it fails isValidSubdomain's no-underscore
 * charset, but reserving it keeps the intent explicit).
 */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  // Routing-structural placeholders (middleware.ts rewrites)
  "_cd",
  // Platform / infrastructure hostnames
  "www", "api", "admin", "super-admin", "mail", "smtp", "ftp",
  "app", "dashboard", "help", "support", "status", "docs",
  "blog", "store", "shop", "cdn", "assets", "static", "media",
  "auth", "login", "signup", "register", "account", "billing",
  "budstacks", "budstack",
]);

/** True if `subdomain` is reserved (case-insensitive, trimmed). */
export function isReservedSubdomain(subdomain: string): boolean {
  return RESERVED_SUBDOMAINS.has(subdomain.toLowerCase().trim());
}

/**
 * Validate subdomain format: lowercase alphanumeric + hyphens, 2-30 chars,
 * no leading/trailing hyphen and no double hyphen.
 */
export function isValidSubdomain(subdomain: string): boolean {
  return (
    /^[a-z0-9][a-z0-9-]{0,28}[a-z0-9]$/.test(subdomain) &&
    !subdomain.includes("--")
  );
}
