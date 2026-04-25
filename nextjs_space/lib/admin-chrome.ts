/**
 * Admin chrome version flag.
 *
 * v1 = current light Flowa Pro chrome (existing behaviour)
 * v2 = new dark sidebar / light content chrome aligned with marketing theme
 *
 * Resolution order:
 *   1. Explicit NEXT_PUBLIC_ADMIN_CHROME env var ("v1" or "v2")
 *   2. Default: "v2" in development, "v1" otherwise
 *
 * This lets Gerard evaluate v2 on local while production stays on v1
 * until the flag is explicitly flipped.
 *
 * Scope: Super-Admin only. Tenant-Admin reads v1 unconditionally for now.
 */
export type AdminChromeVersion = "v1" | "v2";

const explicit = process.env.NEXT_PUBLIC_ADMIN_CHROME as
  | AdminChromeVersion
  | undefined;

export const ADMIN_CHROME_VERSION: AdminChromeVersion =
  explicit === "v1" || explicit === "v2"
    ? explicit
    : process.env.NODE_ENV === "development"
      ? "v2"
      : "v1";
